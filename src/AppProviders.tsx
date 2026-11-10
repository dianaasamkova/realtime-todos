import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { NoticesProvider } from "@/notices/Notices";
import { createQueryClient } from "./queryClient";

interface Props {
  children: ReactNode;
  queryClient?: QueryClient;
}

/** App-wide providers. The realtime transport is chosen per route (see routes.tsx). */
export function AppProviders({ children, queryClient }: Props) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <NoticesProvider>{children}</NoticesProvider>
    </QueryClientProvider>
  );
}
