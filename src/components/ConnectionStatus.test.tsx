import { act, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { fakeSocket } from "../test/fakeSocket";
import { renderApp } from "../test/renderApp";

const pill = () =>
  screen.getAllByRole("status").find((el) => el.textContent?.includes("socket.io"));

test("shows the connection state and explains a lost connection", async () => {
  renderApp();
  await screen.findByText("Write specs");
  expect(pill()).toHaveTextContent("Connecting…");

  act(() => fakeSocket.serverEmit("connect"));
  expect(pill()).toHaveTextContent("Live");
  expect(screen.queryByText(/Live updates are paused/)).not.toBeInTheDocument();

  act(() => fakeSocket.serverEmit("disconnect", "transport close"));
  expect(pill()).toHaveTextContent("Reconnecting…");
  expect(screen.getByText(/Live updates are paused/)).toBeInTheDocument();

  act(() => fakeSocket.serverEmit("connect"));
  expect(pill()).toHaveTextContent("Live");
});
