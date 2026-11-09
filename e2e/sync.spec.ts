import { expect, test } from "@playwright/test";
import { card, openUser, resetData, withCentrifugo } from "./helpers.ts";

test.beforeEach(resetData);

const transports = [
  { name: "socket.io", path: "/" },
  { name: "Centrifugo", path: "/centrifugo" },
];

for (const { name, path } of transports) {
  test.describe(`live sync over ${name}`, () => {
    test.skip(name === "Centrifugo" && !withCentrifugo, "needs Centrifugo (E2E_CENTRIFUGO=1)");

    test("progress, new todos and deletes reach the other user", async ({ browser }) => {
      const alice = await openUser(browser, path);
      const bob = await openUser(browser, path);

      // Progress: Alice finishes a todo; Bob sees it done and highlighted.
      await card(alice, "Write the README").getByRole("slider").press("End");
      const bobsCard = card(bob, "Write the README");
      await expect(bobsCard.getByRole("slider")).toHaveAttribute("aria-valuenow", "100");
      await expect(bobsCard.getByText("Done")).toBeVisible();
      await expect(bobsCard.getByText("Updated just now")).toBeVisible();

      // Create: Bob adds a todo; Alice sees it.
      await bob.getByRole("textbox", { name: "Name", exact: true }).fill("Review the PR");
      await bob.getByRole("textbox", { name: "Description" }).fill("Before Friday");
      await bob.getByRole("button", { name: "Add todo" }).click();
      await expect(card(alice, "Review the PR")).toBeVisible();

      // Delete: once Alice's undo window closes, the todo disappears for Bob too.
      await card(alice, "Real-time progress")
        .getByRole("button", { name: /^Delete/ })
        .click();
      await expect(card(bob, "Real-time progress")).toBeHidden({ timeout: 10_000 });
    });
  });
}

test("a socket.io user and a Centrifugo user see each other's changes", async ({ browser }) => {
  test.skip(!withCentrifugo, "needs Centrifugo (E2E_CENTRIFUGO=1)");
  const alice = await openUser(browser, "/");
  const bob = await openUser(browser, "/centrifugo");

  await card(alice, "Write the README").getByRole("slider").press("End");
  await expect(card(bob, "Write the README").getByRole("slider")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );

  await card(bob, "Design the API contract").getByRole("slider").press("Home");
  await expect(card(alice, "Design the API contract").getByRole("slider")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
});
