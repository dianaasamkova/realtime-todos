import { Alert, Button, Typography } from "@mui/material";
import type { UseQueryResult } from "@tanstack/react-query";

/** Loading and error UI for the todo list. Renders nothing once data is available. */
export function LoadStatus({ query }: { query: UseQueryResult<unknown> }) {
  if (query.isPending && !query.isError) {
    return (
      <Typography role="status" variant="body2">
        Loading todos…
      </Typography>
    );
  }
  if (query.isError && !query.data) {
    return (
      <Alert
        severity="error"
        action={
          <Button
            color="inherit"
            size="small"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Retry
          </Button>
        }
      >
        {`Couldn't load todos. ${query.error.message}`.trim()}
      </Alert>
    );
  }
  return null;
}
