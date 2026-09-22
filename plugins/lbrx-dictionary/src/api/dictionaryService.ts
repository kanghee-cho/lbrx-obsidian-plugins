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

/**
 * Looks up a word against the PocketBase `dict_entries` / `dict_inflections`
 * views:
 *   1. Direct match on `dict_entries.headword_normalized`.
 *   2. If the word is an inflected form, `dict_inflections.inflected_normalized`
 *      resolves it to one or more `headword_normalized` lemmas, which are then
 *      looked up in `dict_entries` too.
 * All matching entries (across every dictionary) are cached in-memory (TTL
 * configurable) and returned as-is; `settings.dictionaryPriority` is read
 * fresh on every call and attached to the result so the render layer can
 * group entries into per-dictionary tabs ordered by priority, without
 * waiting for the cache to expire when the priority order changes.
 */
export class DictionaryService {
  private readonly cache = new Map<string, CachedLookup>();

  constructor(
    private readonly client: PocketBaseClient,
    private readonly getSettings: () => LbrxDictionarySettings,
  ) {}

  async lookup(word: string): Promise<DictionaryLookupResult> {
    const key = normalizeWord(word);
    const now = Date.now();
    const settings = this.getSettings();

    const cached = this.cache.get(key);
    const cachedLookup = cached && cached.expiresAt > now ? cached : await this.fetchAndCache(key, word, now, settings);

    return {
      query: word,
      entries: cachedLookup.allEntries,
      inflections: cachedLookup.inflections,
      fetchedAt: cachedLookup.fetchedAt,
      priority: settings.dictionaryPriority,
    };
  }

  private async fetchAndCache(
    key: string,
    word: string,
    now: number,
    settings: LbrxDictionarySettings,
  ): Promise<CachedLookup> {
    const escapedKey = escapePbFilterValue(key);

    const [directEntries, inflections] = await Promise.all([
      this.client.listRecords<DictEntry>(settings.entriesCollection, `headword_normalized='${escapedKey}'`),
      this.client.listRecords<DictInflection>(
        settings.inflectionsCollection,
        `inflected_normalized='${escapedKey}'`,
      ),
    ]);

    const lemmas = [...new Set(inflections.map((infl) => infl.headword_normalized).filter(Boolean))];

    let lemmaEntries: DictEntry[] = [];
    if (lemmas.length > 0) {
      const lemmaFilter = lemmas
        .map((lemma) => `headword_normalized='${escapePbFilterValue(lemma)}'`)
        .join(" || ");
      lemmaEntries = await this.client.listRecords<DictEntry>(settings.entriesCollection, lemmaFilter);
    }

    const cachedLookup: CachedLookup = {
      allEntries: dedupeById([...directEntries, ...lemmaEntries]),
      inflections,
      fetchedAt: now,
      expiresAt: now + settings.cacheTtlMinutes * 60_000,
    };

    this.cache.set(key, cachedLookup);
    return cachedLookup;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
