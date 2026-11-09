import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Todo } from "../../shared/todo.ts";
import { todosApi } from "../api/todos";

export type LoadState =
  { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

interface TodosContextType {
  todos: Todo[];
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  load: LoadState;
  reload: () => void;
}

const TodosContext = createContext<TodosContextType>({
  todos: [],
  setTodos: () => {},
  load: { status: "loading" },
  reload: () => {},
});

export const useTodos = () => useContext(TodosContext);

interface TodosProviderProps {
  children: React.ReactNode;
}

/**
 *  Context is chosen for simplicity and ease of use. Since this is a small project, the Redux or MobX may not be necessary.
 *  Context API provides a straightforward way to manage state without the need for additional libraries, making it a suitable choice for this project.
 *
 *  Redux is a popular choice, especially when dealing with large-scale applications with deeply nested component trees.
 *  By creating a Redux channel, real-time data updates from the server can be dispatched to the store.
 *
 * MobX is another viable option known for its simplicity and flexibility.
 * To integrate MobX with WebSocket/socket.io, we can utilize MobX reactions to observe changes in socket data and update the MobX state accordingly.
 */
export const TodosProvider: React.FC<TodosProviderProps> = ({ children }) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  // Bumped by Retry; each change starts a new fetch.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    todosApi.list().then(
      (list) => {
        if (ignore) return;
        setTodos(list);
        setLoad({ status: "ready" });
      },
      (error: unknown) => {
        if (ignore) return;
        setLoad({ status: "error", message: error instanceof Error ? error.message : "" });
      },
    );
    return () => {
      ignore = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setLoad({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return (
    <TodosContext.Provider value={{ todos, setTodos, load, reload }}>
      {children}
    </TodosContext.Provider>
  );
};
