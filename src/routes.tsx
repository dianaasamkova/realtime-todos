import type { RouteObject } from "react-router";
import HomePage from "./pages/HomePage/HomePage";
import TodoPage from "./pages/ToDoPage/ToDoPage";

export const routes: RouteObject[] = [
  { path: "/", element: <HomePage /> },
  { path: "todo/:id", element: <TodoPage /> },
];
