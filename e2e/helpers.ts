import { expect, type Browser, type Page } from "@playwright/test";

export const API = "http://localhost:8000";
export const withCentrifugo = process.env.E2E_CENTRIFUGO === "1";

/** Restores the seed todos so every test starts from the same data. */
export async function resetData() {
  const response = await fetch(`${API}/api/test/reset`, { method: "POST" });
  expect(response.status).toBe(204);
}

/** Opens `path` in a fresh browser context: a separate user with their own connection. */
export async function openUser(browser: Browser, path: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(path);
  await expect(page.getByRole("article").first()).toBeVisible();
  await expectLive(page);
  return page;
}

export async function expectLive(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: "Live" })).toBeVisible({
    timeout: 10_000,
  });
}

export const card = (page: Page, name: string) => page.getByRole("article", { name });
