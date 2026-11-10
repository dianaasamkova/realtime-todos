import http from "node:http";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLIENT_ID_HEADER, type Todo, type TodoChange, type TodoList } from "../contract/todos.ts";
import { createApp } from "./app.ts";
import { attachSocketIo } from "./socketio.ts";
import { createStore } from "./store.ts";

const ORIGIN = "http://localhost:5173";
let server: ReturnType<typeof createApp>;
let baseUrl: string;
const published: TodoChange[] = [];
let socketPublish: ((change: TodoChange) => void) | undefined;

beforeEach(async () => {
  published.length = 0;
  server = createApp({
    store: createStore([{ name: "Seed", description: "First", progress: 10 }]),
    publish: (change) => {
      published.push(change);
      socketPublish?.(change);
    },
    allowedOrigins: [ORIGIN],
    enableTestReset: true,
    centrifugoToken: () => "signed-token",
  });
  socketPublish = attachSocketIo(server, [ORIGIN]);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  socketPublish = undefined;
  await new Promise((resolve) => server.close(resolve));
});

const api = (path: string, init?: RequestInit) =>
  fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
  });

const json = <T = TodoChange>(res: Response) => res.json() as Promise<T>;
const snapshot = async () => json<TodoList>(await api("/api/todos"));
const list = async () => (await snapshot()).todos;

describe("REST API", () => {
  it("lists todos with the revision they reflect", async () => {
    const res = await api("/api/todos");
    expect(res.status).toBe(200);
    const body = await json<TodoList>(res);
    expect(body.todos.map((todo) => todo.name)).toEqual(["Seed"]);
    expect(body.revision).toEqual(expect.any(Number));
    expect(await json<{ revision: number }>(await api("/api/revision"))).toEqual({
      revision: body.revision,
    });
  });

  it("creates a todo with a server id and publishes todo:created", async () => {
    const res = await api("/api/todos", {
      method: "POST",
      body: JSON.stringify({ name: "New", description: "Desc", _id: "client" }),
    });
    const change = await json(res);
    expect(res.status).toBe(201);
    expect(change).toMatchObject({ type: "todo:created", todo: { name: "New" } });
    expect((change as { todo: Todo }).todo._id).not.toBe("client");
    expect(published).toEqual([change]);
  });

  it("answers PATCH with the change it published, at the next revision", async () => {
    const { revision, todos } = await snapshot();
    const res = await api(`/api/todos/${todos[0]._id}`, {
      method: "PATCH",
      body: JSON.stringify({ progress: 70 }),
    });
    const change = await json(res);
    expect(res.status).toBe(200);
    expect(change).toEqual({
      type: "todo:updated",
      todo: { ...todos[0], progress: 70 },
      revision: revision + 1,
    });
    expect(published).toEqual([change]);
  });

  it("deletes a todo and publishes todo:deleted", async () => {
    const [seed] = await list();
    const res = await api(`/api/todos/${seed._id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const change = await json(res);
    expect(change).toMatchObject({ type: "todo:deleted", _id: seed._id });
    expect(published).toEqual([change]);
    expect(await list()).toEqual([]);
  });

  it("answers 404 for unknown ids without publishing", async () => {
    const patch = await api("/api/todos/missing", { method: "PATCH", body: "{}" });
    const del = await api("/api/todos/missing", { method: "DELETE" });
    expect([patch.status, del.status]).toEqual([404, 404]);
    expect(published).toEqual([]);
  });

  it("keeps a multi-byte character that is split across body chunks", async () => {
    const body = Buffer.from(JSON.stringify({ name: "Привет 👋", description: "split" }));
    const cut = body.indexOf(Buffer.from("👋")) + 2; // inside the emoji's 4 bytes
    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request(`${baseUrl}/api/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: ORIGIN },
      });
      req.on("response", (res) => resolve(res.statusCode ?? 0));
      req.on("error", reject);
      req.write(body.subarray(0, cut));
      setTimeout(() => req.end(body.subarray(cut)), 20);
    });
    expect(status).toBe(201);
    expect((await list()).map((todo) => todo.name)).toContain("Привет 👋");
  });

  it("limits the body by bytes, not characters", async () => {
    const res = await api("/api/todos", {
      method: "POST",
      body: JSON.stringify({ name: "Ж".repeat(6_000), description: "y" }), // ~12 KB
    });
    expect(res.status).toBe(413);
  });

  it("answers 413 for an oversized body and keeps serving", async () => {
    const res = await api("/api/todos", {
      method: "POST",
      body: JSON.stringify({ name: "x".repeat(50_000), description: "y" }),
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ message: "request body is too large" });
    expect((await api("/api/todos")).status).toBe(200);
  });

  it("answers 400 for a malformed id and keeps serving", async () => {
    const res = await api("/api/todos/%E0%A4%A", { method: "DELETE" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "invalid todo id" });
    expect((await api("/api/todos")).status).toBe(200);
  });

  it("answers 400 with a message for invalid input", async () => {
    const res = await api("/api/todos", { method: "POST", body: JSON.stringify({ name: "" }) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "name is required" });
    const bad = await api("/api/todos", { method: "POST", body: "{not json" });
    expect(await bad.json()).toEqual({ message: "invalid JSON" });
  });

  it("allows CORS only for configured origins", async () => {
    const allowed = await api("/api/todos");
    expect(allowed.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    const other = await fetch(`${baseUrl}/api/todos`, { headers: { Origin: "https://evil.test" } });
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("restores seed data through the test reset endpoint", async () => {
    await api("/api/todos", {
      method: "POST",
      body: JSON.stringify({ name: "x", description: "y" }),
    });
    expect((await api("/api/test/reset", { method: "POST" })).status).toBe(204);
    expect(await list()).toHaveLength(1);
  });
});

describe("client identity", () => {
  const write = (path: string, method: string, clientId?: string, body?: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        Origin: ORIGIN,
        ...(clientId !== undefined && { [CLIENT_ID_HEADER]: clientId }),
      },
    });

  it("marks each write, in its response and its broadcast, with the writer's id", async () => {
    const created = await json(
      await write("/api/todos", "POST", "tab-a", { name: "N", description: "D" }),
    );
    const id = (created as { todo: Todo }).todo._id;
    const updated = await json(await write(`/api/todos/${id}`, "PATCH", "tab-a", { progress: 5 }));
    const removed = await json(await write(`/api/todos/${id}`, "DELETE", "tab-b"));

    expect(created.origin).toBe("tab-a");
    expect(updated.origin).toBe("tab-a");
    expect(removed.origin).toBe("tab-b");
    expect(published).toEqual([created, updated, removed]);
  });

  it("leaves the origin out when the writer sent no usable id", async () => {
    const none = await json(
      await write("/api/todos", "POST", undefined, { name: "a", description: "b" }),
    );
    const empty = await json(
      await write("/api/todos", "POST", "", { name: "a", description: "b" }),
    );
    const long = await json(
      await write("/api/todos", "POST", "x".repeat(101), { name: "a", description: "b" }),
    );
    for (const change of [none, empty, long]) expect(change).not.toHaveProperty("origin");
  });

  it("does not stamp the list or the revision, and the list needs no id", async () => {
    expect(await snapshot()).not.toHaveProperty("origin");
  });

  it("lets browsers send the id header cross-origin", async () => {
    const preflight = await fetch(`${baseUrl}/api/todos`, {
      method: "OPTIONS",
      headers: { Origin: ORIGIN },
    });
    expect(preflight.headers.get("access-control-allow-headers")).toContain(CLIENT_ID_HEADER);
  });
});

describe("Centrifugo token endpoint", () => {
  it("returns a connection token", async () => {
    const res = await api("/api/centrifugo/token");
    expect(await json<{ token: string }>(res)).toEqual({ token: "signed-token" });
  });
});

describe("socket.io events", () => {
  let client: Socket;
  afterEach(() => client?.disconnect());

  it("broadcasts each write to connected clients", async () => {
    client = connect(baseUrl, { transports: ["websocket"], extraHeaders: { Origin: ORIGIN } });
    await vi.waitFor(() => expect(client.connected).toBe(true));
    const received = new Promise<TodoChange>((resolve) => client.on("todo:created", resolve));

    await api("/api/todos", {
      method: "POST",
      body: JSON.stringify({ name: "A", description: "B" }),
    });

    expect(await received).toMatchObject({
      type: "todo:created",
      todo: { name: "A" },
      revision: expect.any(Number),
    });
  });
});

describe("unusual requests", () => {
  async function withApp(
    options: Partial<Parameters<typeof createApp>[0]>,
    run: (url: string) => Promise<void>,
  ) {
    const app = createApp({
      store: createStore(),
      publish: () => {},
      allowedOrigins: [ORIGIN],
      ...options,
    });
    await new Promise<void>((resolve) => app.listen(0, resolve));
    try {
      await run(`http://localhost:${(app.address() as AddressInfo).port}`);
    } finally {
      await new Promise((resolve) => app.close(resolve));
    }
  }

  it.each(["[]", "null", '"text"'])(
    "rejects the body %s: it must be a JSON object",
    async (body) => {
      const res = await api("/api/todos", { method: "POST", body });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ message: "expected a JSON object" });
    },
  );

  it("answers 404 for endpoints that are switched off", async () => {
    await withApp({}, async (url) => {
      expect((await fetch(`${url}/api/centrifugo/token`)).status).toBe(404);
      expect((await fetch(`${url}/api/test/reset`, { method: "POST" })).status).toBe(404);
    });
  });

  it("answers 404 for unknown paths", async () => {
    expect((await api("/api/nope")).status).toBe(404);
  });

  it("answers 500, and logs, when a write fails unexpectedly", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await withApp(
      {
        publish: () => {
          throw new Error("boom");
        },
      },
      async (url) => {
        const res = await fetch(`${url}/api/todos`, {
          method: "POST",
          body: JSON.stringify({ name: "a", description: "b" }),
        });
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ message: "internal error" });
      },
    );
    expect(error).toHaveBeenCalled();
  });
});
