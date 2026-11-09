import { describe, expect, it } from "vitest";
import { createStore, ValidationError } from "./store.ts";

const seed = [{ name: "Seed", description: "First", progress: 10 }];

describe("todo store", () => {
  it("assigns ids and versions on the server side", () => {
    const store = createStore(seed);
    const todo = store.create({ name: "  New  ", description: "Desc" });
    expect(todo).toMatchObject({ name: "New", description: "Desc", progress: 0, version: 1 });
    expect(todo._id).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.list()).toHaveLength(2);
  });

  it("ignores ids and versions sent by a client", () => {
    const store = createStore(seed);
    const input = { name: "A", description: "B", _id: "client-id", version: 99 };
    const todo = store.create(input);
    expect(todo._id).not.toBe("client-id");
    expect(todo.version).toBe(1);
  });

  it("returns the updated todo and bumps its version", () => {
    const store = createStore(seed);
    const [first] = store.list();
    const updated = store.update(first._id, { progress: 55 });
    expect(updated).toEqual({ ...first, progress: 55, version: 2 });
    expect(store.list()[0]).toEqual(updated);
  });

  it("clamps and rounds progress", () => {
    const store = createStore(seed);
    const [first] = store.list();
    expect(store.update(first._id, { progress: 140 })?.progress).toBe(100);
    expect(store.update(first._id, { progress: -3 })?.progress).toBe(0);
    expect(store.update(first._id, { progress: 33.6 })?.progress).toBe(34);
  });

  it.each([
    [{ name: "", description: "x" }, "name is required"],
    [{ name: "x", description: "   " }, "description is required"],
    [{ name: "x".repeat(201), description: "x" }, "name must be at most 200 characters"],
    [{ name: "x", description: "x", progress: "50" }, "progress must be a number"],
  ])("rejects invalid input %j", (input, message) => {
    const store = createStore(seed);
    expect(() => store.create(input as never)).toThrow(new ValidationError(message));
  });

  it("reports unknown ids instead of throwing", () => {
    const store = createStore(seed);
    expect(store.update("missing", { progress: 1 })).toBeUndefined();
    expect(store.remove("missing")).toBe(false);
  });

  it("restores the seed data on reset", () => {
    const store = createStore(seed);
    store.create({ name: "Extra", description: "x" });
    store.reset();
    expect(store.list().map((todo) => todo.name)).toEqual(["Seed"]);
  });
});
