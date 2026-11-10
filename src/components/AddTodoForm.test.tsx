import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { api, todoUrl } from "@/test/api";
import { renderApp } from "@/test/renderApp";

async function fillAndSubmit(user: ReturnType<typeof renderApp>["user"]) {
  await user.type(screen.getByLabelText("Name"), "Important task");
  await user.type(screen.getByLabelText("Description"), "Typed carefully");
  await user.click(screen.getByRole("button", { name: /add/i }));
}

test("adds the todo and clears the form", async () => {
  const { user } = renderApp();
  await screen.findByText("Write specs");

  await fillAndSubmit(user);

  expect(await screen.findByText("Important task")).toBeInTheDocument();
  expect(screen.getByLabelText("Name")).toHaveValue("");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("keeps what the user typed and shows the error when adding fails", async () => {
  api.use(
    http.post(todoUrl(), () => HttpResponse.json({ message: "Server is busy" }, { status: 503 })),
  );
  const { user } = renderApp();
  await screen.findByText("Write specs");

  await fillAndSubmit(user);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Couldn't add the todo. Server is busy",
  );
  expect(screen.getByLabelText("Name")).toHaveValue("Important task");
  expect(screen.getByLabelText("Description")).toHaveValue("Typed carefully");
});
