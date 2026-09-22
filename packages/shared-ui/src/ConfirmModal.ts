import { App, Modal } from "obsidian";

/**
 * Simple confirm dialog reused by any LBRX plugin that needs a
 * "are you sure?" prompt instead of re-implementing a Modal each time.
 */
export class ConfirmModal extends Modal {
  private readonly message: string;
  private readonly onConfirm: (confirmed: boolean) => void;

  constructor(app: App, message: string, onConfirm: (confirmed: boolean) => void) {
    super(app);
    this.message = message;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("p", { text: this.message });

    const buttonRow = contentEl.createDiv({ cls: "lbrx-modal-buttons" });
    buttonRow.createEl("button", { text: "Cancel" }).addEventListener("click", () => {
      this.onConfirm(false);
      this.close();
    });
    buttonRow.createEl("button", { text: "Confirm", cls: "mod-cta" }).addEventListener("click", () => {
      this.onConfirm(true);
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}
