import { createBrowserRouter, RouterProvider } from "react-router";
import HomePage from "./pages/HomePage/HomePage";
import { TodosProvider } from "./context/ToDosContext";
import TodoPage from "./pages/ToDoPage/ToDoPage";
import { SocketProvider } from "./providers/SocketProvider";

const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  {
    path: "todo/:id",
    element: <TodoPage />,
  },
]);
function App() {
  return (
    <TodosProvider>
      <SocketProvider>
        <RouterProvider router={router} />
      </SocketProvider>
    </TodosProvider>
  );
}

export default App;
