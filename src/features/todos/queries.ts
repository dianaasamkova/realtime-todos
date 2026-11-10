import {
  queryOptions,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import type { NewTodo, Todo, TodoChange, TodoPatch } from "@contract/todos";
import { todosApi } from "./api";
import { useNotify } from "@/shared/notices/Notices";
import { applyChange, hasGap, mergeList, withPending, type TodoCache } from "./cache";

export const todosKey = ["todos"] as const;
export const createKey = ["todos", "create"] as const;
export const updateKey = ["todos", "update"] as const;
export const deleteKey = ["todos", "delete"] as const;

type UpdateVariables = { id: string; patch: TodoPatch };

/** Loads the list and merges it with the cache, so an older response can't undo newer data. */
export const todosQuery = (client: QueryClient) =>
  queryOptions({
    queryKey: todosKey,
    queryFn: async () => {
      const list = await todosApi.list();
      // Read the cache only now: changes may have arrived while the request was in flight.
      return mergeList(client.getQueryData<TodoCache>(todosKey), list);
    },
  });

/**
 * How long a change that skipped revisions may wait for the missing ones before the list is
 * reloaded. Out-of-order arrival is normal (a write's response can beat an earlier broadcast),
 * so this only reloads when something was really lost.
 */
const GAP_GRACE_MS = 1500;
const gapChecks = new WeakMap<QueryClient, ReturnType<typeof setTimeout>>();

function scheduleGapCheck(client: QueryClient) {
  if (gapChecks.has(client)) return;
  gapChecks.set(
    client,
    setTimeout(() => {
      gapChecks.delete(client);
      if (hasGap(client.getQueryData<TodoCache>(todosKey))) {
        void client.invalidateQueries({ queryKey: todosKey });
      }
    }, GAP_GRACE_MS),
  );
}

/**
 * Applies a change from the server to the cache. Returns true if it changed what this tab
 * shows now (false if it was already included or is waiting for an earlier change).
 */
export function applyServerChange(client: QueryClient, change: TodoChange): boolean {
  const before = client.getQueryData<TodoCache>(todosKey);
  // Before the first list arrives there is nothing to apply to; the resync after connecting
  // compares revisions once the list is in and reloads if anything was missed.
  if (!before) return false;
  const after = applyChange(before, change);
  if (after === before) return false;
  client.setQueryData(todosKey, after);
  if (hasGap(after)) scheduleGapCheck(client);
  return after.revision >= change.revision;
}

/**
 * Called when a realtime connection starts without replaying what was missed. Waits for the
 * list (an in-flight request is reused), then asks the server for its revision and reloads
 * only if this tab is behind: a page open costs one list request plus this tiny check.
 */
export async function resync(client: QueryClient) {
  try {
    const cache = await client.ensureQueryData(todosQuery(client));
    const revision = await todosApi.revision();
    if (revision > cache.revision || hasGap(cache)) {
      await client.invalidateQueries({ queryKey: todosKey });
    }
  } catch {
    // Offline or failing: the list's own error state and the next reconnect handle it.
  }
}

/** The list for display: server state with this tab's unsaved edits layered on top. */
export function useTodos() {
  const client = useQueryClient();
  const query = useQuery(todosQuery(client));
  const updates = useMutationState({
    filters: { mutationKey: updateKey, status: "pending" },
    select: (mutation) => mutation.state.variables as UpdateVariables,
  });
  const deletes = useMutationState({
    filters: { mutationKey: deleteKey, status: "pending" },
    select: (mutation) => mutation.state.variables as string,
  });
  const todos = useMemo(
    () => (query.data ? withPending(query.data.todos, updates, deletes) : undefined),
    [query.data, updates, deletes],
  );
  return { query, todos };
}

const nameOf = (client: QueryClient, id: string) =>
  client.getQueryData<TodoCache>(todosKey)?.todos.find((todo: Todo) => todo._id === id)?.name ??
  "the todo";

/** Adds a todo once the server has assigned its id. Errors go to the caller (the form). */
export function useCreateTodo() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: createKey,
    mutationFn: (input: NewTodo) => todosApi.create(input),
    onSuccess: (change) => void applyServerChange(client, change),
  });
}

/**
 * Saves an edit. It shows immediately because pending edits are layered over the list (see
 * useTodos); if the server refuses, the layer goes away and an error explains why.
 */
export function useUpdateTodo() {
  const client = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationKey: updateKey,
    mutationFn: ({ id, patch }: UpdateVariables) => todosApi.update(id, patch),
    onSuccess: (change) => void applyServerChange(client, change),
    onError: (error, { id }) =>
      notify({ tone: "error", message: `Couldn't save “${nameOf(client, id)}”. ${error.message}` }),
  });
}

/** Deletes a todo; it is hidden while the request is pending and comes back if it fails. */
export function useDeleteTodo() {
  const client = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationKey: deleteKey,
    mutationFn: (id: string) => todosApi.remove(id),
    onSuccess: (change) => void applyServerChange(client, change),
    onError: (error, id) =>
      notify({
        tone: "error",
        message: `Couldn't delete “${nameOf(client, id)}”. ${error.message}`,
      }),
  });
}
