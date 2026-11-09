import Typography from "@mui/material/Typography";
import React from "react";
import { useParams, Link } from "react-router";
import { LoadStatus } from "../../components/LoadStatus/LoadStatus";
import { useTodosQuery } from "../../todos/queries";

const TodoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const todos = useTodosQuery();
  const todo = todos.data?.find((item) => item._id === id);

  return (
    <div>
      {!todos.data ? (
        <LoadStatus query={todos} />
      ) : todo ? (
        <div>
          <Typography variant="h6" component="div" gutterBottom>
            {todo.name}
          </Typography>
          <Typography variant="body2" component="div" gutterBottom>
            {todo.description}
          </Typography>
        </div>
      ) : (
        <Typography variant="body2" component="p" gutterBottom>
          This todo doesn't exist or was deleted.
        </Typography>
      )}
      <Typography variant="body2" component="div">
        <Link to="/">Return to Home</Link>
      </Typography>
    </div>
  );
};

export default TodoPage;
