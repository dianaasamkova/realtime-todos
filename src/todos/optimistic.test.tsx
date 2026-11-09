import { act, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TodoPatch } from "../../shared/todo.ts";
import { api, byName, db, todoUrl } from "../test/api";
import { fakeSocket } from "../test/fakeSocket";
import { moveSlider } from "../test/slider";
import { renderApp } from "../test/renderApp";
import { UNDO_MS } from "./useUndoableDelete";

afterEach(() => {
  vi.useRealTimers();
});

const fail = (message: string) => () => HttpResponse.json({ message }, { status: 500 });

describe("optimistic edits", () => {
  test("a rename shows immediately, before the server answers", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    api.use(
      http.patch(todoUrl("/:id"), async () => {
        await gate;
        return fail("late")();
      }),
    );
    const { user } = renderApp();
    await screen.findByText("Write specs");

    await user.click(screen.getAllByRole("button", { name: /^(edit|rename)/i })[0]);
    await user.clear(screen.getByRole("textbox", { name: "New name" }));
    await user.keyboard("Renamed{Enter}");

    expect(screen.getByText("Renamed")).toBeInTheDocument();
    release();
  });

  test("a failed rename rolls back and explains why", async () => {
    api.use(http.patch(todoUrl("/:id"), fail("Database unavailable")));
    const { user } = renderApp();
    await screen.findByText("Write specs");

    await user.click(screen.getAllByRole("button", { name: /^(edit|rename)/i })[0]);
    await user.clear(screen.getByRole("textbox", { name: "New name" }));
    await user.keyboard("Renamed{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save “Write specs”. Database unavailable",
    );
    expect(screen.getByText("Write specs")).toBeInTheDocument();
    expect(screen.queryByText("Renamed")).not.toBeInTheDocument();
  });

  test("a failed delete puts the todo back in its place and explains why", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.use(http.delete(todoUrl("/:id"), fail("Database unavailable")));
    const { user } = renderApp("/", { fakeTimers: true });
    await screen.findByText("Write specs");

    await user.click(screen.getAllByRole("button", { name: /delete/i })[0]);
    await vi.advanceTimersByTimeAsync(UNDO_MS);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't delete “Write specs”. Database unavailable",
    );
    await waitFor(() => {
      const sliders = screen.getAllByRole("slider");
      expect(sliders).toHaveLength(2);
      expect(sliders[0]).toHaveAttribute("aria-valuenow", "10");
    });
  });
});

describe("overlapping edits", () => {
  test("an earlier save's response does not undo a newer edit still in flight", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const releases: Array<() => void> = [];
    api.use(
      http.patch(todoUrl("/:id"), async ({ request, params }) => {
        await new Promise<void>((resolve) => releases.push(resolve));
        const change = db.update(String(params.id), (await request.json()) as TodoPatch)!;
        // The server's broadcast reaches this tab before the HTTP response.
        act(() => fakeSocket.serverEmit("todo:updated", change));
        return HttpResponse.json(change);
      }),
    );
    const { user } = renderApp("/", { fakeTimers: true });
    await screen.findByText("Write specs");

    await user.click(screen.getByRole("button", { name: "Rename “Write specs”" }));
    await user.clear(screen.getByRole("textbox", { name: "New name" }));
    await user.keyboard("Renamed{Enter}");
    const slider = screen.getByRole("slider", { name: "Progress for “Renamed”" });
    moveSlider(slider, 30);
    await vi.advanceTimersByTimeAsync(1000);
    await waitFor(() => expect(releases).toHaveLength(2));

    releases[0](); // the rename's response: progress is still 10 on the server
    await vi.advanceTimersByTimeAsync(50);
    expect(slider).toHaveAttribute("aria-valuenow", "30");
    expect(screen.getByText("Renamed")).toBeInTheDocument();

    releases[1]();
    await waitFor(() => expect(byName("Renamed").progress).toBe(30));
    expect(slider).toHaveAttribute("aria-valuenow", "30");
  });
});
