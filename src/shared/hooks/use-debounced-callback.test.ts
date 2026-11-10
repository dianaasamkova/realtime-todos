import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedCallback } from "./use-debounced-callback";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDebouncedCallback", () => {
  it("calls once with the last arguments after the delay", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 1000));

    result.current.schedule(1);
    vi.advanceTimersByTime(600);
    result.current.schedule(2);
    vi.advanceTimersByTime(999);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledExactlyOnceWith(2);
  });

  it("keeps the same function across renders and calls the latest callback", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useDebouncedCallback(cb, 1000), {
      initialProps: { cb: first },
    });
    const debounced = result.current;

    debounced.schedule("x");
    rerender({ cb: second });
    expect(result.current).toBe(debounced);

    vi.advanceTimersByTime(1000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("x");
  });

  it("flush() runs the pending call immediately, and only once", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 1000));

    result.current.schedule("now");
    result.current.flush();
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledExactlyOnceWith("now");
  });

  it("cancel() drops the pending call", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 1000));

    result.current.schedule("dropped");
    result.current.cancel();
    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
  });

  it("flushes a pending call on unmount", () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 1000));

    result.current.schedule("last");
    unmount();
    expect(callback).toHaveBeenCalledExactlyOnceWith("last");
  });

  it("does nothing on unmount when nothing is pending", () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useDebouncedCallback(callback, 1000));
    unmount();
    expect(callback).not.toHaveBeenCalled();
  });
});
