import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";
import { LoadStatus } from "../components/LoadStatus";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/cn";
import { useTodosQuery } from "../todos/queries";

export function TodoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const todos = useTodosQuery();
  const todo = todos.data?.find((item) => item._id === id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        to=".."
        className="inline-flex items-center gap-1 rounded-sm text-sm text-sky-700 hover:underline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All todos
      </Link>

      <div className="mt-6">
        {!todos.data ? (
          <LoadStatus query={todos} />
        ) : !todo ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Todo not found</h1>
            <p className="mt-2 text-sm text-slate-600">This todo doesn't exist or was deleted.</p>
          </>
        ) : (
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-semibold tracking-tight break-words">{todo.name}</h1>
              {todo.progress === 100 && <Badge>Done</Badge>}
            </div>
            <p className="mt-2 break-words text-slate-600">{todo.description}</p>

            <div className="mt-6">
              <div className="flex justify-between text-sm">
                <span id="progress-label" className="font-medium">
                  Progress
                </span>
                <span className="text-slate-600 tabular-nums">{todo.progress}%</span>
              </div>
              <div
                role="progressbar"
                aria-labelledby="progress-label"
                aria-valuenow={todo.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-300",
                    todo.progress === 100 ? "bg-emerald-600" : "bg-sky-600",
                  )}
                  style={{ width: `${todo.progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Updates live when anyone moves the slider.
              </p>
            </div>
          </article>
        )}
      </div>
    </main>
  );
}
