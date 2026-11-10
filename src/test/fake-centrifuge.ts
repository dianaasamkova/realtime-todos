/** Stand-in for the `centrifuge` client: tests drive client and subscription events. */
type Handler = (ctx: never) => void;

function emitter() {
  const handlers = new Map<string, Set<Handler>>();
  return {
    on(event: string, handler: Handler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    },
    emit(event: string, ctx: unknown = {}) {
      handlers.get(event)?.forEach((handler) => (handler as (c: unknown) => void)(ctx));
    },
    clear: () => handlers.clear(),
  };
}

const client = emitter();
const subscription = emitter();

export const fakeCentrifuge = {
  url: "",
  channel: "",
  getToken: undefined as undefined | (() => Promise<string>),
  connected: false,
  subscribed: false,
  /** Overrides the client's `state`, e.g. "connected" while a request error is reported. */
  state: undefined as string | undefined,
  client,
  subscription,
  reset() {
    client.clear();
    subscription.clear();
    fakeCentrifuge.connected = false;
    fakeCentrifuge.subscribed = false;
    fakeCentrifuge.state = undefined;
  },
};

export class Centrifuge {
  get state() {
    return fakeCentrifuge.state ?? (fakeCentrifuge.connected ? "connecting" : "disconnected");
  }
  constructor(url: string, options: { getToken?: () => Promise<string> } = {}) {
    fakeCentrifuge.url = url;
    fakeCentrifuge.getToken = options.getToken;
  }
  on(event: string, handler: Handler) {
    client.on(event, handler);
    return this;
  }
  newSubscription(channel: string) {
    fakeCentrifuge.channel = channel;
    return {
      on(event: string, handler: Handler) {
        subscription.on(event, handler);
      },
      subscribe: () => (fakeCentrifuge.subscribed = true),
      unsubscribe: () => (fakeCentrifuge.subscribed = false),
    };
  }
  connect() {
    fakeCentrifuge.connected = true;
  }
  disconnect() {
    fakeCentrifuge.connected = false;
  }
  removeSubscription() {}
}
