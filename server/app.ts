import http from "node:http";
import type { NewTodo, TodoEvent, TodoPatch } from "../shared/todo.ts";
import { ValidationError, type Store } from "./store.ts";

export type Publish = (event: TodoEvent) => void;

interface AppOptions {
  store: Store;
  /** Called after every successful write; fans the event out to realtime transports. */
  publish: Publish;
  allowedOrigins: string[];
  /** Exposes POST /api/test/reset so e2e tests start from the seed data. */
  enableTestReset?: boolean;
  /** Issues Centrifugo connection tokens at GET /api/centrifugo/token. */
  centrifugoToken?: () => string;
}

const MAX_BODY_BYTES = 10_000;

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => {
      raw += chunk;
      if (raw.length > MAX_BODY_BYTES) reject(new ValidationError("request body is too large"));
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new ValidationError("invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError("expected a JSON object");
  }
  return value as Record<string, unknown>;
}

/**
 * REST API for todos:
 *   GET    /api/todos       -> Todo[]
 *   POST   /api/todos       -> 201 Todo        publishes todo:created
 *   PATCH  /api/todos/:id   -> 200 Todo        publishes todo:updated
 *   DELETE /api/todos/:id   -> 204             publishes todo:deleted
 *   GET    /api/centrifugo/token -> { token } (when Centrifugo is configured)
 */
export function createApp({
  store,
  publish,
  allowedOrigins,
  enableTestReset,
  centrifugoToken,
}: AppOptions) {
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const headers: Record<string, string> = { "Content-Type": "application/json", Vary: "Origin" };
    if (origin && allowedOrigins.includes(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Methods"] = "GET,POST,PATCH,DELETE,OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Content-Type";
    }
    const send = (status: number, body?: unknown) => {
      res.writeHead(status, headers);
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };

    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    const idMatch = pathname.match(/^\/api\/todos\/([^/]+)$/);
    const id = idMatch ? decodeURIComponent(idMatch[1]) : undefined;

    try {
      if (req.method === "OPTIONS") return send(204);

      if (pathname === "/api/todos" && req.method === "GET") return send(200, store.list());

      if (pathname === "/api/todos" && req.method === "POST") {
        const todo = store.create(asObject(await readJson(req)) as unknown as NewTodo);
        publish({ type: "todo:created", todo });
        return send(201, todo);
      }

      if (id && req.method === "PATCH") {
        const todo = store.update(id, asObject(await readJson(req)) as TodoPatch);
        if (!todo) return send(404, { message: "todo not found" });
        publish({ type: "todo:updated", todo });
        return send(200, todo);
      }

      if (id && req.method === "DELETE") {
        if (!store.remove(id)) return send(404, { message: "todo not found" });
        publish({ type: "todo:deleted", _id: id });
        return send(204);
      }

      if (centrifugoToken && pathname === "/api/centrifugo/token" && req.method === "GET") {
        return send(200, { token: centrifugoToken() });
      }

      if (enableTestReset && pathname === "/api/test/reset" && req.method === "POST") {
        store.reset();
        return send(204);
      }

      send(404, { message: "not found" });
    } catch (error) {
      if (error instanceof ValidationError) return send(400, { message: error.message });
      console.error(error);
      send(500, { message: "internal error" });
    }
  });
}
