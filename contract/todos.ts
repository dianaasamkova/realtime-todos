/** A todo as stored by the server and sent to clients. */
export interface Todo {
  _id: string;
  name: string;
  description: string;
  /** Integer from 0 to 100. */
  progress: number;
}

export type NewTodo = Pick<Todo, "name" | "description"> & Partial<Pick<Todo, "progress">>;
export type TodoPatch = Partial<Pick<Todo, "name" | "description" | "progress">>;

export type TodoEvent =
  | { type: "todo:created"; todo: Todo }
  | { type: "todo:updated"; todo: Todo }
  | { type: "todo:deleted"; _id: string };

/**
 * One write, as the server applied it. Every write gets the next revision (1, 2, 3, …), so
 * clients can order changes, ignore ones they already have and notice ones they missed. The
 * same object is the write's HTTP response and its realtime broadcast.
 */
export type TodoChange = TodoEvent & {
  revision: number;
  /**
   * The id of the client that made the write, copied from its `X-Client-Id` header (absent if
   * it sent none). A client compares it with its own id to tell its echo from someone else's
   * change. It is advisory only: clients choose their own id, so never use it to authorise
   * anything.
   */
  origin?: string;
};

/** Request header in which a client identifies itself on writes. */
export const CLIENT_ID_HEADER = "X-Client-Id";

/** The list as of a revision: it includes every change up to and including `revision`. */
export interface TodoList {
  revision: number;
  todos: Todo[];
}

export const MAX_TEXT_LENGTH = 200;

/** Centrifugo channel that carries TodoChange publications. */
export const TODOS_CHANNEL = "todos";
