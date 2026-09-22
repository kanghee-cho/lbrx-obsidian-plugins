import { App, PluginSettingTab, Setting } from "obsidian";
import type SamplePlugin from "./main";

export class SampleSettingTab extends PluginSettingTab {
  plugin: SamplePlugin;

  constructor(app: App, plugin: SamplePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Greeting")
      .setDesc("Text shown by the sample command.")
      .addText((text) =>
        text.setValue(this.plugin.settings.greeting).onChange(async (value) => {
          this.plugin.settings.greeting = value;
          await this.plugin.saveSettings();
        }),
      );
  }
}
