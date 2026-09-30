import { PocketBaseClient, escapePbFilterValue } from "./pocketbaseClient";
import type { LbrxDictionarySettings } from "../settings";
import type { DictEntry, DictInflection, DictionaryLookupResult } from "../types";

interface CachedLookup {
  /** All entries found across every dictionary, before priority filtering. */
  allEntries: DictEntry[];
  inflections: DictInflection[];
  fetchedAt: number;
  expiresAt: number;
}

/**
 * Best-effort mirror of the server-side normalization used to populate
 * `headword_normalized` / `inflected_normalized` (lowercase + trim). If the
 * server normalizes further (e.g. diacritics), adjust this to match.
 */
function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

/** Splits `items` into chunks of at most `size` elements. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Max distinct words per batched PocketBase filter request. Each request's
 * `filter` is `headword_normalized='a' || headword_normalized='b' || ...`,
 * so this bounds the generated URL length; keeps `perPage` (chunk size * a
 * generous per-word row estimate) comfortably under PocketBase's default
 * 500-item cap even when a word matches every configured dictionary.
 */
const WORDS_PER_CHUNK = 25;

/**
 * Looks up words against the PocketBase `dict_entries` / `dict_inflections`
 * views:
 *   1. Direct match on `dict_entries.headword_normalized`.
 *   2. For only the words with *no* direct match, `dict_inflections
 *      .inflected_normalized` resolves them to `headword_normalized` lemmas,
 *      which are then looked up in `dict_entries` too.
 * All matching entries (across every dictionary) are cached in-memory (TTL
 * configurable) and returned as-is; `settings.dictionaryPriority` is read
 * fresh on every call and attached to the result so the render layer can
 * group entries into per-dictionary tabs ordered by priority, without
 * waiting for the cache to expire when the priority order changes.
 *
 * Unlike a naive per-word implementation, every step above is batched
 * across *all* words being looked up (see `prefetchWords`): a note with N
 * dictionary terms visible on screen costs at most 3 HTTP requests total
 * (typically 1, since most terms are already base forms with a direct
 * match) instead of up to 3*N. `lookup()` is just `prefetchWords` for a
 * single word, so single hover/search lookups get the same batching and
 * in-flight de-duping for free.
 */
export class DictionaryService {
  private readonly cache = new Map<string, CachedLookup>();
  /** Keyed by normalized word; lets overlapping requests (e.g. a hover firing while a viewport-wide prefetch for the same word is still in flight) share one HTTP round trip instead of duplicating it. */
  private readonly inflight = new Map<string, Promise<void>>();

  constructor(
    private readonly client: PocketBaseClient,
    private readonly getSettings: () => LbrxDictionarySettings,
  ) {}

  async lookup(word: string): Promise<DictionaryLookupResult> {
    await this.prefetchWords([word]);

    const key = normalizeWord(word);
    const settings = this.getSettings();
    const cached = this.cache.get(key);

    return {
      query: word,
      entries: cached?.allEntries ?? [],
      inflections: cached?.inflections ?? [],
      fetchedAt: cached?.fetchedAt ?? Date.now(),
      priority: settings.dictionaryPriority,
    };
  }

  /**
   * Ensures every word in `words` is present (and fresh) in the cache,
   * fetching whatever is missing in as few batched requests as possible.
   * Safe to call speculatively (e.g. for everything currently visible in
   * the editor) - already-cached words cost nothing.
   */
  async prefetchWords(words: string[]): Promise<void> {
    const now = Date.now();
    const settings = this.getSettings();
    const keys = [...new Set(words.map(normalizeWord).filter(Boolean))];

    const stale = keys.filter((key) => {
      const cached = this.cache.get(key);
      return !cached || cached.expiresAt <= now;
    });
    if (stale.length === 0) return;

    const toFetch = stale.filter((key) => !this.inflight.has(key));
    const waiters = stale.filter((key) => this.inflight.has(key)).map((key) => this.inflight.get(key) as Promise<void>);

    if (toFetch.length > 0) {
      const fetchPromise = this.fetchAndCacheBatch(toFetch, now, settings);
      for (const key of toFetch) {
        this.inflight.set(
          key,
          fetchPromise.finally(() => this.inflight.delete(key)),
        );
      }
      waiters.push(fetchPromise);
    }

    await Promise.all(waiters);
  }

  /** Fetches+caches `keys`, chunked to keep individual requests bounded in size. */
  private async fetchAndCacheBatch(keys: string[], now: number, settings: LbrxDictionarySettings): Promise<void> {
    await Promise.all(chunk(keys, WORDS_PER_CHUNK).map((batch) => this.fetchChunk(batch, now, settings)));
  }

  private async fetchChunk(keys: string[], now: number, settings: LbrxDictionarySettings): Promise<void> {
    const byWord = new Map<string, { entries: DictEntry[]; inflections: DictInflection[] }>();
    for (const key of keys) byWord.set(key, { entries: [], inflections: [] });

    // Step 1: one combined request for direct matches on every word.
    const directFilter = keys.map((key) => `headword_normalized='${escapePbFilterValue(key)}'`).join(" || ");
    const directEntries = await this.client.listRecords<DictEntry>(
      settings.entriesCollection,
      directFilter,
      Math.min(500, keys.length * 10),
    );
    for (const entry of directEntries) {
      byWord.get(entry.headword_normalized)?.entries.push(entry);
    }

    // Step 2: only words with zero direct match might be inflected forms
    // (e.g. "running" -> "run") - skipping the rest avoids a second
    // request entirely for the common case of already-base-form words.
    const missing = keys.filter((key) => (byWord.get(key)?.entries.length ?? 0) === 0);
    if (missing.length === 0) {
      this.commitChunk(byWord, now, settings);
      return;
    }

    const inflectionFilter = missing.map((key) => `inflected_normalized='${escapePbFilterValue(key)}'`).join(" || ");
    const inflections = await this.client.listRecords<DictInflection>(
      settings.inflectionsCollection,
      inflectionFilter,
      Math.min(500, missing.length * 10),
    );

    const lemmasByWord = new Map<string, Set<string>>();
    for (const infl of inflections) {
      byWord.get(infl.inflected_normalized)?.inflections.push(infl);
      if (!lemmasByWord.has(infl.inflected_normalized)) lemmasByWord.set(infl.inflected_normalized, new Set());
      lemmasByWord.get(infl.inflected_normalized)?.add(infl.headword_normalized);
    }

    // Step 3: one combined request for every lemma resolved above.
    const allLemmas = [...new Set(inflections.map((infl) => infl.headword_normalized).filter(Boolean))];
    if (allLemmas.length > 0) {
      const lemmaFilter = allLemmas.map((lemma) => `headword_normalized='${escapePbFilterValue(lemma)}'`).join(" || ");
      const lemmaEntries = await this.client.listRecords<DictEntry>(
        settings.entriesCollection,
        lemmaFilter,
        Math.min(500, allLemmas.length * 10),
      );
      const entriesByLemma = new Map<string, DictEntry[]>();
      for (const entry of lemmaEntries) {
        if (!entriesByLemma.has(entry.headword_normalized)) entriesByLemma.set(entry.headword_normalized, []);
        entriesByLemma.get(entry.headword_normalized)?.push(entry);
      }
      for (const [word, lemmas] of lemmasByWord) {
        const bucket = byWord.get(word);
        if (!bucket) continue;
        for (const lemma of lemmas) bucket.entries.push(...(entriesByLemma.get(lemma) ?? []));
      }
    }

    this.commitChunk(byWord, now, settings);
  }

  private commitChunk(
    byWord: Map<string, { entries: DictEntry[]; inflections: DictInflection[] }>,
    now: number,
    settings: LbrxDictionarySettings,
  ): void {
    for (const [key, bucket] of byWord) {
      this.cache.set(key, {
        allEntries: dedupeById(bucket.entries),
        inflections: bucket.inflections,
        fetchedAt: now,
        expiresAt: now + settings.cacheTtlMinutes * 60_000,
      });
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
