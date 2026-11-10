import type { RouteObject } from "react-router";
import { Layout } from "@/app/layout/Layout";
import { NotFoundPage } from "@/app/layout/NotFoundPage";
import { TodoDetailPage } from "@/features/todos/pages/TodoDetailPage";
import { TodoListPage } from "@/features/todos/pages/TodoListPage";
import { RealtimeProvider } from "@/features/realtime/RealtimeProvider";
import { transports } from "@/features/realtime/transports";
import type { RealtimeTransport } from "@/features/realtime/types";

/** Pages are the same under each transport; links inside them are relative. */
const pages: RouteObject[] = [
  { index: true, element: <TodoListPage /> },
  { path: "todo/:id", element: <TodoDetailPage /> },
  { path: "*", element: <NotFoundPage /> },
];

const scope = (path: string, transport: RealtimeTransport): RouteObject => ({
  path,
  element: (
    <RealtimeProvider transport={transport}>
      <Layout />
    </RealtimeProvider>
  ),
  children: pages,
});

export const routes: RouteObject[] = [
  scope("/", transports.socketio),
  scope("/centrifugo", transports.centrifugo),
];
