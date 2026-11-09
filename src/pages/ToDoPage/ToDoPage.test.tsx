import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { api, byName, db, todoUrl } from "../../test/api";
import { renderApp } from "../../test/renderApp";

test("shows a loading state instead of 'not found' while todos load", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  api.use(
    http.get(todoUrl(), async () => {
      await gate;
      return HttpResponse.json(db.list());
    }),
  );
  renderApp(`/todo/${byName("Write specs")._id}`);

  expect(await screen.findByText(/loading/i)).toBeInTheDocument();
  expect(screen.queryByText(/doesn't exist/i)).not.toBeInTheDocument();

  release();
  expect(await screen.findByText("Write specs")).toBeInTheDocument();
  expect(screen.getByText("Acceptance criteria first")).toBeInTheDocument();
});

test("says so when the todo doesn't exist", async () => {
  renderApp("/todo/unknown-id");
  expect(await screen.findByText("This todo doesn't exist or was deleted.")).toBeInTheDocument();
});

test("shows an error with Retry when todos can't be loaded", async () => {
  api.use(http.get(todoUrl(), () => HttpResponse.error(), { once: true }));
  const { user } = renderApp(`/todo/${byName("Write specs")._id}`);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Couldn't load todos. Can't reach the server.",
  );
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Write specs")).toBeInTheDocument();
});
