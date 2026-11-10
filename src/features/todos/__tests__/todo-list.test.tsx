import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { todosApi } from "@/features/todos/api";
import { http, HttpResponse } from "msw";
import { api, byName, db, requests, todoUrl } from "@/test/api-mock";
import { renderApp } from "@/test/render-app";
import { DELETE_GRACE_MS, UNDO_MS } from "@/features/todos/use-undoable-delete";
import { moveSlider } from "@/test/slider";

afterEach(() => {
  vi.useRealTimers();
});

describe("saving progress", () => {
  test("waits for the user to stop dragging before saving", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const update = vi.spyOn(todosApi, "update");
    renderApp();
    await screen.findByText("Write specs");
    const [slider] = screen.getAllByRole("slider");

    moveSlider(slider, 30);
    moveSlider(slider, 70);
    expect(update).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(update).toHaveBeenCalledExactlyOnceWith(byName("Write specs")._id, { progress: 70 });
  });

  test("does not save progress for a todo deleted while the save is pending", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const update = vi.spyOn(todosApi, "update");
    const { user } = renderApp("/", { fakeTimers: true });
    await screen.findByText("Write specs");

    moveSlider(screen.getAllByRole("slider")[0], 70);
    await user.click(screen.getAllByRole("button", { name: /delete/i })[0]);
    await waitFor(() => expect(screen.queryByText("Write specs")).not.toBeInTheDocument());
    await vi.advanceTimersByTimeAsync(1500);

    expect(update).not.toHaveBeenCalled();
  });

  test("sends a pending save right away when the user leaves the page", async () => {
    const update = vi.spyOn(todosApi, "update");
    const { user } = renderApp();
    await screen.findByText("Write specs");

    moveSlider(screen.getAllByRole("slider")[0], 70);
    await user.click(screen.getByRole("link", { name: /write specs/i }));

    expect(update).toHaveBeenCalledExactlyOnceWith(byName("Write specs")._id, { progress: 70 });
  });
});

describe("loading the list", () => {
  test("shows a loading message first", async () => {
    renderApp();
    expect(screen.getByText(/loading todos/i)).toBeInTheDocument();
    expect(await screen.findByText("Write specs")).toBeInTheDocument();
    expect(screen.queryByText(/loading todos/i)).not.toBeInTheDocument();
  });

  test("shows an error with Retry, and recovers", async () => {
    api.use(http.get(todoUrl(), () => HttpResponse.error(), { once: true }));
    const { user } = renderApp();

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load todos.");
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Write specs")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("deleting with undo", () => {
  const deletes = () => requests.filter((r) => r.method === "DELETE");

  test("hides the todo at once and Undo brings it back without a server delete", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = renderApp("/", { fakeTimers: true });
    await screen.findByText("Write specs");

    await user.click(screen.getByRole("button", { name: "Delete “Write specs”" }));
    expect(screen.queryByText("Write specs")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Write specs")).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(UNDO_MS + 100);
    expect(deletes()).toEqual([]);
  });

  test("sends the delete once the undo window closes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = renderApp("/", { fakeTimers: true });
    await screen.findByText("Write specs");
    const { _id } = byName("Write specs");

    await user.click(screen.getByRole("button", { name: "Delete “Write specs”" }));
    expect(screen.getByText("Deleted “Write specs”.")).toBeInTheDocument();
    expect(deletes()).toEqual([]);

    await vi.advanceTimersByTimeAsync(UNDO_MS);
    await waitFor(() =>
      expect(deletes()).toEqual([{ method: "DELETE", path: `/api/todos/${_id}` }]),
    );
    expect(screen.queryByText("Write specs")).not.toBeInTheDocument();
  });

  test("never deletes while the Undo button is still on screen", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = renderApp("/", { fakeTimers: true });
    await screen.findByText("Write specs");

    await user.click(screen.getByRole("button", { name: "Delete “Write specs”" }));
    await vi.advanceTimersByTimeAsync(UNDO_MS);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument(),
    );
    expect(deletes()).toEqual([]);

    await vi.advanceTimersByTimeAsync(DELETE_GRACE_MS);
    await waitFor(() => expect(deletes()).toHaveLength(1));
  });

  test("sends a pending delete right away when the user leaves the page", async () => {
    const remove = vi.spyOn(todosApi, "remove");
    const { user } = renderApp();
    await screen.findByText("Write specs");
    const { _id } = byName("Write specs");

    await user.click(screen.getByRole("button", { name: "Delete “Write specs”" }));
    await user.click(screen.getByRole("link", { name: "Ship it" }));

    await waitFor(() => expect(remove).toHaveBeenCalledExactlyOnceWith(_id));
  });
});

describe("filters and empty states", () => {
  test("filters by Active and Done and shows counts", async () => {
    db.update(byName("Ship it")._id, { progress: 100 });
    const { user } = renderApp();
    await screen.findByText("Write specs");

    expect(screen.getByRole("button", { name: "All 2" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Done 1" }));
    expect(screen.getByText("Ship it")).toBeInTheDocument();
    expect(screen.queryByText("Write specs")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Active 1" }));
    expect(screen.getByText("Write specs")).toBeInTheDocument();
    expect(screen.queryByText("Ship it")).not.toBeInTheDocument();
  });

  test("keeps the filter in the URL", async () => {
    db.update(byName("Ship it")._id, { progress: 100 });
    renderApp("/?filter=done");
    expect(await screen.findByText("Ship it")).toBeInTheDocument();
    expect(screen.queryByText("Write specs")).not.toBeInTheDocument();
  });

  test("explains an empty list", async () => {
    db.list().forEach((todo) => db.remove(todo._id));
    renderApp();
    expect(await screen.findByText(/No todos yet/)).toBeInTheDocument();
  });

  test("explains an empty filter", async () => {
    renderApp("/?filter=done");
    expect(await screen.findByText(/Nothing is done yet/)).toBeInTheDocument();
  });
});
