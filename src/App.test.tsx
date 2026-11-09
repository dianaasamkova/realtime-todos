import React from "react";
import {act, render, screen} from "@testing-library/react";
import axios from "axios";
import App from "./App";

type Handler = (payload: unknown) => void;
const mockHandlers: Record<string, Handler> = {};
const mockDisconnect = jest.fn();

jest.mock("socket.io-client", () => ({
    __esModule: true,
    default: () => ({
        on: (event: string, handler: Handler) => {
            mockHandlers[event] = handler;
        },
        disconnect: mockDisconnect,
    }),
}));
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const TODOS = [
    {_id: "a", name: "Write specs", description: "Acceptance criteria first", progress: 10},
    {_id: "b", name: "Ship it", description: "Behind a feature flag", progress: 50},
];

beforeEach(() => {
    mockedAxios.get.mockResolvedValue({data: TODOS});
});

test("renders todos loaded from the API", async () => {
    render(<App/>);
    expect(await screen.findByText("Write specs")).toBeInTheDocument();
    expect(screen.getByText("Ship it")).toBeInTheDocument();
    expect(mockedAxios.get).toHaveBeenCalledWith("http://localhost:8000/api/todos");
});

test("applies a progress update pushed over the socket", async () => {
    render(<App/>);
    await screen.findByText("Write specs");
    const [first, second] = screen.getAllByRole("slider");
    expect(first).toHaveAttribute("aria-valuenow", "10");

    act(() => mockHandlers["update-todo-progress"]({_id: "a", progress: 80}));

    expect(first).toHaveAttribute("aria-valuenow", "80");
    expect(second).toHaveAttribute("aria-valuenow", "50"); // other todos are untouched
});
