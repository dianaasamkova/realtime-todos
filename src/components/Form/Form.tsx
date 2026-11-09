import React, { useState } from "react";
import { Alert, TextField, Button } from "@mui/material";
import { styled } from "@mui/material/styles";
import type { NewTodo } from "../../../shared/todo.ts";

interface TodoFormProps {
  /** Rejects with a user-facing message if the todo could not be added. */
  createTodo: (todo: NewTodo) => Promise<void>;
}

const CreateForm: React.FC<TodoFormProps> = ({ createTodo }) => {
  const [newTodo, setNewTodo] = useState<NewTodo>({ name: "", description: "", progress: 0 });
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      await createTodo(newTodo);
      setNewTodo({ name: "", description: "", progress: 0 });
    } catch (err) {
      // Keep the input so the user can retry without retyping.
      setError(`Couldn't add the todo. ${err instanceof Error ? err.message : ""}`.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormWrapper onSubmit={handleSubmit}>
      <TextField
        value={newTodo.name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setNewTodo((prev) => ({ ...prev, name: e.target.value }))
        }
        label="Name"
        required
      />
      <TextField
        value={newTodo.description}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setNewTodo((prev) => ({ ...prev, description: e.target.value }))
        }
        label="Description"
        required
      />
      {error && <Alert severity="error">{error}</Alert>}
      <Button
        type="submit"
        disabled={isSubmitting || !newTodo.name.trim() || !newTodo.description.trim()}
      >
        Add
      </Button>
    </FormWrapper>
  );
};

export default CreateForm;

const FormWrapper = styled("form")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  maxWidth: 400,
}));
