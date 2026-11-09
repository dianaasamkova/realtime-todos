import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { api, db, requests } from "./api";
import { fakeCentrifuge } from "./fakeCentrifuge";
import { fakeSocket } from "./fakeSocket";

vi.mock("socket.io-client", () => import("./fakeSocket"));
vi.mock("centrifuge", () => import("./fakeCentrifuge"));

// Radix measures elements with ResizeObserver, which jsdom does not implement.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeAll(() => api.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  cleanup();
  api.resetHandlers();
  db.reset();
  requests.length = 0;
  fakeSocket.reset();
  fakeCentrifuge.reset();
});
afterAll(() => api.close());
