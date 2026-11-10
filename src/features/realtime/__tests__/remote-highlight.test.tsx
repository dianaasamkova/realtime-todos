import { act, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";
import type { NewTodo, TodoChange, TodoPatch } from "@contract/todos";
import { api, byName, db, serverWrite, stamp, todoUrl } from "@/test/api-mock";
import { fakeSocket } from "@/test/fake-socket";
import { renderApp } from "@/test/render-app";

const card = (name: string) => screen.getByRole("article", { name });
const highlighted = (name: string) => within(card(name)).queryByText("Updated just now");

/** A server whose reply to a write waits for `release()`, after broadcasting it as it happens. */
function slowWrites() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const broadcast = (change: TodoChange) => act(() => fakeSocket.serverEmit(change.type, change));
  api.use(
    http.post(todoUrl(), async ({ request }) => {
      const change = stamp(db.create((await request.json()) as NewTodo), request);
      broadcast(change);
      await gate;
      return HttpResponse.json(change, { status: 201 });
    }),
    http.patch(todoUrl("/:id"), async ({ request, params }) => {
      const change = stamp(
        db.update(String(params.id), (await request.json()) as TodoPatch)!,
        request,
      );
      broadcast(change);
      await gate;
      return HttpResponse.json(change);
    }),
  );
  return release;
}

describe("highlighting changes made by other people", () => {
  test("the highlight fades after a couple of seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderApp();
      await screen.findByText("Write specs");

      act(() =>
        fakeSocket.serverEmit("todo:updated", serverWrite.update("Write specs", { progress: 40 })),
      );
      expect(await within(card("Write specs")).findByText("Updated just now")).toBeInTheDocument();

      await act(() => vi.advanceTimersByTimeAsync(2400));
      expect(highlighted("Write specs")).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(200));
      expect(highlighted("Write specs")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  test("a todo another user adds while this tab is adding one is highlighted; this tab's own is not", async () => {
    const release = slowWrites();
    const { user } = renderApp();
    await screen.findByText("Write specs");

    await user.type(screen.getByLabelText("Name"), "Mine");
    await user.type(screen.getByLabelText("Description"), "From this tab");
    await user.click(screen.getByRole("button", { name: /add/i }));
    // This tab's create is now in flight, and its own broadcast has already arrived.
    expect(await screen.findByText("Mine")).toBeInTheDocument();

    act(() => fakeSocket.serverEmit("todo:created", serverWrite.create("Theirs")));
    release();

    expect(
      await within(await screen.findByRole("article", { name: "Theirs" })).findByText(
        "Updated just now",
      ),
    ).toBeInTheDocument();
    expect(highlighted("Mine")).not.toBeInTheDocument();
  });

  test("another user's edit of a todo this tab is also saving is highlighted", async () => {
    const release = slowWrites();
    const { user } = renderApp();
    await screen.findByText("Write specs");

    const id = byName("Write specs")._id;
    await user.click(screen.getByRole("button", { name: "Rename “Write specs”" }));
    await user.clear(screen.getByRole("textbox", { name: "New name" }));
    await user.keyboard("Mine{Enter}");
    await screen.findByText("Mine"); // this tab's save is in flight, its echo has arrived
    expect(highlighted("Mine")).not.toBeInTheDocument();

    // Someone else moves the same todo's slider in the meantime.
    act(() => fakeSocket.serverEmit("todo:updated", db.update(id, { progress: 70 })!));
    release();

    expect(await within(card("Mine")).findByText("Updated just now")).toBeInTheDocument();
  });
});
