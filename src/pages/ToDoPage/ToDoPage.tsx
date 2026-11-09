import Typography from "@mui/material/Typography";
import React, { useMemo } from "react";
import { useParams, Link } from "react-router";
import { LoadStatus } from "../../components/LoadStatus/LoadStatus";
import { useTodos } from "../../context/ToDosContext";

const TodoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { todos, load, reload } = useTodos();

  const todo = useMemo(() => todos.find((item) => item._id === id), [todos, id]);

  return (
    <div>
      {load.status !== "ready" ? (
        <LoadStatus load={load} onRetry={reload} />
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
