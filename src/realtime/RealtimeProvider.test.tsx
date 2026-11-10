import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { todosApi } from "@/features/todos/api";
import { db, requests, serverWrite } from "@/test/api-mock";
import { fakeSocket } from "@/test/fake-socket";
import { connectRealtime, renderApp } from "@/test/render-app";

const gets = () => requests.filter((r) => r.method === "GET").length;

describe("first load", () => {
  // In a browser the list request can finish before the realtime handshake does; a resync on
  // that first connect then loaded the list a second time (seen as two GETs in Chromium).
  test.each(["/", "/centrifugo"])("loads the list once when %s opens", async (path) => {
    // Counted at the client: a request cancelled right away never reaches the mock.
    const list = vi.spyOn(todosApi, "list");
    renderApp(path, { connected: false });
    await new Promise((resolve) => setTimeout(resolve, 30));
    connectRealtime();

    await screen.findByText("Write specs");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(list).toHaveBeenCalledTimes(1);
  });

  test("still loads the list when the realtime connection doesn't come up", async () => {
    renderApp("/", { connected: false });
    expect(await screen.findByText("Write specs", {}, { timeout: 3000 })).toBeInTheDocument();
  });
});

describe("realtime sync", () => {
  test("shows todos created and removes todos deleted in other tabs", async () => {
    renderApp();
    await screen.findByText("Write specs");

    act(() => fakeSocket.serverEmit("todo:created", serverWrite.create("From another tab")));
    expect(await screen.findByText("From another tab")).toBeInTheDocument();

    act(() => fakeSocket.serverEmit("todo:deleted", serverWrite.remove("Ship it")));
    await waitFor(() => expect(screen.queryByText("Ship it")).not.toBeInTheDocument());
  });

  test("refetches after a reconnect that could not replay missed events", async () => {
    renderApp();
    await screen.findByText("Write specs");
    db.create({ name: "Added while offline", description: "Missed event" });

    fakeSocket.recovered = false;
    act(() => fakeSocket.serverEmit("connect"));

    expect(await screen.findByText("Added while offline")).toBeInTheDocument();
  });

  test("does not refetch after a recovered reconnect", async () => {
    renderApp();
    await screen.findByText("Write specs");
    const before = gets();

    fakeSocket.recovered = true;
    act(() => fakeSocket.serverEmit("connect"));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(gets()).toBe(before);
  });
});
