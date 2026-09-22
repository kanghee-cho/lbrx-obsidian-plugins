import { App, Modal } from "obsidian";
import type { DictionaryService } from "../api/dictionaryService";
import { renderLookupResult } from "./renderEntries";

/** Modal used by the "선택한 단어 사전 조회" command. */
export class DictionaryModal extends Modal {
  constructor(
    app: App,
    private readonly service: DictionaryService,
    private readonly word: string,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("lbrx-dictionary-modal");
    contentEl.createEl("p", { text: "조회 중...", cls: "lbrx-dictionary-loading" });

    this.service
      .lookup(this.word)
      .then((result) => renderLookupResult(contentEl, result))
      .catch((err) => {
        contentEl.empty();
        contentEl.createEl("p", {
          text: `조회 실패: ${err instanceof Error ? err.message : String(err)}`,
          cls: "lbrx-dictionary-error",
        });
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
