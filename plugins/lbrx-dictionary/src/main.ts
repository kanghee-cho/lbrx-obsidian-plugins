import { Notice, Plugin } from "obsidian";
import { mergeSettings } from "@lbrx/shared-core";
import { DEFAULT_SETTINGS, LbrxDictionarySettings } from "./settings";
import { PocketBaseClient } from "./api/pocketbaseClient";
import { DictionaryService } from "./api/dictionaryService";
import { DictionaryTooltip } from "./ui/tooltip";
import { DictionaryModal } from "./ui/DictionaryModal";
import { DictionarySidebarView, DICTIONARY_VIEW_TYPE } from "./ui/DictionarySidebarView";
import { createDictionaryTermExtension } from "./editor/dictionaryTermExtension";
import { registerDictionaryPostProcessor } from "./editor/markdownPostProcessor";
import { LbrxDictionarySettingTab } from "./LbrxDictionarySettingTab";

export default class LbrxDictionaryPlugin extends Plugin {
  settings!: LbrxDictionarySettings;
  pocketbaseClient!: PocketBaseClient;
  dictionaryService!: DictionaryService;
  private tooltip!: DictionaryTooltip;

  async onload() {
    await this.loadSettings();

    this.pocketbaseClient = new PocketBaseClient(() => this.settings);
    this.dictionaryService = new DictionaryService(this.pocketbaseClient, () => this.settings);
    this.tooltip = new DictionaryTooltip(this.dictionaryService);

    this.registerView(DICTIONARY_VIEW_TYPE, (leaf) => new DictionarySidebarView(leaf, this.dictionaryService));
    this.addRibbonIcon("book-open", "LBRX Dictionary 검색", () => this.activateSidebar());

    // Live Preview (editing) support.
    this.registerEditorExtension(createDictionaryTermExtension(() => this.settings, this.tooltip));
    // Reading view support.
    registerDictionaryPostProcessor(this, () => this.settings, this.tooltip);

    this.addCommand({
      id: "lbrx-dictionary-lookup-selection",
      name: "선택한 단어 사전 조회",
      editorCallback: (editor) => {
        const selection = editor.getSelection().trim();
        if (!selection) {
          new Notice("조회할 텍스트를 먼저 선택하세요.");
          return;
        }
        new DictionaryModal(this.app, this.dictionaryService, selection).open();
      },
    });

    this.addCommand({
      id: "lbrx-dictionary-open-search",
      name: "사전 검색 패널 열기",
      callback: () => this.activateSidebar(),
    });

    this.addSettingTab(new LbrxDictionarySettingTab(this.app, this));
  }

  onunload() {
    this.tooltip?.destroy();
  }

  async loadSettings() {
    this.settings = mergeSettings(DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /** Forces open editors to recompute registered CM6 extensions (e.g. after the delimiter changes). */
  refreshEditorExtensions(): void {
    this.app.workspace.updateOptions();
  }

  private async activateSidebar(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(DICTIONARY_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
      await leaf.setViewState({ type: DICTIONARY_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }
}
