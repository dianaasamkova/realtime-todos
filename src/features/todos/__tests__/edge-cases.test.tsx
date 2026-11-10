import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";
import App from "@/app/App";
import { NoticesProvider, useNotify } from "@/shared/notices/Notices";
import { api, byName, requests, serverWrite, todoUrl } from "@/test/api-mock";
import { fakeSocket } from "@/test/fake-socket";
import { renderApp } from "@/test/render-app";
import { AddTodoForm } from "@/features/todos/components/AddTodoForm";

describe("the app", () => {
  test("starts from the browser's address", async () => {
    render(<App />);
    expect(await screen.findByText("Write specs")).toBeInTheDocument();
  });
});

describe("renaming", () => {
  async function startRename(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Rename “Write specs”" }));
    return screen.getByRole("textbox", { name: "New name" });
  }

  test("saving the same name sends nothing", async () => {
    const { user } = renderApp();
    await screen.findByText("Write specs");
    await startRename(user);
    await user.keyboard("{Enter}");
    expect(requests.some((r) => r.method === "PATCH")).toBe(false);
  });

  test("saving a blank name sends nothing and keeps the old name", async () => {
    const { user } = renderApp();
    await screen.findByText("Write specs");
    await user.clear(await startRename(user));
    await user.keyboard("   {Enter}");
    expect(requests.some((r) => r.method === "PATCH")).toBe(false);
    expect(screen.getByText("Write specs")).toBeInTheDocument();
  });
});

describe("a failed save", () => {
  test("names the todo generically if someone deleted it meanwhile", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    api.use(
      http.patch(todoUrl("/:id"), async () => {
        await gate;
        return HttpResponse.json({ message: "todo not found" }, { status: 404 });
      }),
    );
    const { user } = renderApp();
    await screen.findByText("Write specs");
    const gone = serverWrite.remove("Write specs");

    await user.click(screen.getByRole("button", { name: "Rename “Write specs”" }));
    await user.clear(screen.getByRole("textbox", { name: "New name" }));
    await user.keyboard("Renamed{Enter}");
    act(() => fakeSocket.serverEmit("todo:deleted", gone));
    release();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save “the todo”. todo not found",
    );
  });
});

describe("a todo that is done", () => {
  test("its page shows the Done badge and a full bar", async () => {
    serverWrite.update("Write specs", { progress: 100 });
    renderApp(`/todo/${byName("Write specs")._id}`);

    expect(await screen.findByRole("heading", { name: "Write specs" })).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});

describe("filters", () => {
  test("All clears the filter from the URL again", async () => {
    const { user, router } = renderApp("/?filter=done");
    await screen.findByText(/Nothing is done yet/);
    await user.click(screen.getByRole("button", { name: /^All/ }));
    expect(router.state.location.search).toBe("");
  });
});

describe("AddTodoForm", () => {
  test("shows a generic message when the failure carries no text", async () => {
    const user = userEvent.setup();
    render(<AddTodoForm onAdd={() => Promise.reject("nope")} />);
    await user.type(screen.getByLabelText("Name"), "a");
    await user.type(screen.getByLabelText("Description"), "b");
    await user.click(screen.getByRole("button", { name: /add/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/^Couldn't add the todo\.$/);
  });
});

describe("notices", () => {
  function Trigger({ durationMs }: { durationMs?: number }) {
    const notify = useNotify();
    return <button onClick={() => notify({ message: "Hello", durationMs })}>Show</button>;
  }

  test("an info notice goes away by itself after the default time", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <NoticesProvider>
          <Trigger />
        </NoticesProvider>,
      );
      await user.click(screen.getByRole("button", { name: "Show" }));
      expect(screen.getByText("Hello")).toBeInTheDocument();

      await act(() => vi.advanceTimersByTimeAsync(5000));
      expect(screen.queryByText("Hello")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  test("notifying without a provider does nothing", async () => {
    const user = userEvent.setup();
    render(<Trigger />);
    await user.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.queryByText("Hello")).not.toBeInTheDocument();
  });
});
