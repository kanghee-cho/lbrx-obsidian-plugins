import type { DictionaryService } from "../api/dictionaryService";
import { renderLookupResult } from "./renderEntries";

const HIDE_DELAY_MS = 150;

/**
 * Singleton floating tooltip used by both the live-preview editor extension
 * and the reading-mode post processor to show a word's definition on hover.
 * A short hide delay lets the mouse move from the term into the tooltip
 * itself (e.g. to scroll a long definition) without it disappearing.
 */
export class DictionaryTooltip {
  private el: HTMLDivElement | undefined;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private currentWord: string | undefined;

  constructor(private readonly service: DictionaryService) {}

  show(word: string, anchor: HTMLElement): void {
    this.cancelHide();

    if (this.currentWord === word && this.el) {
      this.position(anchor);
      return;
    }
    this.currentWord = word;
    this.ensureEl();

    const el = this.el as HTMLDivElement;
    el.empty();
    el.createEl("p", { text: "조회 중...", cls: "lbrx-dictionary-loading" });
    this.position(anchor);
    el.style.display = "block";

    this.service
      .lookup(word)
      .then((result) => {
        if (this.currentWord !== word || !this.el) return;
        renderLookupResult(this.el, result);
      })
      .catch((err) => {
        if (this.currentWord !== word || !this.el) return;
        this.el.empty();
        this.el.createEl("p", {
          text: `조회 실패: ${err instanceof Error ? err.message : String(err)}`,
          cls: "lbrx-dictionary-error",
        });
      });
  }

  scheduleHide(): void {
    this.cancelHide();
    this.hideTimer = setTimeout(() => this.hide(), HIDE_DELAY_MS);
  }

  cancelHide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
  }

  hide(): void {
    this.currentWord = undefined;
    if (this.el) this.el.style.display = "none";
  }

  destroy(): void {
    this.cancelHide();
    this.el?.remove();
    this.el = undefined;
  }

  private ensureEl(): void {
    if (this.el) return;
    this.el = document.body.createDiv({ cls: "lbrx-dictionary-tooltip" });
    this.el.addEventListener("mouseenter", () => this.cancelHide());
    this.el.addEventListener("mouseleave", () => this.scheduleHide());
  }

  private position(anchor: HTMLElement): void {
    if (!this.el) return;
    const rect = anchor.getBoundingClientRect();
    this.el.style.position = "fixed";
    this.el.style.left = `${rect.left}px`;
    this.el.style.top = `${rect.bottom + 4}px`;
  }
}
