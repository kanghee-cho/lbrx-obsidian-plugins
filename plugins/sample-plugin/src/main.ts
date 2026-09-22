import { Notice, Plugin } from "obsidian";
import { mergeSettings, PLUGIN_IDS } from "@lbrx/shared-core";
import { writeSharedData } from "@lbrx/shared-settings";
import { ConfirmModal } from "@lbrx/shared-ui";
import { DEFAULT_SETTINGS, SamplePluginSettings } from "./settings";
import { SampleSettingTab } from "./SampleSettingTab";

export default class SamplePlugin extends Plugin {
  settings!: SamplePluginSettings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new SampleSettingTab(this.app, this));

    this.addCommand({
      id: "lbrx-sample-say-hello",
      name: "Say hello",
      callback: () => {
        new ConfirmModal(this.app, this.settings.greeting, async (confirmed) => {
          if (confirmed) {
            new Notice(this.settings.greeting);
            // Example of writing to the shared cross-plugin data file.
            await writeSharedData(this.app.vault, PLUGIN_IDS.samplePlugin, {
              lastGreetingAt: Date.now(),
            });
          }
        }).open();
      },
    });
  }

  onunload() {
    // Release resources / event listeners here if needed.
  }

  async loadSettings() {
    this.settings = mergeSettings(DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
