import { Alert, Button, Typography } from "@mui/material";
import type { LoadState } from "../../context/ToDosContext";

/** Loading and error UI for the todo list. Renders nothing once the list is ready. */
export function LoadStatus({ load, onRetry }: { load: LoadState; onRetry: () => void }) {
  if (load.status === "loading") {
    return (
      <Typography role="status" variant="body2">
        Loading todos…
      </Typography>
    );
  }
  if (load.status === "error") {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        }
      >
        {`Couldn't load todos. ${load.message}`.trim()}
      </Alert>
    );
  }
  return null;
}
