import axios from "axios";
import CardComponent from "../../components/Card/Card";
import CreateForm from "../../components/Form/Form";
import { Box } from "@mui/material";
import type { NewTodo, Todo, TodoPatch } from "../../../shared/todo.ts";
import { API_URL } from "../../config";
import { useTodos } from "../../context/ToDosContext";
import { removeTodo, upsertTodo } from "../../todos/cache";

function HomePage() {
  const { todos, setTodos } = useTodos();

  const deleteTodo = async (id: string) => {
    try {
      await axios.delete(`${API_URL}/api/todos/${id}`);
      setTodos((prev) => removeTodo(prev, id));
    } catch (e) {
      console.log("Delete request has failed", (e as Error).message);
    }
  };

  const createTodo = async (item: NewTodo) => {
    try {
      const { data } = await axios.post<Todo>(`${API_URL}/api/todos`, item);
      setTodos((prev) => upsertTodo(prev, data));
    } catch (e) {
      console.log("Create request has failed", (e as Error).message);
    }
  };

  const editTodo = async (id: string, patch: TodoPatch) => {
    try {
      const { data } = await axios.patch<Todo>(`${API_URL}/api/todos/${id}`, patch);
      setTodos((prev) => upsertTodo(prev, data));
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
