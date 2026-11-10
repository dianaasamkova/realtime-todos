import { describe, expect, it } from "vitest";
import type { Todo, TodoChange } from "@contract/todos";
import { applyChange, hasGap, mergeList, withPending, type TodoCache } from "./cache";

const todo = (id: string, progress = 0): Todo => ({
  _id: id,
  name: `Todo ${id}`,
  description: "",
  progress,
});
const updated = (revision: number, id: string, progress: number): TodoChange => ({
  type: "todo:updated",
  todo: todo(id, progress),
  revision,
});
const created = (revision: number, id: string): TodoChange => ({
  type: "todo:created",
  todo: todo(id),
  revision,
});
const deleted = (revision: number, id: string): TodoChange => ({
  type: "todo:deleted",
  _id: id,
  revision,
});
const cache = (revision: number, todos: Todo[], ahead: TodoChange[] = []): TodoCache => ({
  revision,
  todos,
  ahead,
});

describe("applyChange", () => {
  it("applies the next revision: update in place, create appended, delete removed", () => {
    let state = cache(5, [todo("a"), todo("b")]);
    state = applyChange(state, updated(6, "b", 40));
    state = applyChange(state, created(7, "c"));
    state = applyChange(state, deleted(8, "a"));
    expect(state).toEqual(cache(8, [todo("b", 40), todo("c")]));
  });

  it("ignores a change the cache already includes and returns the same object", () => {
    const state = cache(5, [todo("a", 10)]);
    expect(applyChange(state, updated(5, "a", 99))).toBe(state);
    expect(applyChange(state, updated(3, "a", 99))).toBe(state);
  });

  it("holds a change that skips a revision until the missing one arrives", () => {
    const state = cache(5, [todo("a")]);
    const waiting = applyChange(state, updated(7, "a", 70));
    expect(waiting).toEqual(cache(5, [todo("a")], [updated(7, "a", 70)]));
    expect(hasGap(waiting)).toBe(true);

    const closed = applyChange(waiting, updated(6, "a", 60));
    expect(closed).toEqual(cache(7, [todo("a", 70)]));
    expect(hasGap(closed)).toBe(false);
  });

  it("applies held changes in revision order whatever order they arrived in", () => {
    let state = cache(1, [todo("a")]);
    for (const change of [updated(4, "a", 40), updated(3, "a", 30), updated(2, "a", 20)]) {
      state = applyChange(state, change);
    }
    expect(state).toEqual(cache(4, [todo("a", 40)]));
  });

  it("does not hold the same change twice", () => {
    const waiting = applyChange(cache(1, []), created(3, "x"));
    expect(applyChange(waiting, created(3, "x"))).toBe(waiting);
  });
});

describe("mergeList", () => {
  it("starts the cache from the first list", () => {
    expect(mergeList(undefined, { revision: 4, todos: [todo("a")] })).toEqual(
      cache(4, [todo("a")]),
    );
  });

  it("keeps the cache when the list is older than what this tab already applied", () => {
    const current = cache(8, [todo("a", 80)]);
    expect(mergeList(current, { revision: 6, todos: [todo("a", 60)] })).toBe(current);
  });

  it("takes a newer list and applies held changes that follow it", () => {
    const current = cache(5, [todo("a")], [updated(7, "a", 70), updated(9, "a", 90)]);
    const merged = mergeList(current, { revision: 6, todos: [todo("a", 60)] });
    // 7 follows 6 and is applied; 9 still waits for 8.
    expect(merged).toEqual(cache(7, [todo("a", 70)], [updated(9, "a", 90)]));
  });

  it("drops held changes the new list already includes", () => {
    const current = cache(5, [todo("a")], [updated(7, "a", 70)]);
    expect(mergeList(current, { revision: 9, todos: [todo("a", 90)] })).toEqual(
      cache(9, [todo("a", 90)]),
    );
  });
});

describe("withPending", () => {
  const todos = [todo("a", 10), todo("b", 20)];

  it("returns the same list when nothing is pending", () => {
    expect(withPending(todos, [], [])).toBe(todos);
  });

  it("layers pending patches in order and hides pending deletes", () => {
    const shown = withPending(
      todos,
      [
        { id: "a", patch: { progress: 30 } },
        { id: "a", patch: { name: "Renamed" } },
        { id: "a", patch: { progress: 40 } },
      ],
      ["b"],
    );
    expect(shown).toEqual([{ ...todo("a"), name: "Renamed", progress: 40 }]);
  });
});
