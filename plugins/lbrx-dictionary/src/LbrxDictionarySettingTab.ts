import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_SETTINGS } from "./settings";
import type LbrxDictionaryPlugin from "./main";

export class LbrxDictionarySettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: LbrxDictionaryPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h3", { text: "PocketBase 연결" });

    new Setting(containerEl)
      .setName("PocketBase URL")
      .setDesc("예: https://dict.lbrx.net")
      .addText((text) =>
        text.setValue(this.plugin.settings.pocketbaseUrl).onChange(async (value) => {
          this.plugin.settings.pocketbaseUrl = value.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Auth collection")
      .setDesc("로그인에 사용할 PocketBase collection 이름 (보통 users)")
      .addText((text) =>
        text.setValue(this.plugin.settings.authCollection).onChange(async (value) => {
          this.plugin.settings.authCollection = value.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Identity")
      .setDesc("로그인 이메일 또는 username")
      .addText((text) =>
        text.setValue(this.plugin.settings.identity).onChange(async (value) => {
          this.plugin.settings.identity = value.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Password")
      .setDesc("주의: 이 값은 vault의 data.json 파일에 평문으로 저장됩니다.")
      .addText((text) => {
        text.inputEl.type = "password";
        text.setValue(this.plugin.settings.password).onChange(async (value) => {
          this.plugin.settings.password = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("연결 테스트")
      .setDesc("입력한 정보로 로그인을 시도합니다.")
      .addButton((btn) =>
        btn.setButtonText("로그인 테스트").onClick(async () => {
          try {
            await this.plugin.pocketbaseClient.ensureAuthenticated();
            new Notice("LBRX Dictionary: 로그인 성공");
          } catch (err) {
            new Notice(`LBRX Dictionary: ${err instanceof Error ? err.message : String(err)}`);
          }
        }),
      );

    containerEl.createEl("h3", { text: "데이터 소스" });

    new Setting(containerEl)
      .setName("Entries collection/view")
      .setDesc("표제어/정의를 담고 있는 view 이름")
      .addText((text) =>
        text.setValue(this.plugin.settings.entriesCollection).onChange(async (value) => {
          this.plugin.settings.entriesCollection = value.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Inflections collection/view")
      .setDesc("활용형 -> 표제어 매핑을 담고 있는 view 이름")
      .addText((text) =>
        text.setValue(this.plugin.settings.inflectionsCollection).onChange(async (value) => {
          this.plugin.settings.inflectionsCollection = value.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("사전 우선순위")
      .setDesc(
        "같은 단어가 여러 사전(dictionary_id)에 있을 때 어떤 사전을 우선 보여줄지 정합니다. " +
          "dictionary_id를 쉼표로 구분해 우선순위 순서대로 입력하세요 (예: 2,5,1). " +
          "앞 순번 사전에 해당 단어가 없으면 다음 순번 사전을 확인하고, 목록의 모든 사전에 없으면 찾은 결과를 전부 보여줍니다.",
      )
      .addText((text) =>
        text
          .setPlaceholder("예: 2,5,1")
          .setValue(this.plugin.settings.dictionaryPriority.join(","))
          .onChange(async (value) => {
            this.plugin.settings.dictionaryPriority = value
              .split(",")
              .map((id) => id.trim())
              .filter((id) => id.length > 0);
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: "노트 문법" });

    new Setting(containerEl)
      .setName("구분자")
      .setDesc('노트에서 사전 용어를 감쌀 구분자입니다. 기본값 "::" 사용 시 ::단어:: 형태로 작성합니다.')
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.termDelimiter)
          .setValue(this.plugin.settings.termDelimiter)
          .onChange(async (value) => {
            const trimmed = value.trim();
            this.plugin.settings.termDelimiter = trimmed || DEFAULT_SETTINGS.termDelimiter;
            await this.plugin.saveSettings();
            this.plugin.refreshEditorExtensions();
          }),
      );

    containerEl.createEl("h3", { text: "캐시" });

    new Setting(containerEl)
      .setName("캐시 유지 시간 (분)")
      .setDesc("동일한 단어를 이 시간 동안 다시 조회하지 않고 캐시된 결과를 사용합니다.")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.cacheTtlMinutes)).onChange(async (value) => {
          const parsed = Number(value);
          if (!Number.isNaN(parsed) && parsed >= 0) {
            this.plugin.settings.cacheTtlMinutes = parsed;
            await this.plugin.saveSettings();
          }
        }),
      );
  }
}
