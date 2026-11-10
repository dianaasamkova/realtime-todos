import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";

export interface Debounced<A extends unknown[]> {
  /** Schedules a call; a newer call within the delay replaces it. */
  schedule(...args: A): void;
  /** Runs the pending call now, if there is one. */
  flush(): void;
  /** Drops the pending call. */
  cancel(): void;
}

/**
 * Debounces `callback` and always calls the latest version of it. The returned object is
 * stable across renders. A pending call is flushed on unmount, so leaving the page never
 * loses the last change; call `cancel()` first when the change no longer matters
 * (e.g. the item was deleted).
 */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delayMs: number,
): Debounced<A> {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const argsRef = useRef<A | undefined>(undefined);

  useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
    argsRef.current = undefined;
  }, []);

  const flush = useCallback(() => {
    const args = argsRef.current;
    if (!args) return;
    cancel();
    callbackRef.current(...args);
  }, [cancel]);

  const schedule = useCallback(
    (...args: A) => {
      cancel();
      argsRef.current = args;
      timerRef.current = setTimeout(flush, delayMs);
    },
    [cancel, flush, delayMs],
  );

  useEffect(() => flush, [flush]);

  return useMemo(() => ({ schedule, flush, cancel }), [schedule, flush, cancel]);
}
