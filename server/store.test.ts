import { describe, expect, it } from "vitest";
import type { Todo, TodoChange } from "../contract/todos.ts";
import { createStore, ValidationError } from "./store.ts";

const seed = [{ name: "Seed", description: "First", progress: 10 }];
const todoOf = (change: TodoChange | undefined) => (change as { todo: Todo }).todo;

describe("todo store", () => {
  it("assigns ids on the server side and returns the change with the next revision", () => {
    const store = createStore(seed);
    const start = store.revision();
    const change = store.create({ name: "  New  ", description: "Desc" });
    expect(change).toMatchObject({
      type: "todo:created",
      revision: start + 1,
      todo: { name: "New", description: "Desc", progress: 0 },
    });
    expect(todoOf(change)._id).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.list()).toHaveLength(2);
  });

  it("ignores ids and revisions sent by a client", () => {
    const store = createStore(seed);
    const input = { name: "A", description: "B", _id: "client-id", revision: 99 };
    const change = store.create(input);
    expect(todoOf(change)._id).not.toBe("client-id");
    expect(change.revision).toBe(store.revision());
  });

  it("numbers every write with consecutive revisions", () => {
    const store = createStore(seed);
    const [first] = store.list();
    const revisions = [
      store.update(first._id, { progress: 20 })!.revision,
      store.create({ name: "x", description: "y" }).revision,
      store.remove(first._id)!.revision,
    ];
    expect(revisions).toEqual([revisions[0], revisions[0] + 1, revisions[0] + 2]);
    expect(store.snapshot().revision).toBe(revisions[2]);
  });

  it("returns the updated todo in the change", () => {
    const store = createStore(seed);
    const [first] = store.list();
    const change = store.update(first._id, { progress: 55 });
    expect(change).toEqual({
      type: "todo:updated",
      todo: { ...first, progress: 55 },
      revision: store.revision(),
    });
    expect(store.list()[0]).toEqual(todoOf(change));
  });

  it("renames and re-describes a todo, trimming the text", () => {
    const store = createStore(seed);
    const [first] = store.list();
    const change = store.update(first._id, { name: "  New name ", description: " New text " });
    expect(todoOf(change)).toMatchObject({ name: "New name", description: "New text" });
    expect(() => store.update(first._id, { description: "  " })).toThrow("description is required");
  });

  it("clamps and rounds progress", () => {
    const store = createStore(seed);
    const [first] = store.list();
    expect(todoOf(store.update(first._id, { progress: 140 })).progress).toBe(100);
    expect(todoOf(store.update(first._id, { progress: -3 })).progress).toBe(0);
    expect(todoOf(store.update(first._id, { progress: 33.6 })).progress).toBe(34);
  });

  it.each([
    [{ name: "", description: "x" }, "name is required"],
    [{ name: "x", description: "   " }, "description is required"],
    [{ name: "x".repeat(201), description: "x" }, "name must be at most 200 characters"],
    [{ name: "x", description: "x", progress: "50" }, "progress must be a number"],
  ])("rejects invalid input %j without using a revision", (input, message) => {
    const store = createStore(seed);
    const before = store.revision();
    expect(() => store.create(input as never)).toThrow(new ValidationError(message));
    expect(store.revision()).toBe(before);
  });

  it("reports unknown ids instead of throwing", () => {
    const store = createStore(seed);
    expect(store.update("missing", { progress: 1 })).toBeUndefined();
    expect(store.remove("missing")).toBeUndefined();
  });

  it("restores the seed data on reset without the revision going back", () => {
    const store = createStore(seed);
    store.create({ name: "Extra", description: "x" });
    const before = store.revision();
    store.reset();
    expect(store.list().map((todo) => todo.name)).toEqual(["Seed"]);
    expect(store.revision()).toBeGreaterThan(before);
  });
});
