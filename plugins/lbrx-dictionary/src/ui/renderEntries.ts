import type { DictEntry, DictionaryLookupResult } from "../types";

/**
 * Renders a lookup result using the confirmed `dict_entries` schema:
 * headword, dictionary attribution (name + lang_from -> lang_to), and the
 * HTML definition (falling back to plain text if HTML is empty).
 */
export function renderLookupResult(container: HTMLElement, result: DictionaryLookupResult): void {
  container.empty();
  container.createEl("h4", { text: result.query, cls: "lbrx-dictionary-query" });

  if (result.entries.length === 0) {
    container.createEl("p", { text: "결과를 찾을 수 없습니다.", cls: "lbrx-dictionary-empty" });
    return;
  }

  for (const entry of result.entries) {
    renderEntry(container, entry);
  }
}

function renderEntry(container: HTMLElement, entry: DictEntry): void {
  const entryEl = container.createDiv({ cls: "lbrx-dictionary-entry" });

  const headerEl = entryEl.createDiv({ cls: "lbrx-dictionary-entry-header" });
  headerEl.createEl("span", { text: entry.headword, cls: "lbrx-dictionary-headword" });
  headerEl.createEl("span", {
    text: `${entry.dictionary_name} (${entry.lang_from}→${entry.lang_to})`,
    cls: "lbrx-dictionary-source",
  });

  const definitionEl = entryEl.createDiv({ cls: "lbrx-dictionary-definition" });
  if (entry.definition_html) {
    // Trusted internal PocketBase content (own dictionary data), rendered as-is.
    definitionEl.innerHTML = entry.definition_html;
  } else {
    definitionEl.setText(entry.definition_text ?? "");
  }
}
