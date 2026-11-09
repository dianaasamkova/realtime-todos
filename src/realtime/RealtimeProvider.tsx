import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Todo, TodoEvent } from "../../shared/todo.ts";
import { applyTodoEvent } from "../todos/cache";
import { recordEvent } from "../todos/journal";
import { createKey, todosKey, updateKey, withPendingEdits } from "../todos/queries";
import { RealtimeContext } from "./context";
import type { ConnectionStatus, RealtimeTransport } from "./types";

export { useRealtime, useRemoteHighlight } from "./context";

const HIGHLIGHT_MS = 2500;
/** The first list load waits at most this long for the realtime connection. */
const FIRST_LOAD_WAIT_MS = 1000;

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
  const [ready, setReady] = useState(false);
  if (!ready && status !== "connecting") setReady(true);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), FIRST_LOAD_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

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
        onResync: () => {
          // Nothing loaded or loading yet: the first load starts now that we're connected,
          // so it already includes everything up to this point.
          const state = queryClient.getQueryState(todosKey);
          if (state?.data === undefined && state?.fetchStatus !== "fetching") return;
          void queryClient.invalidateQueries({ queryKey: todosKey });
        },
      }),
    [transport, queryClient, highlight],
  );

  return (
    <RealtimeContext.Provider
      value={{ transportName: transport.name, status, ready, remoteChanges }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}
