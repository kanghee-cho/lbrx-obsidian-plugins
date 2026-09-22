import { ItemView, WorkspaceLeaf } from "obsidian";
import { debounce } from "@lbrx/shared-core";
import type { DictionaryService } from "../api/dictionaryService";
import { renderLookupResult } from "./renderEntries";

export const DICTIONARY_VIEW_TYPE = "lbrx-dictionary-search";

/** Sidebar search panel: type a word, see results below, no need to select text in a note. */
export class DictionarySidebarView extends ItemView {
  private resultsEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private readonly service: DictionaryService) {
    super(leaf);
  }

  getViewType(): string {
    return DICTIONARY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "LBRX Dictionary";
  }

  getIcon(): string {
    return "book-open";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("lbrx-dictionary-sidebar");

    const input = container.createEl("input", {
      type: "search",
      placeholder: "단어 검색...",
      cls: "lbrx-dictionary-search-input",
    });
    this.resultsEl = container.createDiv({ cls: "lbrx-dictionary-results" });

    const runSearch = debounce((value: string) => {
      const trimmed = value.trim();
      this.resultsEl.empty();
      if (!trimmed) return;

      this.resultsEl.createEl("p", { text: "조회 중...", cls: "lbrx-dictionary-loading" });
      this.service
        .lookup(trimmed)
        .then((result) => renderLookupResult(this.resultsEl, result))
        .catch((err) => {
          this.resultsEl.empty();
          this.resultsEl.createEl("p", {
            text: `조회 실패: ${err instanceof Error ? err.message : String(err)}`,
            cls: "lbrx-dictionary-error",
          });
        });
    }, 300);

    input.addEventListener("input", () => runSearch(input.value));
  }

  async onClose(): Promise<void> {
    this.resultsEl?.empty();
  }
}
