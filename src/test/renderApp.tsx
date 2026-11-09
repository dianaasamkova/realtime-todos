import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { vi } from "vitest";
import { AppProviders } from "../AppProviders";
import { routes } from "../routes";

interface Options {
  /** Set when the test uses fake timers, so user-event advances them while it types/clicks. */
  fakeTimers?: boolean;
}

export function renderApp(path = "/", { fakeTimers = false }: Options = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup(fakeTimers ? { advanceTimers: vi.advanceTimersByTime } : {});
  const view = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...view, user, router };
}
