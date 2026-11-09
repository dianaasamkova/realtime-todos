import type { Todo, TodoChange, TodoEvent, TodoList, TodoPatch } from "../../shared/todo.ts";

/**
 * The client's copy of the server state. It always holds every change up to `revision` and
 * nothing else: optimistic edits are layered on top at render time (see `withPending`).
 */
export interface TodoCache extends TodoList {
  /** Changes that arrived before an earlier one they depend on; applied once the gap closes. */
  ahead: TodoChange[];
}

const byRevision = (a: TodoChange, b: TodoChange) => a.revision - b.revision;

function applyEvent(todos: Todo[], event: TodoEvent): Todo[] {
  switch (event.type) {
    case "todo:created":
    case "todo:updated": {
      const index = todos.findIndex((todo) => todo._id === event.todo._id);
      return index === -1 ? [...todos, event.todo] : todos.with(index, event.todo);
    }
    case "todo:deleted":
      return todos.filter((todo) => todo._id !== event._id);
  }
}

/** Applies buffered changes that are now next in line, and drops ones already included. */
function drain(cache: TodoCache): TodoCache {
  let { revision, todos } = cache;
  const ahead: TodoChange[] = [];
  for (const change of [...cache.ahead].sort(byRevision)) {
    if (change.revision <= revision) continue;
    if (change.revision === revision + 1 && ahead.length === 0) {
      todos = applyEvent(todos, change);
      revision = change.revision;
    } else {
      ahead.push(change);
    }
  }
  return revision === cache.revision && ahead.length === cache.ahead.length
    ? cache
    : { revision, todos, ahead };
}

/**
 * Applies a change from the server (a realtime event or a write's response). Changes at or
 * below the cached revision are already included and return the same object; a change that
 * skips revisions waits in `ahead` until the missing ones arrive or a reload fills the gap.
 */
export function applyChange(cache: TodoCache, change: TodoChange): TodoCache {
  if (change.revision <= cache.revision) return cache;
  if (cache.ahead.some((queued) => queued.revision === change.revision)) return cache;
  return drain({ ...cache, ahead: [...cache.ahead, change] });
}

/** True while changes are waiting for a missing earlier one. */
export const hasGap = (cache: TodoCache | undefined) => !!cache && cache.ahead.length > 0;

/**
 * Combines a freshly loaded list with the cache: whichever is newer wins, so a list served
 * before changes this tab already applied can't undo them. Buffered changes are kept and
 * applied on top when they follow on.
 */
export function mergeList(cache: TodoCache | undefined, list: TodoList): TodoCache {
  if (!cache) return { ...list, ahead: [] };
  const base = list.revision > cache.revision ? { ...list, ahead: cache.ahead } : cache;
  return drain(base);
}

/**
 * Layers this tab's unsaved edits over the server state for display: pending patches in the
 * order they were made, and pending deletes hidden. When a save settles its patch simply
 * stops applying, so a failed save "rolls back" without any extra code.
 */
export function withPending(
  todos: Todo[],
  updates: ReadonlyArray<{ id: string; patch: TodoPatch }>,
  deletes: ReadonlyArray<string>,
): Todo[] {
  if (updates.length === 0 && deletes.length === 0) return todos;
  const patches = new Map<string, TodoPatch>();
  for (const { id, patch } of updates) patches.set(id, { ...patches.get(id), ...patch });
  return todos
    .filter((todo) => !deletes.includes(todo._id))
    .map((todo) => (patches.has(todo._id) ? { ...todo, ...patches.get(todo._id) } : todo));
}
