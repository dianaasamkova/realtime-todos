import type { RealtimeTransport } from "@/features/realtime/types";

/** A transport whose code is downloaded the first time it connects. */
export interface LazyTransport extends RealtimeTransport {
  /** Starts the download now. Resolves once the transport is ready to connect. */
  preload(): Promise<void>;
}

/**
 * Wraps a transport that is loaded with a dynamic `import()`, so its client library stays out
 * of the main bundle and is fetched only on the page that uses it. The page renders at once
 * (the list comes over REST) and shows "connecting" while the code loads; if the download
 * fails the status becomes "offline". Once loaded, connecting is synchronous.
 */
export function lazyTransport(name: string, load: () => Promise<RealtimeTransport>): LazyTransport {
  let loading: Promise<RealtimeTransport> | undefined;
  let loaded: RealtimeTransport | undefined;

  const preload = async () => {
    loading ??= load().then(
      (transport) => (loaded = transport),
      (error) => {
        loading = undefined; // let the next connect try again
        throw error;
      },
    );
    await loading;
  };

  return {
    name,
    preload,
    connect(handlers) {
      if (loaded) return loaded.connect(handlers);

      let closed = false;
      let close: (() => void) | undefined;
      handlers.onStatus("connecting");
      preload().then(
        () => {
          if (!closed) close = loaded?.connect(handlers);
        },
        () => {
          if (!closed) handlers.onStatus("offline");
        },
      );
      return () => {
        closed = true;
        close?.();
      };
    },
  };
}
