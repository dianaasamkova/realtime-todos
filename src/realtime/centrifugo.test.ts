import { describe, expect, it, vi } from "vitest";
import { fakeCentrifuge } from "../test/fakeCentrifuge";
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

  it("maps client states to connection statuses", () => {
    const { onStatus } = connect();
    expect(onStatus).toHaveBeenLastCalledWith("connecting");
    fakeCentrifuge.client.emit("connected");
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

  it("forwards publications as todo events", () => {
    const { onEvent } = connect();
    const event = { type: "todo:deleted", _id: "a" };
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
