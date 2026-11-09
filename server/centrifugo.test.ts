import { createHmac } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCentrifugoPublisher, signConnectionToken } from "./centrifugo.ts";

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());

describe("signConnectionToken", () => {
  it("creates an HS256 JWT that verifies with the shared secret", () => {
    const token = signConnectionToken("secret", { sub: "guest-1", ttlSeconds: 60, now: 1_000_000 });
    const [header, payload, signature] = token.split(".");

    expect(decode(header)).toEqual({ alg: "HS256", typ: "JWT" });
    expect(decode(payload)).toEqual({ sub: "guest-1", exp: 1060 });
    const expected = createHmac("sha256", "secret")
      .update(`${header}.${payload}`)
      .digest("base64url");
    expect(signature).toBe(expected);
  });
});

describe("createCentrifugoPublisher", () => {
  let server: http.Server | undefined;
  afterEach(() => new Promise((resolve) => (server ? server.close(resolve) : resolve(undefined))));

  async function fakeCentrifugo(respond: (body: unknown) => [number, unknown]) {
    const received: Array<{ url?: string; key?: string; body: unknown }> = [];
    server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        const body = JSON.parse(raw);
        received.push({ url: req.url, key: req.headers["x-api-key"] as string, body });
        const [status, reply] = respond(body);
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(reply));
      });
    });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    return { received, url: `http://localhost:${(server!.address() as AddressInfo).port}` };
  }

  it("publishes the event to the todos channel with the API key", async () => {
    const { received, url } = await fakeCentrifugo(() => [200, { result: {} }]);
    const publish = createCentrifugoPublisher({ apiUrl: url, apiKey: "k" });

    publish({ type: "todo:deleted", _id: "a" });

    await vi.waitFor(() => expect(received).toHaveLength(1));
    expect(received[0]).toEqual({
      url: "/api/publish",
      key: "k",
      body: { channel: "todos", data: { type: "todo:deleted", _id: "a" } },
    });
  });

  it("logs a failure once until a publish succeeds again", async () => {
    let fail = true;
    const { url } = await fakeCentrifugo(() =>
      fail ? [200, { error: { code: 102, message: "unknown channel" } }] : [200, { result: {} }],
    );
    const log = vi.fn();
    const publish = createCentrifugoPublisher({ apiUrl: url, apiKey: "k", log });

    publish({ type: "todo:deleted", _id: "a" });
    await vi.waitFor(() => expect(log).toHaveBeenCalledTimes(1));
    publish({ type: "todo:deleted", _id: "b" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("unknown channel");

    fail = false;
    publish({ type: "todo:deleted", _id: "c" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    fail = true;
    publish({ type: "todo:deleted", _id: "d" });
    await vi.waitFor(() => expect(log).toHaveBeenCalledTimes(2));
  });

  it("logs when Centrifugo is unreachable instead of throwing", async () => {
    const log = vi.fn();
    const publish = createCentrifugoPublisher({ apiUrl: "http://localhost:1", apiKey: "k", log });
    publish({ type: "todo:deleted", _id: "a" });
    await vi.waitFor(() => expect(log).toHaveBeenCalledTimes(1));
  });
});
