/**
 * Shape of the optional cross-plugin shared data file (lbrx-shared.json).
 * Each plugin should only read/write its own namespaced key.
 */
export interface LbrxSharedData {
  version: number;
  [pluginId: string]: unknown;
}

/** Base interface every LBRX plugin settings object should extend. */
export interface BaseLbrxSettings {
  /** Schema version, used for migrations. */
  settingsVersion: number;
}
