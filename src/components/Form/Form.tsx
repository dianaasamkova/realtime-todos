import React, { useState } from "react";
import { TextField, Button } from "@mui/material";
import { styled } from "@mui/material/styles";
import type { NewTodo } from "../../../shared/todo.ts";

interface TodoFormProps {
  createTodo: (todo: NewTodo) => void;
}

const CreateForm: React.FC<TodoFormProps> = ({ createTodo }) => {
  const [newTodo, setNewTodo] = useState<NewTodo>({ name: "", description: "", progress: 0 });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createTodo(newTodo);
    setNewTodo({ name: "", description: "", progress: 0 });
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
      <Button type="submit" disabled={!newTodo.name || !newTodo.description}>
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
