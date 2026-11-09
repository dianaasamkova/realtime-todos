import type { TodoChange } from "../../shared/todo.ts";

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";

export interface RealtimeHandlers {
  onEvent(change: TodoChange): void;
  onStatus(status: ConnectionStatus): void;
  /** Events may have been missed (e.g. a reconnect without recovery); refetch the list. */
  onResync(): void;
}

/** A realtime channel for todo events. socket.io and Centrifugo both implement it. */
export interface RealtimeTransport {
  readonly name: string;
  /** Opens the connection; returns a function that closes it. */
  connect(handlers: RealtimeHandlers): () => void;
}
