import { act, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TodoPatch } from "@contract/todos";
import { api, byName, db, serverWrite, todoUrl } from "@/test/api-mock";
import { fakeSocket } from "@/test/fake-socket";
import { connectRealtime, renderApp } from "@/test/render-app";
import { moveSlider } from "@/test/slider";

afterEach(() => {
  vi.useRealTimers();
});

describe("ordering of server changes", () => {
  test("another user's later change wins over this tab's earlier save", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    api.use(
      http.patch(todoUrl("/:id"), async ({ request, params }) => {
        // The server applies this tab's save right away; its response is slow.
        const mine = db.update(String(params.id), (await request.json()) as TodoPatch);
        await gate;
        return HttpResponse.json(mine);
      }),
    );
    renderApp("/", { fakeTimers: true });
    await screen.findByText("Write specs");
    const slider = screen.getByRole("slider", { name: "Progress for “Write specs”" });

    moveSlider(slider, 30);
    await vi.advanceTimersByTimeAsync(1000);
    await waitFor(() => expect(byName("Write specs").progress).toBe(30));

    // Another user sets 50 after that; their broadcast reaches this tab first.
    const theirs = serverWrite.update("Write specs", { progress: 50 });
    act(() => fakeSocket.serverEmit("todo:updated", theirs));
    release();

    await vi.advanceTimersByTimeAsync(100);
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "50"));
  });

  test("a todo created between a slow first load and the connection still shows up", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    api.use(
      http.get(
        todoUrl(),
        async () => {
          const served = structuredClone(db.snapshot());
          await gate;
          return HttpResponse.json(served);
        },
        { once: true },
      ),
    );
    renderApp("/", { connected: false });

    // The realtime handshake is slow: the first load starts (and is served) before it.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    db.create({ name: "Created before connect", description: "No event reaches this tab" });
    connectRealtime();
    release();

    expect(await screen.findByText("Created before connect", {}, { timeout: 2000 })).toBeVisible();
  });
});
