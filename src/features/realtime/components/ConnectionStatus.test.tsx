import { act, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { fakeSocket } from "@/test/fake-socket";
import { renderApp } from "@/test/render-app";

const pill = () =>
  screen.getAllByRole("status").find((el) => el.textContent?.includes("socket.io"));

test("shows the connection state and explains a lost connection", async () => {
  renderApp("/", { connected: false });
  expect(pill()).toHaveTextContent("Connecting…");

  act(() => fakeSocket.serverEmit("connect"));
  expect(pill()).toHaveTextContent("Live");
  await screen.findByText("Write specs");
  expect(screen.queryByText(/Live updates are paused/)).not.toBeInTheDocument();

  act(() => fakeSocket.serverEmit("disconnect", "transport close"));
  expect(pill()).toHaveTextContent("Reconnecting…");
  expect(screen.getByText(/Live updates are paused/)).toBeInTheDocument();

  act(() => fakeSocket.serverEmit("connect"));
  expect(pill()).toHaveTextContent("Live");
});
