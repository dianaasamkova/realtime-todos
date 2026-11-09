import type { RouteObject } from "react-router";
import { Layout, NotFoundPage } from "./components/Layout";
import { TodoDetailPage } from "./pages/TodoDetailPage";
import { TodoListPage } from "./pages/TodoListPage";

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <TodoListPage /> },
      { path: "todo/:id", element: <TodoDetailPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
