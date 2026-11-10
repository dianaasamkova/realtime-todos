/**
 * Network-level API mock (MSW) backed by the real server's store, so validation, ids and
 * revisions behave like the mock server. Tests override single endpoints with `api.use(...)`.
 */
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createStore, ValidationError } from "../../server/store.ts";
import type { NewTodo, TodoChange, TodoPatch } from "@contract/todos";
import { API_URL } from "@/app/config";

export const db = createStore([
  { name: "Write specs", description: "Acceptance criteria first", progress: 10 },
  { name: "Ship it", description: "Behind a feature flag", progress: 50 },
]);

export const todoUrl = (path = "") => `${API_URL}/api/todos${path}`;

/** Requests the app sent during the current test, in order. */
export const requests: Array<{ method: string; path: string; body?: unknown }> = [];

async function handle(run: () => TodoChange | undefined, status = 200) {
  try {
    const change = run();
    if (!change) return HttpResponse.json({ message: "todo not found" }, { status: 404 });
    return HttpResponse.json(change, { status });
  } catch (error) {
    if (error instanceof ValidationError) {
      return HttpResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
}

export const api = setupServer(
  http.get(todoUrl(), () => HttpResponse.json(db.snapshot())),
  http.get(`${API_URL}/api/revision`, () => HttpResponse.json({ revision: db.revision() })),
  http.post(todoUrl(), async ({ request }) => {
    const body = (await request.json()) as NewTodo;
    return handle(() => db.create(body), 201);
  }),
  http.patch(todoUrl("/:id"), async ({ request, params }) => {
    const body = (await request.json()) as TodoPatch;
    return handle(() => db.update(String(params.id), body));
  }),
  http.delete(todoUrl("/:id"), ({ params }) => handle(() => db.remove(String(params.id)))),
);

api.events.on("request:start", async ({ request }) => {
  const text = await request.clone().text();
  const body = text ? JSON.parse(text) : undefined;
  requests.push({ method: request.method, path: new URL(request.url).pathname, body });
});

export const byName = (name: string) => db.list().find((todo) => todo.name === name)!;

/** Applies a write directly on the server, as another user would, and returns its change. */
export const serverWrite = {
  update: (name: string, patch: TodoPatch) => db.update(byName(name)._id, patch)!,
  create: (name: string, description = "Created elsewhere") => db.create({ name, description }),
  remove: (name: string) => db.remove(byName(name)._id)!,
};
