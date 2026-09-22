/**
 * Shallow-merges default settings with persisted data, guarding against
 * missing keys after a plugin update adds new settings fields.
 */
export function mergeSettings<T extends object>(defaults: T, saved: Partial<T> | undefined | null): T {
  return { ...defaults, ...(saved ?? {}) };
}

/** Simple debounce helper, used e.g. for settings-tab autosave. */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number,
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}
