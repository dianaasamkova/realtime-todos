import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { API_URL } from "./config";
import { NoticesProvider } from "./notices/Notices";
import { createQueryClient } from "./queryClient";
import { RealtimeProvider } from "./realtime/RealtimeProvider";
import { createSocketIoTransport } from "./realtime/socketio";
import type { RealtimeTransport } from "./realtime/types";

const defaultTransport = createSocketIoTransport(API_URL);

interface Props {
  children: ReactNode;
  queryClient?: QueryClient;
  transport?: RealtimeTransport;
}

export function AppProviders({ children, queryClient, transport = defaultTransport }: Props) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <NoticesProvider>
        <RealtimeProvider transport={transport}>{children}</RealtimeProvider>
      </NoticesProvider>
    </QueryClientProvider>
  );
}
