import type { DictEntry, DictionaryLookupResult } from "../types";
import { fixLowContrastText } from "./contrastFix";

interface DictionaryGroup {
  dictionaryId: string;
  dictionaryName: string;
  entries: DictEntry[];
}

/**
 * Groups entries by `dictionary_id`, ordered by the configured priority
 * first (only dictionaries that actually matched are kept, so a priority
 * entry with no result for this word is simply skipped), then any
 * remaining dictionaries in the order they were first encountered.
 */
function groupEntriesByDictionary(entries: DictEntry[], priority: string[]): DictionaryGroup[] {
  const groupsById = new Map<string, DictionaryGroup>();
  for (const entry of entries) {
    // `dictionary_id` may come back as a number if the underlying SQLite
    // column is INTEGER, while priority settings are always strings.
    const id = String(entry.dictionary_id);
    let group = groupsById.get(id);
    if (!group) {
      group = { dictionaryId: id, dictionaryName: entry.dictionary_name, entries: [] };
      groupsById.set(id, group);
    }
    group.entries.push(entry);
  }

  const ordered: DictionaryGroup[] = [];
  for (const dictionaryId of priority) {
    const group = groupsById.get(dictionaryId);
    if (group) {
      ordered.push(group);
      groupsById.delete(dictionaryId);
    }
  }
  for (const entry of entries) {
    const id = String(entry.dictionary_id);
    const group = groupsById.get(id);
    if (group) {
      ordered.push(group);
      groupsById.delete(id);
    }
  }
  return ordered;
}

/**
 * Renders a lookup result using the confirmed `dict_entries` schema:
 * headword, dictionary attribution (name + lang_from -> lang_to), and the
 * HTML definition (falling back to plain text if HTML is empty).
 *
 * When the word matches entries from more than one dictionary, the
 * dictionaries are shown as tabs (ordered by `dictionaryPriority`, first
 * match selected by default) so other dictionaries' definitions remain a
 * click away. Dictionaries without a match for this word don't get a tab.
 *
 * Visual styling per dictionary (`marker`-based accent colors, tab pills,
 * `<br>` paragraph spacing) mirrors the reference web app at
 * `lbrx_dictionary/app/frontend/style.css` — see `styles.css`.
 */
export function renderLookupResult(container: HTMLElement, result: DictionaryLookupResult): void {
  container.empty();
  container.createEl("h4", { text: result.query, cls: "lbrx-dictionary-query" });

  if (result.entries.length === 0) {
    container.createEl("p", { text: "결과를 찾을 수 없습니다.", cls: "lbrx-dictionary-empty" });
    return;
  }

  const groups = groupEntriesByDictionary(result.entries, result.priority);

  if (groups.length <= 1) {
    for (const entry of result.entries) renderEntry(container, entry);
    return;
  }

  const tabsEl = container.createDiv({ cls: "lbrx-dictionary-tabs" });
  const panelEl = container.createDiv({ cls: "lbrx-dictionary-tab-panel" });

  const renderGroup = (group: DictionaryGroup) => {
    panelEl.empty();
    // The active tab already names the dictionary, so entries rendered
    // inside a tab panel skip the redundant source label.
    for (const entry of group.entries) renderEntry(panelEl, entry, { showSource: false });
  };

  const tabButtons: HTMLElement[] = [];
  groups.forEach((group, index) => {
    const tabBtn = tabsEl.createEl("button", {
      text: group.dictionaryName,
      cls: "lbrx-dictionary-tab",
      attr: { type: "button", "data-marker": group.entries[0]?.marker ?? "" },
    });
    if (index === 0) tabBtn.addClass("is-active");
    tabButtons.push(tabBtn);
    tabBtn.addEventListener("click", () => {
      tabButtons.forEach((btn) => btn.removeClass("is-active"));
      tabBtn.addClass("is-active");
      renderGroup(group);
    });
  });

  renderGroup(groups[0]);
}

function renderEntry(container: HTMLElement, entry: DictEntry, opts: { showSource: boolean } = { showSource: true }): void {
  const entryEl = container.createDiv({ cls: "lbrx-dictionary-entry" });

  if (opts.showSource) {
    const headerEl = entryEl.createDiv({ cls: "lbrx-dictionary-entry-header" });
    headerEl.createEl("span", { text: entry.headword, cls: "lbrx-dictionary-headword" });
    headerEl.createEl("span", {
      text: `${entry.dictionary_name} (${entry.lang_from}→${entry.lang_to})`,
      cls: "lbrx-dictionary-source",
    });
  }

  const definitionEl = entryEl.createDiv({ cls: "lbrx-dictionary-definition" });
  definitionEl.setAttribute("data-marker", entry.marker ?? "");
  if (entry.definition_html) {
    // Trusted internal PocketBase content (own dictionary data), rendered as-is.
    definitionEl.innerHTML = entry.definition_html;
    // The source HTML's own inline colors may not have enough contrast
    // against our marker-tinted background (especially in dark mode).
    fixLowContrastText(definitionEl);
  } else {
    definitionEl.setText(entry.definition_text ?? "");
  }
}
