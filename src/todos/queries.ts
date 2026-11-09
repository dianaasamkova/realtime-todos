import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { NewTodo, Todo, TodoPatch } from "../../shared/todo.ts";
import { todosApi } from "../api/todos";
import { useNotifyError } from "../notices/Notices";
import { removeTodo, upsertTodo } from "./cache";

export const todosKey = ["todos"] as const;

export const useTodosQuery = () => useQuery({ queryKey: todosKey, queryFn: todosApi.list });

const setTodos = (client: QueryClient, update: (todos: Todo[]) => Todo[]) =>
  client.setQueryData<Todo[]>(todosKey, (todos) => (todos ? update(todos) : todos));

const reason = (error: Error) => error.message;

/** Adds a todo once the server has assigned its id. Errors go to the caller (the form). */
export function useCreateTodo() {
  const client = useQueryClient();
  return useMutation({
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
  const notifyError = useNotifyError();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TodoPatch }) => todosApi.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await client.cancelQueries({ queryKey: todosKey });
      const previous = client.getQueryData<Todo[]>(todosKey)?.find((todo) => todo._id === id);
      setTodos(client, (todos) =>
        todos.map((todo) => (todo._id === id ? { ...todo, ...patch } : todo)),
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      const previous = context?.previous;
      if (!previous) return;
      setTodos(client, (todos) =>
        todos.map((todo) =>
          todo._id === previous._id && todo.version === previous.version ? previous : todo,
        ),
      );
      notifyError(`Couldn't save “${previous.name}”. ${reason(error)}`);
    },
    onSuccess: (todo) => setTodos(client, (todos) => upsertTodo(todos, todo)),
  });
}

/** Removes a todo immediately and puts it back in place if the server refuses. */
export function useDeleteTodo() {
  const client = useQueryClient();
  const notifyError = useNotifyError();
  return useMutation({
    mutationFn: (id: string) => todosApi.remove(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: todosKey });
      const todos = client.getQueryData<Todo[]>(todosKey) ?? [];
      const index = todos.findIndex((todo) => todo._id === id);
      setTodos(client, (current) => removeTodo(current, id));
      return { removed: todos[index], index };
    },
    onError: (error, _id, context) => {
      const removed = context?.removed;
      if (!removed) return;
      setTodos(client, (todos) =>
        todos.some((todo) => todo._id === removed._id)
          ? todos
          : todos.toSpliced(context.index, 0, removed),
      );
      notifyError(`Couldn't delete “${removed.name}”. ${reason(error)}`);
    },
  });
}
