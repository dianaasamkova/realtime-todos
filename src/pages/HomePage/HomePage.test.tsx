import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { todosApi } from "../../api/todos";
import { http, HttpResponse } from "msw";
import { api, byName, todoUrl } from "../../test/api";
import { renderApp } from "../../test/renderApp";
import { moveSlider } from "../../test/slider";

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
