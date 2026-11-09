import { MAX_TEXT_LENGTH, type NewTodo, type Todo, type TodoPatch } from "../shared/todo.ts";

export class ValidationError extends Error {}

const SEED: Array<Omit<Todo, "_id" | "version">> = [
  {
    name: "Design the API contract",
    description: "Agree on REST + realtime events with the backend",
    progress: 100,
  },
  {
    name: "Real-time progress",
    description: "Broadcast slider changes to every open tab",
    progress: 60,
  },
  { name: "Write the README", description: "Explain decisions and trade-offs", progress: 20 },
];

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ValidationError(`${field} is required`);
  const trimmed = value.trim();
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new ValidationError(`${field} must be at most ${MAX_TEXT_LENGTH} characters`);
  }
  return trimmed;
}

function progress(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError("progress must be a number");
  }
  return Math.round(Math.min(100, Math.max(0, value)));
}

/** In-memory todo store. The server owns ids and versions; clients never send them. */
export function createStore(seed = SEED) {
  let todos: Todo[] = [];

  const store = {
    reset() {
      todos = seed.map((todo) => ({ ...todo, _id: crypto.randomUUID(), version: 1 }));
    },
    list(): Todo[] {
      return todos;
    },
    create(input: NewTodo): Todo {
      const todo: Todo = {
        _id: crypto.randomUUID(),
        name: text(input.name, "name"),
        description: text(input.description, "description"),
        progress: input.progress === undefined ? 0 : progress(input.progress),
        version: 1,
      };
      todos = [...todos, todo];
      return todo;
    },
    /** Returns the updated todo, or undefined if the id is unknown. */
    update(id: string, patch: TodoPatch): Todo | undefined {
      const current = todos.find((todo) => todo._id === id);
      if (!current) return undefined;
      const next: Todo = {
        ...current,
        ...(patch.name !== undefined && { name: text(patch.name, "name") }),
        ...(patch.description !== undefined && {
          description: text(patch.description, "description"),
        }),
        ...(patch.progress !== undefined && { progress: progress(patch.progress) }),
        version: current.version + 1,
      };
      todos = todos.map((todo) => (todo._id === id ? next : todo));
      return next;
    },
    /** Returns false if the id is unknown. */
    remove(id: string): boolean {
      const before = todos.length;
      todos = todos.filter((todo) => todo._id !== id);
      return todos.length < before;
    },
  };
  store.reset();
  return store;
}

export type Store = ReturnType<typeof createStore>;
