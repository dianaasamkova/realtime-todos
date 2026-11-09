import { Link, Outlet } from "react-router";
import { ConnectionStatus } from "./ConnectionStatus";

export function Layout() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/"
            className="rounded-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
          >
            Real-time Todos
          </Link>
          <ConnectionStatus />
        </div>
      </header>
      <Outlet />
    </div>
  );
}

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">
        <Link to="/" className="text-sky-700 hover:underline">
          Go to the todo list
        </Link>
      </p>
    </main>
  );
}
