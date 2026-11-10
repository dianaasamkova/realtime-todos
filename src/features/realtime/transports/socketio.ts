import { io } from "socket.io-client";
import type { TodoChange } from "@contract/todos";
import type { RealtimeTransport } from "@/features/realtime/types";

const EVENTS: TodoChange["type"][] = ["todo:created", "todo:updated", "todo:deleted"];

/**
 * socket.io transport. The server enables connection state recovery, so after a short
 * disconnect `socket.recovered` is true and missed events are replayed. Otherwise
 * (first connect, or a longer gap) the client asks for a resync.
 */
export function createSocketIoTransport(url: string): RealtimeTransport {
  return {
    name: "socket.io",
    connect({ onEvent, onStatus, onResync }) {
      const socket = io(url);
      onStatus("connecting");

      EVENTS.forEach((type) => socket.on(type, onEvent));
      socket.on("connect", () => {
        onStatus("live");
        if (!socket.recovered) onResync();
      });
      socket.on("disconnect", (reason) => {
        if (reason === "io client disconnect") return onStatus("offline");
        // socket.io retries on its own except when the server closed the connection.
        if (reason === "io server disconnect") socket.connect();
        onStatus("reconnecting");
      });
      socket.on("connect_error", () => {
        onStatus(socket.active ? "reconnecting" : "offline");
      });

      return () => {
        socket.disconnect();
      };
    },
  };
}
