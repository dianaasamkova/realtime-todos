import { QueryClient, type DefaultOptions } from "@tanstack/react-query";

export function createQueryClient(overrides: DefaultOptions["queries"] = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Realtime events keep the cache current; a refetch happens on reconnect instead.
        staleTime: 60_000,
        retry: 2,
        ...overrides,
      },
    },
  });
}
