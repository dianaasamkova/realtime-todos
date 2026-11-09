import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Todo } from "../../shared/todo.ts";
import { applyTodoEvent } from "../todos/cache";
import { todosKey } from "../todos/queries";
import type { ConnectionStatus, RealtimeTransport } from "./types";

const StatusContext = createContext<ConnectionStatus>("connecting");

/** Connection status of the realtime transport, for the status indicator. */
export const useConnectionStatus = () => useContext(StatusContext);

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

  useEffect(
    () =>
      transport.connect({
        onEvent: (event) =>
          queryClient.setQueryData<Todo[]>(todosKey, (todos) =>
            todos ? applyTodoEvent(todos, event) : todos,
          ),
        onStatus: setStatus,
        onResync: () => void queryClient.invalidateQueries({ queryKey: todosKey }),
      }),
    [transport, queryClient],
  );

  return <StatusContext.Provider value={status}>{children}</StatusContext.Provider>;
}
