import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

export interface ITodo {
  _id: string;
  name: string;
  description: string;
  progress: number;
}

interface TodosContextType {
  todos: ITodo[];
  setTodos: React.Dispatch<React.SetStateAction<ITodo[]>>;
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
  const [todos, setTodos] = useState<ITodo[]>([]);

  useEffect(() => {
    const getTodos = async () => {
      try {
        const { data } = await axios.get<ITodo[]>("http://localhost:8000/api/todos");
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
