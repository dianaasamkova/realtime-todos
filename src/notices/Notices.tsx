import { X } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Button } from "../components/ui/button";
import { cn } from "../lib/cn";

export interface NoticeInput {
  message: string;
  /** Errors stay until dismissed and are announced assertively; info notices time out. */
  tone?: "error" | "info";
  action?: { label: string; onClick: () => void };
  durationMs?: number;
}

interface Notice extends NoticeInput {
  id: number;
}

const NotifyContext = createContext<(notice: NoticeInput) => void>(() => {});

export const useNotify = () => useContext(NotifyContext);

let nextId = 1;

export function NoticesProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);

  const dismiss = useCallback((id: number) => {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  const notify = useCallback(
    (input: NoticeInput) => {
      const notice = { tone: "info" as const, ...input, id: nextId++ };
      setNotices((current) => [...current, notice]);
      if (notice.tone === "info") setTimeout(() => dismiss(notice.id), notice.durationMs ?? 5000);
    },
    [dismiss],
  );

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <section
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {notices.map((notice) => (
          <div
            key={notice.id}
            role={notice.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg px-4 py-3 text-sm shadow-lg",
              notice.tone === "error"
                ? "bg-red-50 text-red-900 ring-1 ring-red-200"
                : "bg-slate-900 text-white",
            )}
          >
            <span className="grow">{notice.message}</span>
            {notice.action && (
              <Button
                size="sm"
                variant="outline"
                className="border-slate-500 bg-transparent text-inherit hover:bg-white/10"
                onClick={() => {
                  notice.action?.onClick();
                  dismiss(notice.id);
                }}
              >
                {notice.action.label}
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-inherit hover:bg-black/10 hover:text-inherit"
              aria-label="Dismiss"
              onClick={() => dismiss(notice.id)}
            >
              <X aria-hidden />
            </Button>
          </div>
        ))}
      </section>
    </NotifyContext.Provider>
  );
}
