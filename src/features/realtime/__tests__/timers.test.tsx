import { act, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { serverWrite } from "@/test/api-mock";
import { fakeSocket } from "@/test/fake-socket";
import { renderApp } from "@/test/render-app";
import { watchTimers } from "@/test/timers";

// Timers outlive the component that started them unless they are cleared, and then fire into
// a tree that is gone (or reload a list nobody shows). Each test names the delay it watches.
const HIGHLIGHT_MS = 2500;
const NOTICE_MS = 5000;
const GAP_GRACE_MS = 1500;

describe("timers are cleared when their owner goes away", () => {
  test("the highlight timer stops when the page is left", async () => {
    const highlights = watchTimers(HIGHLIGHT_MS);
    const { unmount } = renderApp();
    await screen.findByText("Write specs");

    act(() =>
      fakeSocket.serverEmit("todo:updated", serverWrite.update("Write specs", { progress: 40 })),
    );
    await screen.findByText("Updated just now");
    expect(highlights.size).toBe(1);

    unmount();
    expect(highlights.size).toBe(0);
  });

  test("a newer change to the same todo restarts its highlight instead of stacking timers", async () => {
    const highlights = watchTimers(HIGHLIGHT_MS);
    renderApp();
    await screen.findByText("Write specs");

    act(() =>
      fakeSocket.serverEmit("todo:updated", serverWrite.update("Write specs", { progress: 40 })),
    );
    act(() =>
      fakeSocket.serverEmit("todo:updated", serverWrite.update("Write specs", { progress: 50 })),
    );

    expect(highlights.size).toBe(1);
  });

  test("a notice's timer stops when the notice is dismissed, and when the app is left", async () => {
    const notices = watchTimers(NOTICE_MS);
    const { user, unmount } = renderApp();
    await screen.findByText("Write specs");

    await user.click(screen.getByRole("button", { name: "Delete “Write specs”" }));
    expect(notices.size).toBe(1);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(notices.size).toBe(0);

    await user.click(screen.getByRole("button", { name: "Delete “Ship it”" }));
    expect(notices.size).toBe(1);
    unmount();
    expect(notices.size).toBe(0);
  });

  test("a pending check for a missed change stops when the realtime connection closes", async () => {
    const gapChecks = watchTimers(GAP_GRACE_MS);
    const { unmount } = renderApp();
    await screen.findByText("Write specs");

    serverWrite.update("Write specs", { progress: 20 }); // an event this tab never receives
    const skipsAhead = serverWrite.update("Ship it", { progress: 60 });
    act(() => fakeSocket.serverEmit("todo:updated", skipsAhead));
    expect(gapChecks.size).toBe(1);
    // Another change that is still waiting shares the same check instead of starting its own.
    act(() =>
      fakeSocket.serverEmit("todo:updated", serverWrite.update("Ship it", { progress: 70 })),
    );
    expect(gapChecks.size).toBe(1);

    unmount();
    expect(gapChecks.size).toBe(0);
  });
});
