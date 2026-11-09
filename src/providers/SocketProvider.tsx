import React, { useEffect } from "react";
import io from "socket.io-client";
import type { TodoEvent } from "../../shared/todo.ts";
import { API_URL } from "../config";
import { useTodos } from "../context/ToDosContext";
import { applyTodoEvent } from "../todos/cache";

const EVENTS: TodoEvent["type"][] = ["todo:created", "todo:updated", "todo:deleted"];

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { setTodos } = useTodos();

  useEffect(() => {
    const socket = io(API_URL);
    const onEvent = (event: TodoEvent) => setTodos((todos) => applyTodoEvent(todos, event));
    EVENTS.forEach((type) => socket.on(type, onEvent));

    return () => {
      socket.disconnect();
    };
  }, [setTodos]);

  return <>{children}</>;
};
