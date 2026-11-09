import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import type { Todo } from "../../shared/todo.ts";
import { API_URL } from "../config";

interface TodosContextType {
  todos: Todo[];
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
}

const TodosContext = createContext<TodosContextType>({
  todos: [],
  setTodos: () => {},
});

export const useTodos = () => useContext(TodosContext);

interface TodosProviderProps {
  children: React.ReactNode;
}

export const TodosProvider: React.FC<TodosProviderProps> = ({ children }) => {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    const getTodos = async () => {
      try {
        const { data } = await axios.get<Todo[]>(`${API_URL}/api/todos`);
        setTodos(data);
      } catch (error) {
        console.error("Failed to fetch todos:", error);
      }
    };

    getTodos();
  }, []);

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

  return <TodosContext.Provider value={{ todos, setTodos }}>{children}</TodosContext.Provider>;
};
