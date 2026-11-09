import { Box } from "@mui/material";
import type { NewTodo, TodoPatch } from "../../../shared/todo.ts";
import CardComponent from "../../components/Card/Card";
import CreateForm from "../../components/Form/Form";
import { LoadStatus } from "../../components/LoadStatus/LoadStatus";
import { useCreateTodo, useDeleteTodo, useTodosQuery, useUpdateTodo } from "../../todos/queries";

function HomePage() {
  const todos = useTodosQuery();
  const create = useCreateTodo();
  const update = useUpdateTodo();
  const remove = useDeleteTodo();

  // Errors propagate to the form, which keeps the input and shows the message.
  const createTodo = async (item: NewTodo) => {
    await create.mutateAsync(item);
  };
  const editTodo = (id: string, patch: TodoPatch) => update.mutate({ id, patch });
  const deleteTodo = (id: string) => remove.mutate(id);

  return (
    <Box p={3}>
      <LoadStatus query={todos} />
      {todos.data?.map((item) => (
        <CardComponent key={item._id} deleteTodo={deleteTodo} editTodo={editTodo} item={item} />
      ))}
      <CreateForm createTodo={createTodo} />
    </Box>
  );
}

export default HomePage;
