import { act, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { vi } from "vitest";
import { AppProviders } from "@/app/providers";
import { createQueryClient } from "@/app/query-client";
import { routes } from "@/app/router";
import { fakeCentrifuge } from "./fake-centrifuge";
import { fakeSocket } from "./fake-socket";

interface Options {
  /** Set when the test uses fake timers, so user-event advances them while it types/clicks. */
  fakeTimers?: boolean;
  /**
   * Connect the realtime transport right after rendering, as a browser would within
   * milliseconds. Set to false to test the app before (or without) a connection.
   */
  connected?: boolean;
}

/** Simulates the first successful realtime connection on whichever transport the page uses. */
export function connectRealtime() {
  act(() => {
    fakeSocket.serverEmit("connect");
    fakeCentrifuge.client.emit("connected");
    fakeCentrifuge.subscription.emit("subscribed", { wasRecovering: false, recovered: false });
  });
}

export function renderApp(path = "/", { fakeTimers = false, connected = true }: Options = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup(fakeTimers ? { advanceTimers: vi.advanceTimersByTime } : {});
  const view = render(
    <AppProviders queryClient={createQueryClient({ retry: false })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  if (connected) connectRealtime();
  return { ...view, user, router };
}
