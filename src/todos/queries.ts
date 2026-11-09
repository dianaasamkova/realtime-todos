import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { NewTodo, Todo, TodoPatch } from "../../shared/todo.ts";
import { todosApi } from "../api/todos";
import { useNotify } from "../notices/Notices";
import { applyTodoEvent, removeTodo, upsertTodo } from "./cache";
import { eventsSince, journalPosition } from "./journal";

export const todosKey = ["todos"] as const;
export const createKey = ["todos", "create"] as const;
export const updateKey = ["todos", "update"] as const;

type UpdateVariables = { id: string; patch: TodoPatch };

/**
 * Layers this tab's still-pending edits of a todo over a copy from the server. A response or
 * event for an earlier save carries a higher version than the optimistic state, but not the
 * newer edits, so without this the UI would briefly snap back. `except` skips the edit whose
 * own response is being applied.
 */
export function withPendingEdits(client: QueryClient, todo: Todo, except?: UpdateVariables): Todo {
  const pending = client
    .getMutationCache()
    .findAll({ mutationKey: updateKey, status: "pending" })
    .filter((mutation) => {
      const variables = mutation.state.variables as UpdateVariables | undefined;
      return variables?.id === todo._id && variables !== except;
    })
    .sort((a, b) => a.state.submittedAt - b.state.submittedAt);
  return pending.reduce(
    (merged, mutation) => ({ ...merged, ...(mutation.state.variables as UpdateVariables).patch }),
    todo,
  );
}

/**
 * Fetches the list, replays realtime events that arrived while the request was in flight, and
 * keeps pending edits on top.
 */
export async function fetchTodos(client: QueryClient): Promise<Todo[]> {
  const position = journalPosition(client);
  const todos = await todosApi.list();
  return eventsSince(client, position)
    .reduce(applyTodoEvent, todos)
    .map((todo) => withPendingEdits(client, todo));
}

export function useTodosQuery() {
  const client = useQueryClient();
  return useQuery({ queryKey: todosKey, queryFn: () => fetchTodos(client) });
}

/**
 * Stops an in-flight list refetch so it can't overwrite an optimistic edit, and reports whether
 * one was running: that refetch may be a catch-up after a reconnect, so it must run again.
 */
async function pauseRefetch(client: QueryClient) {
  const wasRefetching = client.isFetching({ queryKey: todosKey }) > 0;
  await client.cancelQueries({ queryKey: todosKey });
  return wasRefetching;
}

const resumeRefetch = (client: QueryClient, context?: { wasRefetching: boolean }) => {
  if (context?.wasRefetching) void client.invalidateQueries({ queryKey: todosKey });
};

const setTodos = (client: QueryClient, update: (todos: Todo[]) => Todo[]) =>
  client.setQueryData<Todo[]>(todosKey, (todos) => (todos ? update(todos) : todos));

const reason = (error: Error) => error.message;

/** Adds a todo once the server has assigned its id. Errors go to the caller (the form). */
export function useCreateTodo() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: createKey,
    mutationFn: (input: NewTodo) => todosApi.create(input),
    onSuccess: (todo) => setTodos(client, (todos) => upsertTodo(todos, todo)),
  });
}

/**
 * Applies an edit immediately. If the server rejects it, only that todo is rolled back,
 * and only if no newer server version replaced it in the meantime.
 */
export function useUpdateTodo() {
  const client = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationKey: updateKey,
    mutationFn: ({ id, patch }: UpdateVariables) => todosApi.update(id, patch),
    onMutate: async ({ id, patch }) => {
      const wasRefetching = await pauseRefetch(client);
      const previous = client.getQueryData<Todo[]>(todosKey)?.find((todo) => todo._id === id);
      setTodos(client, (todos) =>
        todos.map((todo) => (todo._id === id ? { ...todo, ...patch } : todo)),
      );
      return { previous, wasRefetching };
    },
    onError: (error, _variables, context) => {
      const previous = context?.previous;
      if (!previous) return;
      setTodos(client, (todos) =>
        todos.map((todo) =>
          todo._id === previous._id && todo.version === previous.version ? previous : todo,
        ),
      );
      notify({ tone: "error", message: `Couldn't save “${previous.name}”. ${reason(error)}` });
    },
    onSuccess: (todo, variables) =>
      setTodos(client, (todos) => upsertTodo(todos, withPendingEdits(client, todo, variables))),
    onSettled: (_data, _error, _variables, context) => resumeRefetch(client, context),
  });
}

/** Removes a todo immediately and puts it back in place if the server refuses. */
export function useDeleteTodo() {
  const client = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (id: string) => todosApi.remove(id),
    onMutate: async (id) => {
      const wasRefetching = await pauseRefetch(client);
      const todos = client.getQueryData<Todo[]>(todosKey) ?? [];
      const index = todos.findIndex((todo) => todo._id === id);
      setTodos(client, (current) => removeTodo(current, id));
      return { removed: todos[index], index, wasRefetching };
    },
    onError: (error, _id, context) => {
      const removed = context?.removed;
      if (!removed) return;
      setTodos(client, (todos) =>
        todos.some((todo) => todo._id === removed._id)
          ? todos
          : todos.toSpliced(context.index, 0, removed),
      );
      notify({ tone: "error", message: `Couldn't delete “${removed.name}”. ${reason(error)}` });
    },
    onSettled: (_data, _error, _id, context) => resumeRefetch(client, context),
  });
}
