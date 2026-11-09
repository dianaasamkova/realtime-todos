import type http from "node:http";
import { Server } from "socket.io";
import type { Publish } from "./app.ts";

/**
 * Attaches socket.io to the HTTP server. Connection state recovery replays events a client
 * missed during a short disconnect (up to 2 minutes); after longer gaps the client refetches.
 */
export function attachSocketIo(server: http.Server, allowedOrigins: string[]): Publish {
  const io = new Server(server, {
    cors: { origin: allowedOrigins },
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  });
  return (change) => {
    io.emit(change.type, change);
  };
}
