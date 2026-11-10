import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Todo } from "@contract/todos";
import { useNotify } from "@/shared/notices/Notices";
import { useDeleteTodo } from "./queries";

/** How long the Undo notice stays on screen. */
export const UNDO_MS = 5000;
/**
 * The server delete waits a little longer than the notice, so an Undo click that lands as the
 * notice closes still finds the delete pending.
 */
export const DELETE_GRACE_MS = 500;

/**
 * Deleting hides the todo at once and offers Undo; the server delete is sent only after
 * the undo window closes, or right away if the user leaves the page.
 */
export function useUndoableDelete() {
  const { mutate } = useDeleteTodo();
  const notify = useNotify();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const undoNotices = useRef(new Map<string, () => void>());
  const mutateRef = useRef(mutate);
  useLayoutEffect(() => {
    mutateRef.current = mutate;
  });

  const unhide = useCallback((id: string) => {
    setHidden((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const stopTimer = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    undoNotices.current.delete(id);
  }, []);

  const commit = useCallback(
    (id: string) => {
      stopTimer(id);
      // The optimistic delete removes it from the cache; if the server refuses, it comes back.
      mutateRef.current(id, { onSettled: () => unhide(id) });
    },
    [stopTimer, unhide],
  );

  const scheduleDelete = useCallback(
    (todo: Todo) => {
      setHidden((current) => new Set(current).add(todo._id));
      timers.current.set(
        todo._id,
        setTimeout(() => commit(todo._id), UNDO_MS + DELETE_GRACE_MS),
      );
      const dismissNotice = notify({
        message: `Deleted “${todo.name}”.`,
        durationMs: UNDO_MS,
        action: {
          label: "Undo",
          onClick: () => {
            stopTimer(todo._id);
            unhide(todo._id);
          },
        },
      });
      undoNotices.current.set(todo._id, dismissNotice);
    },
    [commit, notify, stopTimer, unhide],
  );

  useEffect(() => {
    const pending = timers.current;
    const notices = undoNotices.current;
    return () => {
      for (const [id, timer] of pending) {
        clearTimeout(timer);
        mutateRef.current(id);
      }
      pending.clear();
      // The delete is on its way now, so an Undo button would promise something it can't do.
      notices.forEach((dismiss) => dismiss());
      notices.clear();
    };
  }, []);

  return { hidden, scheduleDelete };
}
