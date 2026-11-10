import {
  CLIENT_ID_HEADER,
  type NewTodo,
  type TodoChange,
  type TodoList,
  type TodoPatch,
} from "@contract/todos";
import { API_URL } from "@/app/config";

/** A failed API call with a message that is safe to show to the user. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * A random id for this tab. `crypto.randomUUID` exists only in secure contexts (HTTPS or
 * localhost), so on a plain-http page it falls back to `getRandomValues`, which works everywhere.
 */
export function createClientId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Identifies this tab on its writes, so it can tell its own echo from someone else's change. */
export const CLIENT_ID = createClientId();

/** Calls the API at `path` (relative to /api) and returns the parsed JSON body. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      ...init,
      // Reads stay free of custom headers: a JSON content type or an id on a GET would make the
      // browser send a CORS preflight first. Writes (which have a method) are preflighted anyway.
      headers: {
        ...(init?.body && { "Content-Type": "application/json" }),
        ...(init?.method && { [CLIENT_ID_HEADER]: CLIENT_ID }),
      },
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
