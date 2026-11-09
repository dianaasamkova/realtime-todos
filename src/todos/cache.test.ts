import { describe, expect, it } from "vitest";
import type { Todo } from "../../shared/todo.ts";
import { applyTodoEvent, removeTodo, upsertTodo } from "./cache";

const todo = (id: string, version = 1, progress = 0): Todo => ({
  _id: id,
  name: `Todo ${id}`,
  description: "",
  progress,
  version,
});

describe("upsertTodo", () => {
  it("appends an unknown todo", () => {
    expect(upsertTodo([todo("a")], todo("b"))).toEqual([todo("a"), todo("b")]);
  });

  it("replaces a todo with a newer version in place", () => {
    const list = [todo("a"), todo("b"), todo("c")];
    expect(upsertTodo(list, todo("b", 2, 80))).toEqual([todo("a"), todo("b", 2, 80), todo("c")]);
  });

  it("ignores a stale or duplicate copy and keeps the same array", () => {
    const list = [todo("a", 3, 30)];
    expect(upsertTodo(list, todo("a", 2, 20))).toBe(list);
    expect(upsertTodo(list, todo("a", 3, 30))).toBe(list);
  });
});

describe("removeTodo", () => {
  it("removes by id and is a no-op for unknown ids", () => {
    const list = [todo("a"), todo("b")];
    expect(removeTodo(list, "a")).toEqual([todo("b")]);
    expect(removeTodo(list, "zzz")).toBe(list);
  });
});

describe("applyTodoEvent", () => {
  it("does not duplicate a todo the client already added from its own POST response", () => {
    const list = [todo("a")];
    expect(applyTodoEvent(list, { type: "todo:created", todo: todo("a") })).toBe(list);
  });

  it("applies updates and deletes", () => {
    const list = [todo("a"), todo("b")];
    const updated = applyTodoEvent(list, { type: "todo:updated", todo: todo("b", 2, 90) });
    expect(updated[1].progress).toBe(90);
    expect(applyTodoEvent(updated, { type: "todo:deleted", _id: "a" })).toEqual([todo("b", 2, 90)]);
  });
});
