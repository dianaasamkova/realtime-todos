import http from "node:http";
import type { NewTodo, TodoChange, TodoPatch } from "../contract/todos.ts";
import { ValidationError, type Store } from "./store.ts";

export type Publish = (change: TodoChange) => void;

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

/** Reads a JSON body of at most MAX_BODY_BYTES, decoding it only once it is complete. */
function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size <= MAX_BODY_BYTES) return void chunks.push(chunk);
      // Stop keeping the body: drop what we have and let the rest drain unbuffered.
      chunks.length = 0;
      req.off("data", onData);
      req.resume();
      reject(new ValidationError("request body is too large", 413));
    };
    req.on("data", onData);
    req.on("end", () => {
      // Decoding the whole body at once keeps multi-byte characters split across chunks intact.
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new ValidationError("invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

/** Decodes the id path segment; malformed percent-encoding is a client error, not a crash. */
function decodeId(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw new ValidationError("invalid todo id");
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError("expected a JSON object");
  }
  return value as Record<string, unknown>;
}

/**
 * REST API for todos. Every write answers with the change it published (see TodoChange):
 *   GET    /api/todos            -> TodoList { revision, todos }
 *   GET    /api/revision         -> { revision }
 *   POST   /api/todos            -> 201 TodoChange  (todo:created)
 *   PATCH  /api/todos/:id        -> 200 TodoChange  (todo:updated)
 *   DELETE /api/todos/:id        -> 200 TodoChange  (todo:deleted)
 *   GET    /api/centrifugo/token -> { token }       (when Centrifugo is configured)
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

    try {
      if (req.method === "OPTIONS") return send(204);

      const { pathname } = new URL(req.url ?? "/", "http://localhost");
      const idMatch = pathname.match(/^\/api\/todos\/([^/]+)$/);
      const id = idMatch ? decodeId(idMatch[1]) : undefined;

      if (pathname === "/api/todos" && req.method === "GET") return send(200, store.snapshot());

      if (pathname === "/api/revision" && req.method === "GET") {
        return send(200, { revision: store.revision() });
      }

      if (pathname === "/api/todos" && req.method === "POST") {
        const change = store.create(asObject(await readJson(req)) as unknown as NewTodo);
        publish(change);
        return send(201, change);
      }

      if (id && req.method === "PATCH") {
        const change = store.update(id, asObject(await readJson(req)) as TodoPatch);
        if (!change) return send(404, { message: "todo not found" });
        publish(change);
        return send(200, change);
      }

      if (id && req.method === "DELETE") {
        const change = store.remove(id);
        if (!change) return send(404, { message: "todo not found" });
        publish(change);
        return send(200, change);
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
      if (error instanceof ValidationError) return send(error.status, { message: error.message });
      console.error(error);
      send(500, { message: "internal error" });
    }
  });
}
