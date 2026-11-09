import {
  MAX_TEXT_LENGTH,
  type NewTodo,
  type Todo,
  type TodoChange,
  type TodoEvent,
  type TodoList,
  type TodoPatch,
} from "../shared/todo.ts";

/** A client error; the API answers with `status` (400 unless stated) and the message. */
export class ValidationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const SEED: Array<Omit<Todo, "_id">> = [
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

/**
 * In-memory todo store. The server owns ids and the revision counter; every write returns the
 * change it made, stamped with the next revision.
 */
export function createStore(seed = SEED) {
  let todos: Todo[] = [];
  let revision = 0;
  const change = (event: TodoEvent): TodoChange => ({ ...event, revision: ++revision });

  const store = {
    /** Restores the seed data. The revision keeps counting up, so it never goes back. */
    reset() {
      todos = seed.map((todo) => ({ ...todo, _id: crypto.randomUUID() }));
      revision++;
    },
    list(): Todo[] {
      return todos;
    },
    revision(): number {
      return revision;
    },
    snapshot(): TodoList {
      return { revision, todos };
    },
    create(input: NewTodo): TodoChange {
      const todo: Todo = {
        _id: crypto.randomUUID(),
        name: text(input.name, "name"),
        description: text(input.description, "description"),
        progress: input.progress === undefined ? 0 : progress(input.progress),
      };
      todos = [...todos, todo];
      return change({ type: "todo:created", todo });
    },
    /** Returns undefined if the id is unknown. */
    update(id: string, patch: TodoPatch): TodoChange | undefined {
      const current = todos.find((todo) => todo._id === id);
      if (!current) return undefined;
      const next: Todo = {
        ...current,
        ...(patch.name !== undefined && { name: text(patch.name, "name") }),
        ...(patch.description !== undefined && {
          description: text(patch.description, "description"),
        }),
        ...(patch.progress !== undefined && { progress: progress(patch.progress) }),
      };
      todos = todos.map((todo) => (todo._id === id ? next : todo));
      return change({ type: "todo:updated", todo: next });
    },
    /** Returns undefined if the id is unknown. */
    remove(id: string): TodoChange | undefined {
      if (!todos.some((todo) => todo._id === id)) return undefined;
      todos = todos.filter((todo) => todo._id !== id);
      return change({ type: "todo:deleted", _id: id });
    },
  };
  store.reset();
  return store;
}

export type Store = ReturnType<typeof createStore>;
