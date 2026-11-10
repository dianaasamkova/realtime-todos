import { Centrifuge } from "centrifuge";
import { TODOS_CHANNEL, type TodoChange } from "@contract/todos";
import type { RealtimeTransport } from "./types";

/**
 * Centrifugo transport. The channel keeps a short history, and the client resubscribes with
 * its last stream position, so after a reconnect Centrifugo resends missed publications.
 * If it can't (history expired, server restarted), `recovered` is false and we resync.
 */
export function createCentrifugoTransport(
  url: string,
  getToken: () => Promise<string>,
): RealtimeTransport {
  return {
    name: "Centrifugo",
    connect({ onEvent, onStatus, onResync }) {
      const client = new Centrifuge(url, { getToken: () => getToken() });
      const subscription = client.newSubscription(TODOS_CHANNEL);
      let wasConnected = false;
      let wasSubscribed = false;
      onStatus("connecting");

      client.on("connecting", () => onStatus(wasConnected ? "reconnecting" : "connecting"));
      client.on("connected", () => {
        wasConnected = true;
      });
      client.on("disconnected", () => onStatus("offline"));
      // A failed attempt (e.g. Centrifugo is down) means retries are under way.
      client.on("error", () => {
        if (client.state !== "connected") onStatus("reconnecting");
      });
      subscription.on("publication", (ctx) => onEvent(ctx.data as TodoChange));
      // Live once the channel subscription is active, not merely the connection: publications
      // only arrive from here on.
      subscription.on("subscribed", (ctx) => {
        wasSubscribed = true;
        onStatus("live");
        if (!ctx.recovered) onResync();
      });
      // A dropped subscription re-subscribes on its own; a refused one (e.g. no permission)
      // ends in "unsubscribed" and no publications will arrive.
      subscription.on("subscribing", () => {
        if (wasSubscribed) onStatus("reconnecting");
      });
      subscription.on("unsubscribed", () => onStatus("offline"));

      subscription.subscribe();
      client.connect();

      return () => {
        subscription.unsubscribe();
        client.removeSubscription(subscription);
        client.disconnect();
      };
    },
  };
}
