import { useRealtime } from "@/realtime/RealtimeProvider";
import type { ConnectionStatus as Status } from "@/realtime/types";
import { cn } from "@/lib/cn";

const LABELS: Record<Status, string> = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
  offline: "Offline",
};

const DOTS: Record<Status, string> = {
  connecting: "bg-slate-400",
  live: "bg-emerald-500",
  reconnecting: "bg-amber-500",
  offline: "bg-red-500",
};

/** A small pill showing whether live updates are flowing. */
export function ConnectionStatus() {
  const { status, transportName } = useRealtime();
  return (
    <p
      role="status"
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
    >
      <span aria-hidden className={cn("size-2 rounded-full", DOTS[status])} />
      {LABELS[status]}
      <span className="text-slate-500">· {transportName}</span>
    </p>
  );
}

/** Explains what a lost connection means for the user, only while it is lost. */
export function ConnectionBanner() {
  const { status } = useRealtime();
  if (status !== "reconnecting" && status !== "offline") return null;
  return (
    <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
      Live updates are paused. Your own changes still save, and the list catches up automatically
      when the connection is back.
    </p>
  );
}
