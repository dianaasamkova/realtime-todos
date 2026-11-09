import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { requests } from "../../test/api";
import { renderApp } from "../../test/renderApp";

const renameButton = () => screen.getAllByRole("button", { name: /^(edit|rename)/i })[0];

describe("renaming a todo", () => {
  test("Enter saves the new name", async () => {
    const { user } = renderApp();
    await screen.findByText("Write specs");

    await user.click(renameButton());
    await user.clear(screen.getByRole("textbox", { name: "New name" }));
    await user.keyboard("Write better specs{Enter}");

    expect(await screen.findByText("Write better specs")).toBeInTheDocument();
    expect(requests.filter((r) => r.method === "PATCH").map((r) => r.body)).toEqual([
      { name: "Write better specs" },
    ]);
  });

  test("Escape cancels without saving", async () => {
    const { user } = renderApp();
    await screen.findByText("Write specs");

    await user.click(renameButton());
    await user.keyboard(" draft{Escape}");

    expect(screen.queryByRole("textbox", { name: "New name" })).not.toBeInTheDocument();
    expect(screen.getByText("Write specs")).toBeInTheDocument();
    expect(requests.filter((r) => r.method === "PATCH")).toEqual([]);
  });

  test("an abandoned draft does not come back when renaming again", async () => {
    const { user } = renderApp();
    await screen.findByText("Write specs");

    await user.click(renameButton());
    await user.keyboard(" abandoned draft");
    await user.click(document.body); // click away

    await user.click(renameButton());
    expect(screen.getByRole("textbox", { name: "New name" })).toHaveValue("Write specs");
  });
});
