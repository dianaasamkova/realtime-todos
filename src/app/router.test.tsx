import { act, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { transports } from "@/features/realtime/transports";
import { byName, serverWrite } from "@/test/api-mock";
import { fakeCentrifuge } from "@/test/fake-centrifuge";
import { fakeSocket } from "@/test/fake-socket";
import { renderApp } from "@/test/render-app";

describe("transport pages", () => {
  test("the Centrifugo page lists todos and shows its own connection", async () => {
    renderApp("/centrifugo");
    expect(await screen.findByText("Write specs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Centrifugo" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    act(() => fakeCentrifuge.client.emit("connected"));
    expect(screen.getByText(/Live/)).toHaveTextContent("Centrifugo");
  });

  test("applies Centrifugo publications to the list", async () => {
    renderApp("/centrifugo");
    await screen.findByText("Write specs");
    const created = serverWrite.create("Via Centrifugo");

    act(() =>
      fakeCentrifuge.subscription.emit("publication", {
        data: created,
      }),
    );

    expect(await screen.findByText("Via Centrifugo")).toBeInTheDocument();
  });

  test("links stay on the transport the user picked", async () => {
    const { user, router } = renderApp("/centrifugo");
    await screen.findByText("Write specs");

    await user.click(screen.getByRole("link", { name: "Write specs" }));
    expect(router.state.location.pathname).toBe(`/centrifugo/todo/${byName("Write specs")._id}`);

    await user.click(screen.getByRole("link", { name: "All todos" }));
    expect(router.state.location.pathname).toBe("/centrifugo");
  });

  test("the socket.io page does not open a Centrifugo connection", async () => {
    renderApp("/");
    await screen.findByText("Write specs");
    expect(fakeCentrifuge.connected).toBe(false);
    expect(screen.getByRole("link", { name: "socket.io" })).toHaveAttribute("aria-current", "page");
    act(() => fakeSocket.serverEmit("connect"));
    expect(screen.getByText(/Live/)).toHaveTextContent("socket.io");
  });

  test("starts loading the Centrifugo client when its link is hovered or focused", async () => {
    const preload = vi.spyOn(transports.centrifugo, "preload");
    const { user } = renderApp("/");
    await screen.findByText("Write specs");
    const link = screen.getByRole("link", { name: "Centrifugo" });

    await user.hover(link);
    expect(preload).toHaveBeenCalledTimes(1);
    act(() => link.focus());
    expect(preload).toHaveBeenCalledTimes(2);
  });

  test("a failed download of the Centrifugo client doesn't break the page", async () => {
    vi.spyOn(transports.centrifugo, "preload").mockRejectedValue(new Error("offline"));
    const { user } = renderApp("/");
    await screen.findByText("Write specs");

    await user.hover(screen.getByRole("link", { name: "Centrifugo" }));

    expect(screen.getByText("Write specs")).toBeInTheDocument();
  });

  test("unknown paths show a not-found page", async () => {
    renderApp("/nope");
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });

  test.each([
    ["/nope", "/"],
    ["/centrifugo/nope", "/centrifugo"],
  ])("the not-found page on %s links back to the list at %s", async (path, home) => {
    const { user, router } = renderApp(path);
    await user.click(await screen.findByRole("link", { name: "Go to the todo list" }));
    expect(router.state.location.pathname).toBe(home);
    expect(await screen.findByText("Write specs")).toBeInTheDocument();
  });
});
