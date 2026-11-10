import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">
        <Link to="." className="text-sky-700 hover:underline">
          Go to the todo list
        </Link>
      </p>
    </main>
  );
}
