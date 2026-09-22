import type { Vault } from "obsidian";
import { SHARED_DATA_FILE } from "@lbrx/shared-core";
import type { LbrxSharedData } from "@lbrx/shared-core";

/**
 * Reads the shared cross-plugin data file from `.obsidian/lbrx-shared.json`.
 * Returns an empty envelope if the file doesn't exist yet (e.g. no LBRX
 * plugin has written to it before). Safe to call from any plugin.
 */
export async function readSharedData(vault: Vault): Promise<LbrxSharedData> {
  const path = `${vault.configDir}/${SHARED_DATA_FILE}`;
  const exists = await vault.adapter.exists(path);
  if (!exists) {
    return { version: 1 };
  }
  const raw = await vault.adapter.read(path);
  try {
    return JSON.parse(raw) as LbrxSharedData;
  } catch {
    return { version: 1 };
  }
}

/**
 * Merges `patch` under the plugin's own namespaced key and persists it.
 * Plugins must only write to their own `pluginId` key to avoid clobbering
 * data owned by other plugins.
 */
export async function writeSharedData(
  vault: Vault,
  pluginId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const path = `${vault.configDir}/${SHARED_DATA_FILE}`;
  const current = await readSharedData(vault);
  const next: LbrxSharedData = {
    ...current,
    [pluginId]: { ...(current[pluginId] as Record<string, unknown> | undefined), ...patch },
  };
  await vault.adapter.write(path, JSON.stringify(next, null, 2));
}
