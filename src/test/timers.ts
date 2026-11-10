import { vi } from "vitest";

/**
 * Watches timers started with exactly `delayMs`. The returned set holds the ones still
 * pending: neither fired nor cleared. Spies are undone after each test (`restoreMocks`).
 */
export function watchTimers(delayMs: number) {
  const pending = new Set<unknown>();
  const realSet = globalThis.setTimeout;
  const realClear = globalThis.clearTimeout;
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((
    callback: (...args: unknown[]) => void,
    ms?: number,
    ...args: unknown[]
  ) => {
    const id = realSet(() => {
      pending.delete(id);
      callback(...args);
    }, ms);
    if (ms === delayMs) pending.add(id);
    return id;
  }) as typeof setTimeout);
  vi.spyOn(globalThis, "clearTimeout").mockImplementation(((id?: unknown) => {
    pending.delete(id);
    realClear(id as Parameters<typeof clearTimeout>[0]);
  }) as typeof clearTimeout);
  return pending;
}
