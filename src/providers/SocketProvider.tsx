import React, { useEffect } from "react";
import io from "socket.io-client";
import type { ITodo } from "../pages/HomePage/HomePage";
import { useTodos } from "../context/ToDosContext";

const SOCKET_URL = "http://localhost:8000";

enum SocketEvents {
  UpdateProgress = "update-todo-progress",
}

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { setTodos } = useTodos();

  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on(SocketEvents.UpdateProgress, (updatedTodo: Pick<ITodo, "_id" | "progress">) => {
      setTodos((prevTodos: ITodo[]) =>
        prevTodos.map((todo: ITodo) =>
          todo._id === updatedTodo._id ? { ...todo, progress: updatedTodo.progress } : todo,
        ),
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [setTodos]);

  return <>{children}</>;
};
