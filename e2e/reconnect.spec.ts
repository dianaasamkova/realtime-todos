import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";
import { API, card, expectLive, resetData, withCentrifugo } from "./helpers.ts";

test.beforeEach(resetData);

/** Lets a test cut a page's realtime connection and restore it later. */
async function controllableConnection(page: Page, pattern: RegExp) {
  let blocked = false;
  const open: WebSocketRoute[] = [];
  await page.routeWebSocket(pattern, (ws) => {
    if (blocked) return void ws.close();
    ws.connectToServer();
    open.push(ws);
  });
  // socket.io may start with HTTP long-polling before upgrading to WebSocket.
  await page.route(pattern, (route) => (blocked ? route.abort() : route.continue()));
  return {
    /** Waits until the realtime connection runs over a WebSocket we can close. */
    ready: async () => {
      await expect.poll(() => open.length).toBeGreaterThan(0);
      await page.waitForTimeout(500); // let socket.io finish upgrading from long-polling
    },
    cut: async () => {
      blocked = true;
      await Promise.all(open.splice(0).map((ws) => ws.close()));
    },
    restore: () => {
      blocked = false;
    },
  };
}

const cases = [
  { name: "socket.io", path: "/", pattern: /\/socket\.io\// },
  { name: "Centrifugo", path: "/centrifugo", pattern: /\/connection\/websocket/ },
];

for (const { name, path, pattern } of cases) {
  test(`catches up on changes made while the ${name} connection was down`, async ({ browser }) => {
    test.skip(name === "Centrifugo" && !withCentrifugo, "needs Centrifugo (E2E_CENTRIFUGO=1)");
    const context = await browser.newContext();
    const page = await context.newPage();
    const connection = await controllableConnection(page, pattern);
    await page.goto(path);
    await expectLive(page);
    await connection.ready();

    await connection.cut();
    await expect(page.getByText(/Live updates are paused/)).toBeVisible();

    // Someone else edits while this tab is disconnected.
    const { todos } = (await (await fetch(`${API}/api/todos`)).json()) as {
      todos: Array<{ _id: string; name: string }>;
    };
    const readme = todos.find((todo) => todo.name === "Write the README")!;
    await fetch(`${API}/api/todos/${readme._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress: 100 }),
    });
    await fetch(`${API}/api/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Added while you were away", description: "Missed event" }),
    });

    connection.restore();
    await expectLive(page);
    await expect(card(page, "Write the README").getByRole("slider")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    await expect(card(page, "Added while you were away")).toBeVisible();
  });
}
