// Mock backend: in-memory REST API plus realtime events over socket.io and Centrifugo.
// Data resets on restart. The Centrifugo defaults match centrifugo/config.json and are for
// local development only.
import { randomUUID } from "node:crypto";
import { createApp, type Publish } from "./app.ts";
import { createCentrifugoPublisher, signConnectionToken } from "./centrifugo.ts";
import { attachSocketIo } from "./socketio.ts";
import { createStore } from "./store.ts";

const env = process.env;
const PORT = Number(env.PORT) || 8000;
const allowedOrigins = (env.CLIENT_ORIGINS ?? "http://localhost:5173,http://localhost:4173")
  .split(",")
  .map((origin) => origin.trim());
// Set CENTRIFUGO_API_URL to an empty string to run without Centrifugo.
const centrifugoApiUrl = env.CENTRIFUGO_API_URL ?? "http://localhost:8001";
const centrifugoApiKey = env.CENTRIFUGO_API_KEY ?? "local-dev-api-key";
const centrifugoSecret = env.CENTRIFUGO_TOKEN_SECRET ?? "local-dev-token-secret";

const publishers: Publish[] = [];
const server = createApp({
  store: createStore(),
  publish: (event) => publishers.forEach((publish) => publish(event)),
  allowedOrigins,
  enableTestReset: env.ENABLE_TEST_RESET === "1",
  centrifugoToken: centrifugoApiUrl
    ? () => signConnectionToken(centrifugoSecret, { sub: `guest-${randomUUID()}` })
    : undefined,
});
publishers.push(attachSocketIo(server, allowedOrigins));
if (centrifugoApiUrl) {
  publishers.push(
    createCentrifugoPublisher({ apiUrl: centrifugoApiUrl, apiKey: centrifugoApiKey }),
  );
}

server.listen(PORT, () => {
  console.log(`Mock API on http://localhost:${PORT} (CORS: ${allowedOrigins.join(", ")})`);
  console.log(`Centrifugo: ${centrifugoApiUrl || "disabled"}`);
});
