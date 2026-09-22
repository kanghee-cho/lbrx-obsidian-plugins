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
 * Applies the user-configured dictionary priority: returns the entries from
 * the first dictionary (in priority order) that has at least one match.
 * If none of the prioritized dictionaries matched, all found entries are
 * returned (no preference configured, or word only exists elsewhere).
 */
function applyDictionaryPriority(entries: DictEntry[], priority: string[]): DictEntry[] {
  for (const dictionaryId of priority) {
    // `dictionary_id` may come back as a number if the underlying SQLite column
    // is INTEGER, while settings values are always strings — compare as strings.
    const matches = entries.filter((entry) => String(entry.dictionary_id) === dictionaryId);
    if (matches.length > 0) return matches;
  }
  return entries;
}

/**
 * Looks up a word against the PocketBase `dict_entries` / `dict_inflections`
 * views:
 *   1. Direct match on `dict_entries.headword_normalized`.
 *   2. If the word is an inflected form, `dict_inflections.inflected_normalized`
 *      resolves it to one or more `headword_normalized` lemmas, which are then
 *      looked up in `dict_entries` too.
 * All matching entries (across every dictionary) are cached in-memory (TTL
 * configurable); `settings.dictionaryPriority` is applied fresh on every call
 * on top of the cached data, so changing the priority order takes effect
 * immediately without waiting for the cache to expire.
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
      entries: applyDictionaryPriority(cachedLookup.allEntries, settings.dictionaryPriority),
      inflections: cachedLookup.inflections,
      fetchedAt: cachedLookup.fetchedAt,
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
