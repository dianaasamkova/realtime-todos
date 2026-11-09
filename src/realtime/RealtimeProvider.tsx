import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Todo, TodoEvent } from "../../shared/todo.ts";
import { applyTodoEvent } from "../todos/cache";
import { recordEvent } from "../todos/journal";
import { createKey, todosKey, updateKey, withPendingEdits } from "../todos/queries";
import type { ConnectionStatus, RealtimeTransport } from "./types";

interface RealtimeState {
  transportName: string;
  status: ConnectionStatus;
  /** Todos recently changed by someone else; cards highlight them briefly. */
  remoteChanges: ReadonlySet<string>;
}

const RealtimeContext = createContext<RealtimeState>({
  transportName: "",
  status: "connecting",
  remoteChanges: new Set(),
});

export const useRealtime = () => useContext(RealtimeContext);
export const useRemoteHighlight = (id: string) => useContext(RealtimeContext).remoteChanges.has(id);

const HIGHLIGHT_MS = 2500;

/** True if this tab has a request in flight that this event is the echo of. */
function isOwnChange(client: QueryClient, event: TodoEvent) {
  if (event.type === "todo:created") return client.isMutating({ mutationKey: createKey }) > 0;
  if (event.type === "todo:deleted") return true;
  return (
    client.isMutating({
      mutationKey: updateKey,
      predicate: (mutation) =>
        (mutation.state.variables as { id?: string } | undefined)?.id === event.todo._id,
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
        onEvent: (event) => {
          // Recorded even before the list has loaded, so the first response gets it replayed.
          recordEvent(queryClient, event);
          const before = queryClient.getQueryData<Todo[]>(todosKey);
          if (!before) return;
          const after = applyTodoEvent(
            before,
            event.type === "todo:deleted"
              ? event
              : { ...event, todo: withPendingEdits(queryClient, event.todo) },
          );
          if (after === before) return;
          queryClient.setQueryData(todosKey, after);
          if (event.type !== "todo:deleted" && !isOwnChange(queryClient, event)) {
            highlight(event.todo._id);
          }
        },
        onStatus: setStatus,
        onResync: () => void queryClient.invalidateQueries({ queryKey: todosKey }),
      }),
    [transport, queryClient, highlight],
  );

  return (
    <RealtimeContext.Provider value={{ transportName: transport.name, status, remoteChanges }}>
      {children}
    </RealtimeContext.Provider>
  );
}
