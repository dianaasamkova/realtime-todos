import type { ReactNode } from "react";
import { TodosProvider } from "./context/ToDosContext";
import { SocketProvider } from "./providers/SocketProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TodosProvider>
      <SocketProvider>{children}</SocketProvider>
    </TodosProvider>
  );
}
