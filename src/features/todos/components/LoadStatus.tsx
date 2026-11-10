import type { UseQueryResult } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";

/** Loading and error UI for the todo list. Renders nothing once data is available. */
export function LoadStatus({ query }: { query: UseQueryResult<unknown> }) {
  if (query.isPending && !query.isError) {
    return (
      <p role="status" className="py-8 text-center text-sm text-slate-600">
        Loading todos…
      </p>
    );
  }
  if (query.isError && !query.data) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-200"
      >
        <span>{`Couldn't load todos. ${query.error.message}`.trim()}</span>
        <Button
          size="sm"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }
  return null;
}
