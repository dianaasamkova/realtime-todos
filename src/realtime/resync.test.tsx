import { act, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { api, db, requests, serverWrite, todoUrl } from "../test/api";
import { fakeSocket } from "../test/fakeSocket";
import { renderApp } from "../test/renderApp";

/** List loads only (the revision check is a GET too). */
const gets = () => requests.filter((r) => r.method === "GET" && r.path === "/api/todos").length;

/** Holds the next list request until `release()`; `snapshot` picks when the server reads data. */
function gateNextList({ snapshotAtRequest }: { snapshotAtRequest: boolean }) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  api.use(
    http.get(
      todoUrl(),
      async () => {
        const early = structuredClone(db.snapshot());
        await gate;
        return HttpResponse.json(snapshotAtRequest ? early : db.snapshot());
      },
      { once: true },
    ),
  );
  return release;
}

describe("refetching while events arrive", () => {
  test("a reload served before a later change still ends with that change", async () => {
    renderApp();
    await screen.findByText("Write specs");
    const before = gets();
    const release = gateNextList({ snapshotAtRequest: true });

    // A write this tab missed, then a reconnect: the revision check triggers a reload.
    db.create({ name: "Missed while offline", description: "No event for this one" });
    fakeSocket.recovered = false;
    act(() => fakeSocket.serverEmit("connect"));
    await waitFor(() => expect(gets()).toBe(before + 1));

    // Another change lands while the reload is in flight; the reload was served before it.
    const change = serverWrite.update("Write specs", { progress: 77 });
    act(() => fakeSocket.serverEmit("todo:updated", change));
    release();

    const slider = screen.getByRole("slider", { name: "Progress for “Write specs”" });
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "77"));
    expect(screen.getByText("Missed while offline")).toBeInTheDocument();
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
