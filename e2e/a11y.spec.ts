import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { resetData } from "./helpers.ts";

test.beforeEach(resetData);

const pages = [
  { name: "todo list (socket.io)", path: "/" },
  { name: "todo list (Centrifugo)", path: "/centrifugo" },
  { name: "done filter", path: "/?filter=done" },
  { name: "not found", path: "/nope" },
];

for (const { name, path } of pages) {
  test(`${name} has no detectable accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test("todo detail page has no detectable accessibility violations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Real-time progress" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Real-time progress" })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("the main flow works with the keyboard alone", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("article").first()).toBeVisible();

  await page.keyboard.press("Tab"); // brand link
  await page.keyboard.press("Tab"); // socket.io
  await page.keyboard.press("Tab"); // Centrifugo
  await page.keyboard.press("Tab"); // Name field
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeFocused();
  await page.keyboard.type("Keyboard todo");
  await page.keyboard.press("Tab");
  await page.keyboard.type("No mouse needed");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("article", { name: "Keyboard todo" })).toBeVisible();

  const slider = page.getByRole("slider", { name: "Progress for “Keyboard todo”" });
  await slider.focus();
  await page.keyboard.press("End");
  await expect(slider).toHaveAttribute("aria-valuenow", "100");
});
