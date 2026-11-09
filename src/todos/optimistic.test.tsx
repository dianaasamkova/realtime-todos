import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, todoUrl } from "../test/api";
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
