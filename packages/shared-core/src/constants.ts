/**
 * Namespacing constant shared by all LBRX plugins.
 * Used as a prefix for localStorage keys, custom CSS classes, and the shared
 * data file so plugins never collide with each other or third-party plugins.
 */
export const LBRX_NAMESPACE = "lbrx";

/**
 * Relative path (inside `.obsidian/`) to the optional shared data file that
 * plugins may use to exchange lightweight runtime data (see docs/ARCHITECTURE.md §5).
 */
export const SHARED_DATA_FILE = "lbrx-shared.json";

/** Plugin IDs, kept in one place so cross-plugin lookups don't use magic strings. */
export const PLUGIN_IDS = {
  samplePlugin: "lbrx-sample-plugin",
} as const;
