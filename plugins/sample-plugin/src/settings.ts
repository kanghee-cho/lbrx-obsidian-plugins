import type { BaseLbrxSettings } from "@lbrx/shared-core";

export interface SamplePluginSettings extends BaseLbrxSettings {
  greeting: string;
}

export const DEFAULT_SETTINGS: SamplePluginSettings = {
  settingsVersion: 1,
  greeting: "Hello from LBRX!",
};
