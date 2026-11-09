import { io } from "socket.io-client";
import type { TodoEvent } from "../../shared/todo.ts";
import type { RealtimeTransport } from "./types";

const EVENTS: TodoEvent["type"][] = ["todo:created", "todo:updated", "todo:deleted"];

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
        onStatus(reason === "io client disconnect" ? "offline" : "reconnecting");
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
