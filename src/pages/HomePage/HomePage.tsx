import axios from "axios";
import CardComponent from "../../components/Card/Card";
import CreateForm from "../../components/Form/Form";
import { Box } from "@mui/material";
import { useTodos } from "../../context/ToDosContext";

export interface ITodo {
    _id: string;
    name: string;
    description: string;
    progress: number;
}
const API_URL = "http://localhost:8000/api";

function HomePage() {
    const { todos, setTodos } = useTodos();

    const deleteTodo = async (id: string) => {
        try {
            await axios.delete(`${API_URL}/todos/${id}`);
            setTodos((prev) => prev.filter((item) => item._id !== id))
        } catch (e) {
            console.log("Delete request has failed", (e as Error).message);
        }
    }

    const createTodo = async (item: Omit<ITodo, "_id">) => {
        try {
            const {data} = await axios.post<ITodo>(`${API_URL}/todos`, {
                _id: Math.random().toString(36).substring(2),
                name: item?.name,
                description: item?.description,
                progress: item?.progress
            });
            setTodos((prev) => [...prev, data])
        } catch (e) {
            console.log("Create request has failed", (e as Error).message);
        }
    }
    const editTodo = async (item: ITodo) => {
        try {
            const response = await axios.put<ITodo[]>(`${API_URL}/todos`, {
                _id: item?._id,
                name: item?.name,
                description: item?.description,
                progress: item?.progress
            });
            /**
             * recommend to update the backend and receive only the edited todo to maintain the order
             */
            setTodos(response.data);

        } catch (e) {
            console.log("Edit request has failed", (e as Error).message);
        }
    }

    return (
        <Box p={3}>
            {todos?.map((item: ITodo) => {
                return (
                    <CardComponent
                        key={item?._id}
                        deleteTodo={deleteTodo}
                        editTodo={editTodo}
                        item={item}
                    />
                )
            })}
            <CreateForm createTodo={createTodo}/>
        </Box>
    );
}

export default HomePage;
