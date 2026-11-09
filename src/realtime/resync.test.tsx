import { act, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { api, byName, db, requests, todoUrl } from "../test/api";
import { fakeSocket } from "../test/fakeSocket";
import { renderApp } from "../test/renderApp";

const gets = () => requests.filter((r) => r.method === "GET").length;

/** Holds the next list request until `release()`; `snapshot` picks when the server reads data. */
function gateNextList({ snapshotAtRequest }: { snapshotAtRequest: boolean }) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  api.use(
    http.get(
      todoUrl(),
      async () => {
        const early = structuredClone(db.list());
        await gate;
        return HttpResponse.json(snapshotAtRequest ? early : db.list());
      },
      { once: true },
    ),
  );
  return release;
}

describe("refetching while events arrive", () => {
  test("a list response served before an event does not undo that event", async () => {
    renderApp();
    await screen.findByText("Write specs");
    const before = gets();
    const release = gateNextList({ snapshotAtRequest: true });

    fakeSocket.recovered = false;
    act(() => fakeSocket.serverEmit("connect"));
    await waitFor(() => expect(gets()).toBe(before + 1));

    const todo = db.update(byName("Write specs")._id, { progress: 77 })!;
    act(() => fakeSocket.serverEmit("todo:updated", { type: "todo:updated", todo }));
    const slider = screen.getByRole("slider", { name: "Progress for “Write specs”" });
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "77"));

    release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(slider).toHaveAttribute("aria-valuenow", "77");
  });

  test("an edit during a catch-up refetch does not drop the catch-up", async () => {
    const { user } = renderApp();
    await screen.findByText("Write specs");
    const before = gets();
    const release = gateNextList({ snapshotAtRequest: false });
    db.create({ name: "Missed while offline", description: "No event for this one" });

    fakeSocket.recovered = false;
    act(() => fakeSocket.serverEmit("connect"));
    await waitFor(() => expect(gets()).toBe(before + 1));

    await user.click(screen.getByRole("button", { name: "Rename “Ship it”" }));
    await user.keyboard(" now{Enter}");
    release();

    expect(await screen.findByText("Missed while offline")).toBeInTheDocument();
  });
});
