import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CLIENT_ID } from "@/features/todos/api";
import { applyServerChange, cancelGapCheck, resync } from "@/features/todos/queries";
import { RealtimeContext } from "./context";
import type { ConnectionStatus, RealtimeTransport } from "./types";

export { useRealtime, useRemoteHighlight } from "./context";

const HIGHLIGHT_MS = 2500;

/** Keeps the todos query cache in sync with a realtime transport. */
export function RealtimeProvider({
  transport,
  children,
}: {
  transport: RealtimeTransport;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [remoteChanges, setRemoteChanges] = useState<ReadonlySet<string>>(new Set());
  const highlightTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // A change highlights for HIGHLIGHT_MS after the latest one; a newer change to the same todo
  // restarts the timer instead of being cut short by the older one.
  const highlight = useCallback((id: string) => {
    const timers = highlightTimers.current;
    clearTimeout(timers.get(id));
    setRemoteChanges((current) => new Set(current).add(id));
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        setRemoteChanges((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }, HIGHLIGHT_MS),
    );
  }, []);

  useEffect(() => {
    const timers = highlightTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const disconnect = transport.connect({
      onEvent: (change) => {
        const shown = applyServerChange(queryClient, change);
        // Our own writes echo back with our id; only other people's changes are highlighted.
        // (A delete leaves nothing to highlight.)
        if (shown && change.type !== "todo:deleted" && change.origin !== CLIENT_ID) {
          highlight(change.todo._id);
        }
      },
      onStatus: setStatus,
      onResync: () => void resync(queryClient),
    });
    return () => {
      disconnect();
      // A pending gap check would reload a list nobody is showing; the next connection's resync
      // notices a leftover gap on its own.
      cancelGapCheck(queryClient);
    };
  }, [transport, queryClient, highlight]);

  return (
    <RealtimeContext.Provider value={{ transportName: transport.name, status, remoteChanges }}>
      {children}
    </RealtimeContext.Provider>
  );
}
