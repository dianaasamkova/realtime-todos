import { useId, useState, type FormEvent } from "react";
import { MAX_TEXT_LENGTH, type NewTodo } from "../../shared/todo.ts";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface AddTodoFormProps {
  /** Rejects with a user-facing message if the todo could not be added. */
  onAdd: (todo: NewTodo) => Promise<void>;
}

const EMPTY = { name: "", description: "" };

export function AddTodoForm({ onAdd }: AddTodoFormProps) {
  const id = useId();
  const [draft, setDraft] = useState(EMPTY);
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit = !isSubmitting && draft.name.trim() !== "" && draft.description.trim() !== "";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      await onAdd(draft);
      setDraft(EMPTY);
    } catch (err) {
      // Keep the input so the user can retry without retyping.
      setError(`Couldn't add the todo. ${err instanceof Error ? err.message : ""}`.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby={`${id}-title`}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id={`${id}-title`} className="text-sm font-semibold">
        Add a todo
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-name`} className="text-xs font-medium text-slate-700">
            Name
          </label>
          <Input
            id={`${id}-name`}
            required
            maxLength={MAX_TEXT_LENGTH}
            value={draft.name}
            onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-description`} className="text-xs font-medium text-slate-700">
            Description
          </label>
          <Input
            id={`${id}-description`}
            required
            maxLength={MAX_TEXT_LENGTH}
            value={draft.description}
            onChange={(event) => setDraft((d) => ({ ...d, description: event.target.value }))}
          />
        </div>
        <Button type="submit" disabled={!canSubmit}>
          {isSubmitting ? "Adding…" : "Add todo"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
