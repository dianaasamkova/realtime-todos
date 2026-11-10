import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import type { TodoPatch } from "@contract/todos";
import { api, db, requests, serverWrite, todoUrl } from "@/test/api-mock";
import { fakeSocket } from "@/test/fake-socket";
import { renderApp } from "@/test/render-app";
import { moveSlider } from "@/test/slider";

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

  test("clicking away saves the new name, so a phone's Done button doesn't lose it", async () => {
    const { user } = renderApp();
    await screen.findByText("Write specs");

    await user.click(renameButton());
    await user.keyboard(" v2");
    await user.click(document.body);

    expect(await screen.findByText("Write specs v2")).toBeInTheDocument();
    expect(requests.filter((r) => r.method === "PATCH").map((r) => r.body)).toEqual([
      { name: "Write specs v2" },
    ]);
  });

  test("a cancelled draft does not come back when renaming again", async () => {
    const { user } = renderApp();
    await screen.findByText("Write specs");

    await user.click(renameButton());
    await user.keyboard(" abandoned draft{Escape}");
    await user.click(renameButton());

    expect(screen.getByRole("textbox", { name: "New name" })).toHaveValue("Write specs");
  });

  // Some browsers fire blur when a focused element is removed; Escape and Enter both remove it.
  test("Escape cancels even if a blur follows as the field disappears", async () => {
    const { user } = renderApp();
    await screen.findByText("Write specs");
    await user.click(renameButton());
    const input = screen.getByRole("textbox", { name: "New name" });
    await user.type(input, " draft");

    act(() => {
      fireEvent.keyDown(input, { key: "Escape" });
      fireEvent.blur(input);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(requests.filter((r) => r.method === "PATCH")).toEqual([]);
    expect(screen.getByText("Write specs")).toBeInTheDocument();
  });

  test("Enter saves once even if a blur follows", async () => {
    const { user } = renderApp();
    await screen.findByText("Write specs");
    await user.click(renameButton());
    const input = screen.getByRole("textbox", { name: "New name" });
    await user.type(input, " v2");

    act(() => {
      fireEvent.submit(input.closest("form")!);
      fireEvent.blur(input);
    });

    await waitFor(() => expect(requests.filter((r) => r.method === "PATCH")).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requests.filter((r) => r.method === "PATCH")).toHaveLength(1);
  });

  test("the Rename button closes the field without saving", async () => {
    const { user } = renderApp();
    await screen.findByText("Write specs");

    await user.click(renameButton());
    await user.keyboard(" draft");
    await user.click(renameButton());

    expect(screen.queryByRole("textbox", { name: "New name" })).not.toBeInTheDocument();
    expect(screen.getByText("Write specs")).toBeInTheDocument();
    expect(requests.filter((r) => r.method === "PATCH")).toEqual([]);
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
    // Titles sit under the list's "Todos" heading (h2).
    expect(screen.getByRole("heading", { level: 2, name: "Todos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Write specs" })).toBeInTheDocument();
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
    const change = serverWrite.update("Write specs", { progress: 40 });

    act(() => fakeSocket.serverEmit("todo:updated", change));

    const card = screen.getByRole("article", { name: "Write specs" });
    expect(await within(card).findByText("Updated just now")).toBeInTheDocument();
  });

  test("does not highlight the echo of this tab's own change", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    api.use(
      http.patch(todoUrl("/:id"), async ({ request, params }) => {
        const change = db.update(String(params.id), (await request.json()) as TodoPatch)!;
        // The server's broadcast reaches this tab before its own PATCH response.
        act(() => fakeSocket.serverEmit("todo:updated", change));
        await gate;
        return HttpResponse.json(change);
      }),
    );
    const { user } = renderApp();
    await screen.findByText("Write specs");

    await user.click(screen.getByRole("button", { name: "Rename “Write specs”" }));
    await user.clear(screen.getByRole("textbox", { name: "New name" }));
    await user.keyboard("Mine{Enter}");
    await waitFor(() => expect(requests.some((r) => r.method === "PATCH")).toBe(true));
    release();

    expect(await screen.findByText("Mine")).toBeInTheDocument();
    expect(screen.queryByText("Updated just now")).not.toBeInTheDocument();
  });
});
