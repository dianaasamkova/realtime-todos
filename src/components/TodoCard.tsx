import { Pencil, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Link } from "react-router";
import type { Todo, TodoPatch } from "@contract/todos";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { cn } from "@/lib/cn";
import { useRemoteHighlight } from "@/realtime/RealtimeProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

interface TodoCardProps {
  todo: Todo;
  onEdit: (id: string, patch: TodoPatch) => void;
  onDelete: (todo: Todo) => void;
}

/** Waits for a pause in dragging before saving, so a drag sends one request. */
const SAVE_DELAY_MS = 1000;

export function TodoCard({ todo, onEdit, onDelete }: TodoCardProps) {
  const titleId = useId();
  const highlighted = useRemoteHighlight(todo._id);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(todo.name);

  // Local slider value keeps dragging smooth; it re-syncs when the stored progress changes
  // (e.g. someone else moved it).
  const [progress, setProgress] = useState(todo.progress);
  const [syncedProgress, setSyncedProgress] = useState(todo.progress);
  if (todo.progress !== syncedProgress) {
    setSyncedProgress(todo.progress);
    setProgress(todo.progress);
  }
  const isDone = progress === 100;

  // Flushed if the card unmounts mid-wait, cancelled if the todo is deleted.
  const saveProgress = useDebouncedCallback((value: number) => {
    onEdit(todo._id, { progress: value });
  }, SAVE_DELAY_MS);

  // Each rename starts from the current name. Enter or leaving the field saves (so a phone's
  // Done button doesn't lose the text); Escape or the Rename button cancels.
  // Closed synchronously by Escape, Enter or the button: some browsers fire blur when the
  // field is removed, and that late blur must not save (again).
  const renameOpen = useRef(false);
  const startRename = () => {
    renameOpen.current = true;
    setDraftName(todo.name);
    setIsRenaming(true);
  };
  const cancelRename = () => {
    renameOpen.current = false;
    setDraftName(todo.name);
    setIsRenaming(false);
  };
  const submitRename = () => {
    if (!renameOpen.current) return;
    renameOpen.current = false;
    const name = draftName.trim();
    if (name && name !== todo.name) onEdit(todo._id, { name });
    setIsRenaming(false);
  };

  const handleDelete = () => {
    saveProgress.cancel();
    onDelete(todo);
  };

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow duration-500",
        highlighted && "ring-2 ring-sky-400",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 grow">
          {isRenaming ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitRename();
              }}
            >
              <Input
                aria-label="New name"
                value={draftName}
                maxLength={200}
                autoFocus
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={submitRename}
                onKeyDown={(event) => {
                  if (event.key === "Escape") cancelRename();
                }}
              />
            </form>
          ) : (
            <h3 id={titleId} className="text-base font-semibold break-words">
              <Link
                to={`todo/${todo._id}`}
                className={cn(
                  "rounded-sm hover:text-sky-700 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none",
                  isDone && "text-slate-500 line-through",
                )}
              >
                {todo.name}
              </Link>
            </h3>
          )}
          <p className="mt-1 text-sm break-words text-slate-600">{todo.description}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {highlighted && (
            <span className="mr-1 text-xs font-medium text-sky-700">Updated just now</span>
          )}
          {isDone && <Badge>Done</Badge>}
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Rename “${todo.name}”`}
            // Keep focus in the field, so this click cancels instead of blur-saving first.
            onMouseDown={(event) => isRenaming && event.preventDefault()}
            onClick={isRenaming ? cancelRename : startRename}
          >
            <Pencil aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete “${todo.name}”`}
            className="hover:bg-red-50 hover:text-red-700"
            onClick={handleDelete}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Slider
          label={`Progress for “${todo.name}”`}
          valueText={`${progress}%`}
          value={[progress]}
          max={100}
          step={1}
          rangeClassName={isDone ? "bg-emerald-600" : undefined}
          onValueChange={([value]) => {
            setProgress(value);
            saveProgress.schedule(value);
          }}
        />
        <span aria-hidden className="w-10 text-right text-sm text-slate-600 tabular-nums">
          {progress}%
        </span>
      </div>
    </article>
  );
}
