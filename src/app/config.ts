/** Base URL of the REST API and the socket.io server. */
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** Centrifugo WebSocket endpoint. */
export const CENTRIFUGO_URL =
  import.meta.env.VITE_CENTRIFUGO_URL ?? "ws://localhost:8001/connection/websocket";
