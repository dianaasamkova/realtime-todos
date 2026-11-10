import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { requests, serverWrite } from "@/test/api-mock";
import { fakeSocket } from "@/test/fake-socket";
import { renderApp } from "@/test/render-app";

afterEach(() => {
  vi.useRealTimers();
});

const GAP_GRACE_MS = 1500;
const gets = () => requests.filter((r) => r.method === "GET").length;

describe("changes that arrive out of order", () => {
  test("reloads the list when the change a later one depends on never arrives", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderApp();
    await screen.findByText("Write specs");
    const [first, second] = screen.getAllByRole("slider");

    serverWrite.update("Write specs", { progress: 20 }); // this tab never hears about it
    act(() =>
      fakeSocket.serverEmit("todo:updated", serverWrite.update("Ship it", { progress: 60 })),
    );
    expect(second).toHaveAttribute("aria-valuenow", "50"); // held back until the gap closes

    await act(() => vi.advanceTimersByTimeAsync(GAP_GRACE_MS));

    await waitFor(() => expect(first).toHaveAttribute("aria-valuenow", "20"));
    expect(second).toHaveAttribute("aria-valuenow", "60");
  });

  test("doesn't reload when the missing change turns up in time", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderApp();
    await screen.findByText("Write specs");
    const [first, second] = screen.getAllByRole("slider");
    const before = gets();

    const earlier = serverWrite.update("Write specs", { progress: 20 });
    const later = serverWrite.update("Ship it", { progress: 60 });
    act(() => fakeSocket.serverEmit("todo:updated", later));
    act(() => fakeSocket.serverEmit("todo:updated", earlier));
    await act(() => vi.advanceTimersByTimeAsync(GAP_GRACE_MS * 2));

    expect(first).toHaveAttribute("aria-valuenow", "20");
    expect(second).toHaveAttribute("aria-valuenow", "60");
    expect(gets()).toBe(before);
  });

  test("ignores events that arrive before the first list; the list already has them", async () => {
    renderApp("/", { connected: false });

    act(() => fakeSocket.serverEmit("todo:created", serverWrite.create("Early bird")));

    expect(await screen.findByText("Early bird")).toBeInTheDocument();
  });
});
