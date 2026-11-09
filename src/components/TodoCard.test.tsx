import { act, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { api, byName, db, requests, todoUrl } from "../test/api";
import { fakeSocket } from "../test/fakeSocket";
import { renderApp } from "../test/renderApp";
import { moveSlider } from "../test/slider";

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

describe("card", () => {
  test("names every control after its todo", async () => {
    renderApp();
    await screen.findByText("Write specs");

    expect(screen.getByRole("slider", { name: "Progress for “Write specs”" })).toHaveAttribute(
      "aria-valuetext",
      "10%",
    );
    expect(screen.getByRole("button", { name: "Rename “Write specs”" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete “Write specs”" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Write specs" })).toBeInTheDocument();
  });

  test("marks a todo as done at 100%", async () => {
    renderApp();
    await screen.findByText("Write specs");
    const card = screen.getByRole("article", { name: "Write specs" });
    expect(within(card).queryByText("Done")).not.toBeInTheDocument();

    moveSlider(within(card).getByRole("slider"), 100);

    expect(within(card).getByText("Done")).toBeInTheDocument();
  });

  test("highlights a change made in another tab", async () => {
    renderApp();
    await screen.findByText("Write specs");
    const todo = db.update(byName("Write specs")._id, { progress: 40 })!;

    act(() => fakeSocket.serverEmit("todo:updated", { type: "todo:updated", todo }));

    const card = screen.getByRole("article", { name: "Write specs" });
    expect(await within(card).findByText("Updated just now")).toBeInTheDocument();
  });

  test("does not highlight the echo of this tab's own change", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    api.use(
      http.patch(todoUrl("/:id"), async ({ params }) => {
        await gate;
        return HttpResponse.json(db.list().find((t) => t._id === params.id));
      }),
    );
    const { user } = renderApp();
    await screen.findByText("Write specs");

    await user.click(screen.getByRole("button", { name: "Rename “Write specs”" }));
    await user.clear(screen.getByRole("textbox", { name: "New name" }));
    await user.keyboard("Mine{Enter}");
    // The server's broadcast arrives before this tab's own PATCH response.
    const echo = db.update(byName("Write specs")._id, { name: "Mine" })!;
    act(() => fakeSocket.serverEmit("todo:updated", { type: "todo:updated", todo: echo }));
    release();

    await waitFor(() => expect(requests.some((r) => r.method === "PATCH")).toBe(true));
    expect(screen.queryByText("Updated just now")).not.toBeInTheDocument();
  });
});
