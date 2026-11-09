/** A todo as stored by the server and sent to clients. */
export interface Todo {
  _id: string;
  name: string;
  description: string;
  /** Integer from 0 to 100. */
  progress: number;
  /** Increases by one on every write; lets clients drop stale events. */
  version: number;
}

export type NewTodo = Pick<Todo, "name" | "description"> & Partial<Pick<Todo, "progress">>;
export type TodoPatch = Partial<Pick<Todo, "name" | "description" | "progress">>;

/** Realtime events. The same payloads go out over socket.io and Centrifugo. */
export type TodoEvent =
  | { type: "todo:created"; todo: Todo }
  | { type: "todo:updated"; todo: Todo }
  | { type: "todo:deleted"; _id: string };

export const MAX_TEXT_LENGTH = 200;
