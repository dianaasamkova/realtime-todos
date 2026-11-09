// @vitest-environment node
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Todo, TodoEvent } from "../shared/todo.ts";
import { createApp } from "./app.ts";
import { attachSocketIo } from "./socketio.ts";
import { createStore } from "./store.ts";

const ORIGIN = "http://localhost:5173";
let server: ReturnType<typeof createApp>;
let baseUrl: string;
const published: TodoEvent[] = [];
let socketPublish: ((event: TodoEvent) => void) | undefined;

beforeEach(async () => {
  published.length = 0;
  server = createApp({
    store: createStore([{ name: "Seed", description: "First", progress: 10 }]),
    publish: (event) => {
      published.push(event);
      socketPublish?.(event);
    },
    allowedOrigins: [ORIGIN],
    enableTestReset: true,
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

const json = <T = Todo>(res: Response) => res.json() as Promise<T>;
const list = async () => json<Todo[]>(await api("/api/todos"));

describe("REST API", () => {
  it("lists todos", async () => {
    const res = await api("/api/todos");
    expect(res.status).toBe(200);
    expect((await json<Todo[]>(res)).map((todo) => todo.name)).toEqual(["Seed"]);
  });

  it("creates a todo with a server id and publishes todo:created", async () => {
    const res = await api("/api/todos", {
      method: "POST",
      body: JSON.stringify({ name: "New", description: "Desc", _id: "client" }),
    });
    const todo = await json(res);
    expect(res.status).toBe(201);
    expect(todo._id).not.toBe("client");
    expect(published).toEqual([{ type: "todo:created", todo }]);
  });

  it("returns only the updated todo from PATCH and publishes todo:updated", async () => {
    const [seed] = await list();
    const res = await api(`/api/todos/${seed._id}`, {
      method: "PATCH",
      body: JSON.stringify({ progress: 70 }),
    });
    const todo = await json(res);
    expect(res.status).toBe(200);
    expect(todo).toEqual({ ...seed, progress: 70, version: 2 });
    expect(published).toEqual([{ type: "todo:updated", todo }]);
  });

  it("deletes a todo and publishes todo:deleted", async () => {
    const [seed] = await list();
    const res = await api(`/api/todos/${seed._id}`, { method: "DELETE" });
    expect(res.status).toBe(204);
    expect(published).toEqual([{ type: "todo:deleted", _id: seed._id }]);
    expect(await list()).toEqual([]);
  });

  it("answers 404 for unknown ids without publishing", async () => {
    const patch = await api("/api/todos/missing", { method: "PATCH", body: "{}" });
    const del = await api("/api/todos/missing", { method: "DELETE" });
    expect([patch.status, del.status]).toEqual([404, 404]);
    expect(published).toEqual([]);
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

describe("socket.io events", () => {
  let client: Socket;
  afterEach(() => client?.disconnect());

  it("broadcasts each write to connected clients", async () => {
    client = connect(baseUrl, { transports: ["websocket"], extraHeaders: { Origin: ORIGIN } });
    await vi.waitFor(() => expect(client.connected).toBe(true));
    const received = new Promise<TodoEvent>((resolve) => client.on("todo:created", resolve));

    await api("/api/todos", {
      method: "POST",
      body: JSON.stringify({ name: "A", description: "B" }),
    });

    expect(await received).toMatchObject({ type: "todo:created", todo: { name: "A" } });
  });
});
