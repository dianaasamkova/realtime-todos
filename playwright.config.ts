import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run the production build against the mock API. Set E2E_CENTRIFUGO=1 when a
 * Centrifugo server is running on port 8001 (docker compose up) to include its tests.
 */
const withCentrifugo = process.env.E2E_CENTRIFUGO === "1";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node server/index.ts",
      url: "http://localhost:8000/api/todos",
      reuseExistingServer: !process.env.CI,
      env: {
        ENABLE_TEST_RESET: "1",
        CENTRIFUGO_API_URL: withCentrifugo ? "http://localhost:8001" : "",
      },
    },
    {
      command: "npm run build && npm run preview",
      url: "http://localhost:4173",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
