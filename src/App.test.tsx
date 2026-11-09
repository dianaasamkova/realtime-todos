import { act, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { byName } from "./test/api";
import { fakeSocket } from "./test/fakeSocket";
import { renderApp } from "./test/renderApp";

test("renders todos loaded from the API", async () => {
  renderApp();
  expect(await screen.findByText("Write specs")).toBeInTheDocument();
  expect(screen.getByText("Ship it")).toBeInTheDocument();
});

test("applies a progress update pushed over the socket to that todo only", async () => {
  renderApp();
  await screen.findByText("Write specs");
  const [first, second] = screen.getAllByRole("slider");
  expect(first).toHaveAttribute("aria-valuenow", "10");

  const todo = byName("Write specs");
  act(() =>
    fakeSocket.serverEmit("todo:updated", {
      type: "todo:updated",
      todo: { ...todo, progress: 80, version: todo.version + 1 },
    }),
  );

  expect(first).toHaveAttribute("aria-valuenow", "80");
  expect(second).toHaveAttribute("aria-valuenow", "50");
});
