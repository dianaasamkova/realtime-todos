import React, {useCallback, useState} from "react";
import {Card, CardContent, Typography, IconButton, Slider, TextField} from "@mui/material";
import {Delete as DeleteIcon, Edit as EditIcon} from "@mui/icons-material";
import {styled} from "@mui/material/styles";
import type {ITodo} from "../../context/ToDosContext";
import {Link} from "react-router";
import debounce from "lodash.debounce";

interface CardProps {
    deleteTodo: (id: string) => void;
    editTodo: (item: ITodo) => void;
    item: ITodo;
}

const CardComponent: React.FC<CardProps> = ({deleteTodo, editTodo, item}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(item.name);
    const [slider, setSlider] = useState<number>(item.progress || 0)
    // Re-sync the local slider when the stored progress changes (e.g. a remote update).
    const [syncedProgress, setSyncedProgress] = useState(item.progress)
    if (item.progress !== syncedProgress) {
        setSyncedProgress(item.progress)
        setSlider(item.progress)
    }

    const handleEdit = () => {
        if (isEditing) {
            setNewName(item?.name)
            setIsEditing(false);
        } else {
            setIsEditing(true);
        }
    };

    // eslint-disable-next-line
    const debounceSlideUpdating = useCallback(debounce((value: number) => {
        editTodo({...item, progress: value})
    }, 1000), [item, editTodo]);


    function handleChange(_event: Event, newValue: number | number[]) {
        if (typeof newValue === "number") {
            setSlider(newValue);
            debounceSlideUpdating(newValue);
        }
    }

    return (

        <CardWrapper>
            <ContentWrapper>
                <RowWrapper>
                    {isEditing ? (
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (!newName || newName === item?.name) {
                                return
                            }
                            editTodo({...item, name: newName})
                            setIsEditing(false)
                        }}>
                            <TextField
                                type="text"
                                value={newName}
                                variant="standard"
                                onChange={(e) => setNewName(e.target.value)}
                                autoFocus
                                onBlur={() => setIsEditing(false)}
                                style={{marginRight: "10px", flex: 1}}
                            />
                        </form>
                    ) : (
                        <Link to={`/todo/${item._id}`} style={{textDecoration: "none", color: "inherit"}}>
                            <div>
                                <Typography variant="h6" component="div" gutterBottom>
                                    {item.name}
                                </Typography>
                                <Typography variant="body2" component="div" gutterBottom>
                                    {item.description}
                                </Typography>
                            </div>
                        </Link>

                    )}
                    <div>
                        <IconButton aria-label="edit" onClick={handleEdit} size="small">
                            <EditIcon fontSize="small"/>
                        </IconButton>
                        <IconButton aria-label="delete" onClick={() => deleteTodo(item._id)} size="small">
                            <DeleteIcon fontSize="small"/>
                        </IconButton>
                    </div>
                </RowWrapper>
                <SliderWrapper
                    value={slider}
                    onChange={handleChange}
                    valueLabelDisplay="auto"
                    aria-labelledby="non-linear-slider"
                />
            </ContentWrapper>
        </CardWrapper>
    );
};

export default CardComponent;

const CardWrapper = styled(Card)({
    minWidth: 275,
    maxWidth: 600,
    margin: "20px 0",
    borderRadius: 10,
});

const ContentWrapper = styled(CardContent)(({theme}) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: theme.spacing(2),
}));

const RowWrapper = styled("div")({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
});

const SliderWrapper = styled(Slider)(({theme}) => ({
    width: "100%",
    marginTop: theme.spacing(2),
}));
