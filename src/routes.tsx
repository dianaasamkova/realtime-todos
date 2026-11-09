import type { RouteObject } from "react-router";
import { Layout, NotFoundPage } from "./components/Layout";
import { TodoDetailPage } from "./pages/TodoDetailPage";
import { TodoListPage } from "./pages/TodoListPage";
import { RealtimeProvider } from "./realtime/RealtimeProvider";
import { transports } from "./realtime/transports";
import type { RealtimeTransport } from "./realtime/types";

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
