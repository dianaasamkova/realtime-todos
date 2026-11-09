import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { api, requests, todoUrl } from "../test/api";
import { ApiError, todosApi } from "./todos";

describe("todosApi", () => {
  it("sends JSON and returns the change the server made", async () => {
    const change = await todosApi.create({ name: "New", description: "Desc" });
    expect(change).toMatchObject({
      type: "todo:created",
      todo: { name: "New" },
      revision: expect.any(Number),
    });
    expect(requests).toEqual([
      { method: "POST", path: "/api/todos", body: { name: "New", description: "Desc" } },
    ]);
  });

  it("sends a JSON content type only with a body, so reads need no CORS preflight", async () => {
    const seen: Array<[string, string | null]> = [];
    const record = ({ request }: { request: Request }) =>
      void seen.push([request.method, request.headers.get("content-type")]);
    api.events.on("request:start", record);
    try {
      const {
        todos: [first],
      } = await todosApi.list();
      await todosApi.update(first._id, { progress: 5 });
      await todosApi.remove(first._id);
    } finally {
      api.events.removeListener("request:start", record);
    }
    expect(seen).toEqual([
      ["GET", null],
      ["PATCH", "application/json"],
      ["DELETE", null],
    ]);
  });

  it("returns the list with its revision, and the server's current revision", async () => {
    const list = await todosApi.list();
    expect(list.todos.map((todo) => todo.name)).toEqual(["Write specs", "Ship it"]);
    await expect(todosApi.revision()).resolves.toBe(list.revision);
    const change = await todosApi.remove(list.todos[0]._id);
    expect(change).toEqual({
      type: "todo:deleted",
      _id: list.todos[0]._id,
      revision: list.revision + 1,
    });
  });

  it("uses the server's message for failed requests", async () => {
    const error = await todosApi.create({ name: "", description: "x" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: "name is required" });
  });

  it("falls back to the status code when the body has no message", async () => {
    api.use(http.get(todoUrl(), () => new HttpResponse("oops", { status: 502 })));
    await expect(todosApi.list()).rejects.toMatchObject({ message: "Request failed (502)" });
  });

  it("explains network failures in plain words", async () => {
    api.use(http.get(todoUrl(), () => HttpResponse.error()));
    await expect(todosApi.list()).rejects.toMatchObject({
      status: 0,
      message: "Can't reach the server. Check your connection and try again.",
    });
  });
});
