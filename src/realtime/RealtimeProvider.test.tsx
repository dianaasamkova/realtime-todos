import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { byName, db, requests } from "../test/api";
import { fakeSocket } from "../test/fakeSocket";
import { renderApp } from "../test/renderApp";

const gets = () => requests.filter((r) => r.method === "GET").length;

describe("realtime sync", () => {
  test("shows todos created and removes todos deleted in other tabs", async () => {
    renderApp();
    await screen.findByText("Write specs");

    const created = db.create({ name: "From another tab", description: "Hello" });
    act(() => fakeSocket.serverEmit("todo:created", { type: "todo:created", todo: created }));
    expect(await screen.findByText("From another tab")).toBeInTheDocument();

    const removed = byName("Ship it");
    act(() => fakeSocket.serverEmit("todo:deleted", { type: "todo:deleted", _id: removed._id }));
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
