import type { NewTodo, TodoChange, TodoList, TodoPatch } from "@contract/todos";
import { API_URL } from "@/config";

/** A failed API call with a message that is safe to show to the user. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Calls the API at `path` (relative to /api) and returns the parsed JSON body. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      ...init,
      // Only requests with a body get a content type; a JSON content type on a GET would
      // make the browser send a CORS preflight first.
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(body.message ?? `Request failed (${response.status})`, response.status);
  }
  return (await response.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

const todoPath = (id: string) => `/todos/${encodeURIComponent(id)}`;

/** Every write resolves to the change the server made (see TodoChange). */
export const todosApi = {
  list: () => request<TodoList>("/todos"),
  /** The server's current revision: a cheap way to ask "did I miss anything?". */
  revision: async () => (await request<{ revision: number }>("/revision")).revision,
  create: (input: NewTodo) => request<TodoChange>("/todos", json("POST", input)),
  update: (id: string, patch: TodoPatch) => request<TodoChange>(todoPath(id), json("PATCH", patch)),
  remove: (id: string) => request<TodoChange>(todoPath(id), { method: "DELETE" }),
};

/** Fetches a Centrifugo connection token issued by the API. */
export async function fetchCentrifugoToken(): Promise<string> {
  return (await request<{ token: string }>("/centrifugo/token")).token;
}
