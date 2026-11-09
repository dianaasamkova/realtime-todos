import type { Todo, TodoEvent } from "../../shared/todo.ts";

/**
 * Inserts or replaces a todo, keeping list order. A copy that is not newer than the cached one
 * (by `version`) is ignored, so a late event or response can't overwrite a newer state.
 */
export function upsertTodo(todos: Todo[], incoming: Todo): Todo[] {
  const index = todos.findIndex((todo) => todo._id === incoming._id);
  if (index === -1) return [...todos, incoming];
  if (todos[index].version >= incoming.version) return todos;
  return todos.with(index, incoming);
}

export function removeTodo(todos: Todo[], id: string): Todo[] {
  return todos.some((todo) => todo._id === id) ? todos.filter((todo) => todo._id !== id) : todos;
}

/** Applies a realtime event to a cached list. Returns the same array if nothing changed. */
export function applyTodoEvent(todos: Todo[], event: TodoEvent): Todo[] {
  switch (event.type) {
    case "todo:created":
    case "todo:updated":
      return upsertTodo(todos, event.todo);
    case "todo:deleted":
      return removeTodo(todos, event._id);
  }
}
