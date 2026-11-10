import { useSearchParams } from "react-router";
import type { NewTodo, Todo, TodoPatch } from "@contract/todos";
import { AddTodoForm } from "@/features/todos/components/AddTodoForm";
import { ConnectionBanner } from "@/features/realtime/components/ConnectionStatus";
import { LoadStatus } from "@/features/todos/components/LoadStatus";
import { TodoCard } from "@/features/todos/components/TodoCard";
import { cn } from "@/shared/lib/cn";
import { useRealtime } from "@/features/realtime/RealtimeProvider";
import { useCreateTodo, useTodos, useUpdateTodo } from "@/features/todos/queries";
import { useUndoableDelete } from "@/features/todos/use-undoable-delete";

const FILTERS = [
  { value: "all", label: "All", matches: () => true },
  { value: "active", label: "Active", matches: (todo: Todo) => todo.progress < 100 },
  { value: "done", label: "Done", matches: (todo: Todo) => todo.progress === 100 },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

const EMPTY_MESSAGES: Record<Filter, string> = {
  all: "No todos yet. Add the first one above, then open this page in a second tab to watch it sync.",
  active: "Nothing in progress: everything here is done.",
  done: "Nothing is done yet. Drag a slider to 100% to finish a todo.",
};

export function TodoListPage() {
  const { query, todos } = useTodos();
  const create = useCreateTodo();
  const update = useUpdateTodo();
  const { hidden, scheduleDelete } = useUndoableDelete();
  const { transportName } = useRealtime();
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.find((f) => f.value === params.get("filter")) ?? FILTERS[0];

  const visible = (todos ?? []).filter((todo) => !hidden.has(todo._id));
  const shown = visible.filter(filter.matches);

  // Errors propagate to the form, which keeps the input and shows the message.
  const addTodo = async (input: NewTodo) => {
    await create.mutateAsync(input);
  };
  const editTodo = (id: string, patch: TodoPatch) => update.mutate({ id, patch });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Team todos</h1>
      <p className="mt-1 text-sm text-slate-600">
        Changes sync live over {transportName} to everyone with this page open. Edits made on the
        other transport's page show up here too.
      </p>
      <ConnectionBanner />

      <div className="mt-6">
        <AddTodoForm onAdd={addTodo} />
      </div>

      <section aria-labelledby="todos-heading" className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="todos-heading" className="text-sm font-semibold">
            Todos
          </h2>
          <div
            role="group"
            aria-label="Filter todos"
            className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5"
          >
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={f.value === filter.value}
                onClick={() => setParams(f.value === "all" ? {} : { filter: f.value })}
                className={cn(
                  "rounded-md px-3 py-1 text-sm text-slate-600 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none",
                  f.value === filter.value && "bg-slate-900 text-white hover:text-white",
                )}
              >
                {f.label} <span className="tabular-nums">{visible.filter(f.matches).length}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <LoadStatus query={query} />
          {todos && shown.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-600">
              {EMPTY_MESSAGES[filter.value]}
            </p>
          )}
          <ul className="space-y-3">
            {shown.map((todo) => (
              <li key={todo._id}>
                <TodoCard todo={todo} onEdit={editTodo} onDelete={scheduleDelete} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
