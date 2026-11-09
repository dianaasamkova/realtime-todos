import { createHmac } from "node:crypto";
import { TODOS_CHANNEL, type TodoChange } from "../shared/todo.ts";
import type { Publish } from "./app.ts";

const base64url = (value: string) => Buffer.from(value).toString("base64url");

/**
 * Signs a Centrifugo connection token (an HS256 JWT). In a real app the user id comes from
 * the session; this mock gives every visitor an anonymous id.
 */
export function signConnectionToken(
  secret: string,
  { sub, ttlSeconds = 3600, now = Date.now() }: { sub: string; ttlSeconds?: number; now?: number },
) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ sub, exp: Math.floor(now / 1000) + ttlSeconds }));
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

interface PublisherOptions {
  /** Base URL of Centrifugo's HTTP API, e.g. http://localhost:8001 */
  apiUrl: string;
  apiKey: string;
  log?: (message: string) => void;
}

/**
 * Publishes changes to Centrifugo's HTTP API, one at a time so the channel history keeps
 * revision order (concurrent requests could reach Centrifugo out of order). Centrifugo keeps
 * them in channel history, so clients that reconnect can recover what they missed. Failures
 * are logged once until a publish succeeds again, so the socket.io page keeps working
 * without Centrifugo.
 */
export function createCentrifugoPublisher({
  apiUrl,
  apiKey,
  log = console.warn,
}: PublisherOptions): Publish {
  let failing = false;
  let queue = Promise.resolve();

  const publishOne = async (change: TodoChange) => {
    try {
      const response = await fetch(`${apiUrl}/api/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ channel: TODOS_CHANNEL, data: change }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok || body.error) {
        throw new Error(body.error?.message ?? `HTTP ${response.status}`);
      }
      failing = false;
    } catch (error) {
      if (failing) return;
      failing = true;
      log(
        `Centrifugo publish failed (${(error as Error).message}); /centrifugo gets no live updates.`,
      );
    }
  };

  return (change) => {
    queue = queue.then(() => publishOne(change));
  };
}
