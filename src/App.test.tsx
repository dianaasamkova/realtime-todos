import { act, render, screen } from "@testing-library/react";
import axios from "axios";
import { beforeEach, expect, test, vi } from "vitest";
import App from "./App";

type Handler = (payload: unknown) => void;
const socket = vi.hoisted(() => ({ handlers: {} as Record<string, Handler> }));

vi.mock("socket.io-client", () => ({
  default: () => ({
    on: (event: string, handler: Handler) => {
      socket.handlers[event] = handler;
    },
    disconnect: vi.fn(),
  }),
}));
vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const TODOS = [
  { _id: "a", name: "Write specs", description: "Acceptance criteria first", progress: 10 },
  { _id: "b", name: "Ship it", description: "Behind a feature flag", progress: 50 },
];

beforeEach(() => {
  vi.mocked(axios.get).mockResolvedValue({ data: TODOS });
});

test("renders todos loaded from the API", async () => {
  render(<App />);
  expect(await screen.findByText("Write specs")).toBeInTheDocument();
  expect(screen.getByText("Ship it")).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith("http://localhost:8000/api/todos");
});

test("applies a progress update pushed over the socket", async () => {
  render(<App />);
  await screen.findByText("Write specs");
  const [first, second] = screen.getAllByRole("slider");
  expect(first).toHaveAttribute("aria-valuenow", "10");

  act(() => socket.handlers["update-todo-progress"]({ _id: "a", progress: 80 }));

  expect(first).toHaveAttribute("aria-valuenow", "80");
  expect(second).toHaveAttribute("aria-valuenow", "50"); // other todos are untouched
});
