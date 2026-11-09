import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { TodoChange } from "../../shared/todo.ts";
import { applyServerChange, createKey, resync, updateKey } from "../todos/queries";
import { RealtimeContext } from "./context";
import type { ConnectionStatus, RealtimeTransport } from "./types";

export { useRealtime, useRemoteHighlight } from "./context";

const HIGHLIGHT_MS = 2500;

/** True if this tab has a request in flight that this change is the echo of. */
function isOwnChange(client: QueryClient, change: TodoChange) {
  if (change.type === "todo:created") return client.isMutating({ mutationKey: createKey }) > 0;
  if (change.type === "todo:deleted") return true;
  return (
    client.isMutating({
      mutationKey: updateKey,
      predicate: (mutation) =>
        (mutation.state.variables as { id?: string } | undefined)?.id === change.todo._id,
    }) > 0
  );
}

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

  const highlight = useCallback((id: string) => {
    setRemoteChanges((current) => new Set(current).add(id));
    setTimeout(() => {
      setRemoteChanges((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }, HIGHLIGHT_MS);
  }, []);

  useEffect(
    () =>
      transport.connect({
        onEvent: (change) => {
          const shown = applyServerChange(queryClient, change);
          if (shown && change.type !== "todo:deleted" && !isOwnChange(queryClient, change)) {
            highlight(change.todo._id);
          }
        },
        onStatus: setStatus,
        onResync: () => void resync(queryClient),
      }),
    [transport, queryClient, highlight],
  );

  return (
    <RealtimeContext.Provider value={{ transportName: transport.name, status, remoteChanges }}>
      {children}
    </RealtimeContext.Provider>
  );
}
