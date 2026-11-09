import CardComponent from "../../components/Card/Card";
import CreateForm from "../../components/Form/Form";
import { Box } from "@mui/material";
import type { NewTodo, TodoPatch } from "../../../shared/todo.ts";
import { todosApi } from "../../api/todos";
import { useTodos } from "../../context/ToDosContext";
import { removeTodo, upsertTodo } from "../../todos/cache";

function HomePage() {
  const { todos, setTodos } = useTodos();

  const deleteTodo = async (id: string) => {
    try {
      await todosApi.remove(id);
      setTodos((prev) => removeTodo(prev, id));
    } catch (e) {
      console.log("Delete request has failed", (e as Error).message);
    }
  };

  // Errors propagate to the form, which keeps the input and shows the message.
  const createTodo = async (item: NewTodo) => {
    const created = await todosApi.create(item);
    setTodos((prev) => upsertTodo(prev, created));
  };

  const editTodo = async (id: string, patch: TodoPatch) => {
    try {
      const updated = await todosApi.update(id, patch);
      setTodos((prev) => upsertTodo(prev, updated));
    } catch (e) {
      console.log("Edit request has failed", (e as Error).message);
    }
  };

  return (
    <Box p={3}>
      {todos.map((item) => (
        <CardComponent key={item._id} deleteTodo={deleteTodo} editTodo={editTodo} item={item} />
      ))}
      <CreateForm createTodo={createTodo} />
    </Box>
  );
}

export default HomePage;
