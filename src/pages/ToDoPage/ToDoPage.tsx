import Typography from "@mui/material/Typography";
import React, { useMemo } from "react";
import { useParams, Link } from "react-router";
import { useTodos } from "../../context/ToDosContext";

const TodoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { todos } = useTodos();

  const todo = useMemo(() => todos.find((item) => item._id === id), [todos, id]);

  return (
    <div>
      {todo ? (
        <div>
          <Typography variant="h6" component="div" gutterBottom>
            {todo.name}
          </Typography>
          <Typography variant="body2" component="div" gutterBottom>
            {todo.description}
          </Typography>
        </div>
      ) : (
        <div>
          <Typography variant="caption" component="div" gutterBottom>
            No To_Do found
          </Typography>
        </div>
      )}
      <Typography variant="body2" component="div">
        <Link to="/">Return to Home</Link>
      </Typography>
    </div>
  );
};

export default TodoPage;
