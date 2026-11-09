import { describe, expect, it, vi } from "vitest";
import { fakeSocket } from "../test/fakeSocket";
import { createSocketIoTransport } from "./socketio";

function connect() {
  const handlers = { onEvent: vi.fn(), onStatus: vi.fn(), onResync: vi.fn() };
  const close = createSocketIoTransport("http://api.test").connect(handlers);
  return { ...handlers, close };
}

describe("socket.io transport", () => {
  it("is connecting until the socket connects, then live", () => {
    const { onStatus } = connect();
    expect(onStatus).toHaveBeenLastCalledWith("connecting");
    fakeSocket.serverEmit("connect");
    expect(onStatus).toHaveBeenLastCalledWith("live");
  });

  it("asks for a resync when the connection state was not recovered", () => {
    const { onResync } = connect();
    fakeSocket.recovered = false;
    fakeSocket.serverEmit("connect");
    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it("skips the resync when socket.io replayed the missed events", () => {
    const { onResync } = connect();
    fakeSocket.recovered = true;
    fakeSocket.serverEmit("connect");
    expect(onResync).not.toHaveBeenCalled();
  });

  it("reports reconnecting after a dropped connection and offline after giving up", () => {
    const { onStatus } = connect();
    fakeSocket.serverEmit("disconnect", "transport close");
    expect(onStatus).toHaveBeenLastCalledWith("reconnecting");
    fakeSocket.active = false;
    fakeSocket.serverEmit("connect_error", new Error("refused"));
    expect(onStatus).toHaveBeenLastCalledWith("offline");
  });

  it("forwards todo events", () => {
    const { onEvent } = connect();
    const event = { type: "todo:deleted", _id: "a" };
    fakeSocket.serverEmit("todo:deleted", event);
    expect(onEvent).toHaveBeenCalledWith(event);
  });

  it("disconnects on close", () => {
    const disconnect = vi.spyOn(fakeSocket, "disconnect");
    connect().close();
    expect(disconnect).toHaveBeenCalled();
  });
});
