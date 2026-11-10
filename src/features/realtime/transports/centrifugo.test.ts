import { describe, expect, it, vi } from "vitest";
import { fakeCentrifuge } from "@/test/fake-centrifuge";
import { createCentrifugoTransport } from "./centrifugo";

function connect(getToken = vi.fn(async () => "token")) {
  const handlers = { onEvent: vi.fn(), onStatus: vi.fn(), onResync: vi.fn() };
  const close = createCentrifugoTransport("ws://rt.test/connection/websocket", getToken).connect(
    handlers,
  );
  return { ...handlers, close, getToken };
}

describe("Centrifugo transport", () => {
  it("subscribes to the todos channel and connects with a token from the API", async () => {
    const { getToken } = connect();
    expect(fakeCentrifuge).toMatchObject({
      url: "ws://rt.test/connection/websocket",
      channel: "todos",
      connected: true,
      subscribed: true,
    });
    await expect(fakeCentrifuge.getToken?.()).resolves.toBe("token");
    expect(getToken).toHaveBeenCalled();
  });

  it("maps client and subscription states to connection statuses", () => {
    const { onStatus } = connect();
    expect(onStatus).toHaveBeenLastCalledWith("connecting");
    fakeCentrifuge.client.emit("connected");
    expect(onStatus).toHaveBeenLastCalledWith("connecting"); // not live until subscribed
    fakeCentrifuge.subscription.emit("subscribed", { wasRecovering: false, recovered: false });
    expect(onStatus).toHaveBeenLastCalledWith("live");
    fakeCentrifuge.client.emit("connecting");
    expect(onStatus).toHaveBeenLastCalledWith("reconnecting");
    fakeCentrifuge.client.emit("disconnected");
    expect(onStatus).toHaveBeenLastCalledWith("offline");
  });

  it("reports reconnecting while connection attempts fail", () => {
    const { onStatus } = connect();
    fakeCentrifuge.client.emit("error", { type: "transport" });
    expect(onStatus).toHaveBeenLastCalledWith("reconnecting");
  });

  it("is connecting, not reconnecting, on the very first attempt", () => {
    const { onStatus } = connect();
    fakeCentrifuge.client.emit("connecting");
    expect(onStatus).toHaveBeenLastCalledWith("connecting");
  });

  it("ignores errors that don't end the connection", () => {
    const { onStatus } = connect();
    onStatus.mockClear();
    fakeCentrifuge.state = "connected";
    fakeCentrifuge.client.emit("error", { type: "subscription" });
    expect(onStatus).not.toHaveBeenCalled();
  });

  it("stays quiet when a subscription starts for the first time", () => {
    const { onStatus } = connect();
    onStatus.mockClear();
    fakeCentrifuge.subscription.emit("subscribing", { code: 0, reason: "subscribe called" });
    expect(onStatus).not.toHaveBeenCalled();
  });

  it("reports offline when Centrifugo refuses the subscription", () => {
    const { onStatus } = connect();
    fakeCentrifuge.client.emit("connected");
    fakeCentrifuge.subscription.emit("unsubscribed", { code: 103, reason: "permission denied" });
    expect(onStatus).toHaveBeenLastCalledWith("offline");
  });

  it("stops reporting live while the subscription re-subscribes", () => {
    const { onStatus } = connect();
    fakeCentrifuge.client.emit("connected");
    fakeCentrifuge.subscription.emit("subscribed", { wasRecovering: false, recovered: false });
    fakeCentrifuge.subscription.emit("subscribing", { code: 0, reason: "server unsubscribe" });
    expect(onStatus).toHaveBeenLastCalledWith("reconnecting");
  });

  it("forwards publications as todo events", () => {
    const { onEvent } = connect();
    const event = { type: "todo:deleted", _id: "a", revision: 1 };
    fakeCentrifuge.subscription.emit("publication", { channel: "todos", data: event });
    expect(onEvent).toHaveBeenCalledWith(event);
  });

  it("resyncs unless Centrifugo recovered the missed publications", () => {
    const { onResync } = connect();
    fakeCentrifuge.subscription.emit("subscribed", { wasRecovering: false, recovered: false });
    expect(onResync).toHaveBeenCalledTimes(1);

    fakeCentrifuge.subscription.emit("subscribed", { wasRecovering: true, recovered: true });
    expect(onResync).toHaveBeenCalledTimes(1);

    fakeCentrifuge.subscription.emit("subscribed", { wasRecovering: true, recovered: false });
    expect(onResync).toHaveBeenCalledTimes(2);
  });

  it("unsubscribes and disconnects on close", () => {
    connect().close();
    expect(fakeCentrifuge).toMatchObject({ connected: false, subscribed: false });
  });
});
