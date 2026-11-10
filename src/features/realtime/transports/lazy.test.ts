import { describe, expect, it, vi } from "vitest";
import type { RealtimeHandlers, RealtimeTransport } from "@/features/realtime/types";
import { lazyTransport } from "./lazy";

const handlers = (): RealtimeHandlers => ({
  onEvent: vi.fn(),
  onStatus: vi.fn(),
  onResync: vi.fn(),
});

/** A loader that resolves or fails when the test says so. */
function deferredLoad() {
  const inner = { name: "Inner", connect: vi.fn(() => close) } satisfies RealtimeTransport;
  const close = vi.fn();
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const load = vi.fn(
    () =>
      new Promise<RealtimeTransport>((res, rej) => {
        resolve = () => res(inner);
        reject = rej;
      }),
  );
  return { load, inner, close, resolve: () => resolve(), reject: (e: Error) => reject(e) };
}

describe("lazyTransport", () => {
  it("reports connecting while the code downloads, then connects the real transport", async () => {
    const { load, inner, resolve } = deferredLoad();
    const transport = lazyTransport("Lazy", load);
    const h = handlers();

    transport.connect(h);
    expect(h.onStatus).toHaveBeenCalledWith("connecting");
    expect(inner.connect).not.toHaveBeenCalled();

    resolve();
    await vi.waitFor(() => expect(inner.connect).toHaveBeenCalledWith(h));
    expect(transport.name).toBe("Lazy");
  });

  it("closes the real connection when closed after loading", async () => {
    const { load, close, resolve } = deferredLoad();
    const transport = lazyTransport("Lazy", load);
    const disconnect = transport.connect(handlers());
    resolve();
    await transport.preload();

    disconnect();
    expect(close).toHaveBeenCalledOnce();
  });

  it("never connects if it is closed before the download finishes", async () => {
    const { load, inner, resolve } = deferredLoad();
    const transport = lazyTransport("Lazy", load);
    const disconnect = transport.connect(handlers());

    disconnect();
    resolve();
    await transport.preload();

    expect(inner.connect).not.toHaveBeenCalled();
  });

  it("downloads once and connects synchronously afterwards", async () => {
    const { load, inner, resolve } = deferredLoad();
    const transport = lazyTransport("Lazy", load);
    const first = transport.preload();
    const second = transport.preload();
    resolve();
    await Promise.all([first, second]);

    transport.connect(handlers());
    expect(inner.connect).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledOnce();
  });

  it("goes offline if the download fails, and tries again on the next connect", async () => {
    const failing = deferredLoad();
    const transport = lazyTransport("Lazy", failing.load);
    const h = handlers();

    transport.connect(h);
    failing.reject(new Error("chunk failed"));
    await vi.waitFor(() => expect(h.onStatus).toHaveBeenLastCalledWith("offline"));

    transport.connect(handlers());
    expect(failing.load).toHaveBeenCalledTimes(2);
  });

  it("does not report a failed download after being closed", async () => {
    const failing = deferredLoad();
    const transport = lazyTransport("Lazy", failing.load);
    const h = handlers();

    transport.connect(h)();
    failing.reject(new Error("chunk failed"));
    await transport.preload().catch(() => {});

    expect(h.onStatus).not.toHaveBeenCalledWith("offline");
  });
});
