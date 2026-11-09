// Mock backend: in-memory REST API plus realtime events. Data resets on restart.
import { createApp, type Publish } from "./app.ts";
import { attachSocketIo } from "./socketio.ts";
import { createStore } from "./store.ts";

const PORT = Number(process.env.PORT) || 8000;
const allowedOrigins = (process.env.CLIENT_ORIGINS ?? "http://localhost:5173,http://localhost:4173")
  .split(",")
  .map((origin) => origin.trim());

const publishers: Publish[] = [];
const server = createApp({
  store: createStore(),
  publish: (event) => publishers.forEach((publish) => publish(event)),
  allowedOrigins,
  enableTestReset: process.env.ENABLE_TEST_RESET === "1",
});
publishers.push(attachSocketIo(server, allowedOrigins));

server.listen(PORT, () => {
  console.log(`Mock API on http://localhost:${PORT} (CORS: ${allowedOrigins.join(", ")})`);
});
