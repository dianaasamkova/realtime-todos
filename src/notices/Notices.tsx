import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface Notice {
  id: number;
  message: string;
}

const NotifyContext = createContext<(message: string) => void>(() => {});

/** Shows an error message to the user (e.g. a failed save that was rolled back). */
export const useNotifyError = () => useContext(NotifyContext);

let nextId = 1;

export function NoticesProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);

  const notify = useCallback((message: string) => {
    setNotices((current) => [...current, { id: nextId++, message }]);
  }, []);
  const dismiss = (id: number) => setNotices((current) => current.filter((n) => n.id !== id));

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <div className="notices">
        {notices.map((notice) => (
          <div key={notice.id} role="alert" className="notice">
            <span>{notice.message}</span>
            <button type="button" onClick={() => dismiss(notice.id)}>
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </NotifyContext.Provider>
  );
}
