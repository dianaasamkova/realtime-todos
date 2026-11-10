import { Link, Outlet, useLocation } from "react-router";
import { cn } from "@/shared/lib/cn";
import { ConnectionStatus } from "@/features/realtime/components/ConnectionStatus";

const navLink = (active: boolean) =>
  cn(
    "rounded-md px-3 py-1 text-sm text-slate-600 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none",
    active && "bg-slate-900 text-white hover:text-white",
  );

export function Layout() {
  const onCentrifugo = useLocation().pathname.startsWith("/centrifugo");
  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            to={onCentrifugo ? "/centrifugo" : "/"}
            className="rounded-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
          >
            Real-time Todos
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <nav
              aria-label="Realtime transport"
              className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5"
            >
              <Link
                to="/"
                aria-current={onCentrifugo ? undefined : "page"}
                className={navLink(!onCentrifugo)}
              >
                socket.io
              </Link>
              <Link
                to="/centrifugo"
                aria-current={onCentrifugo ? "page" : undefined}
                className={navLink(onCentrifugo)}
              >
                Centrifugo
              </Link>
            </nav>
            <ConnectionStatus />
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
