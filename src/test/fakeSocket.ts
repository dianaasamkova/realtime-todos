/** Stand-in for socket.io-client: tests push server events with `fakeSocket.serverEmit`. */
type Handler = (...args: never[]) => void;

const handlers = new Map<string, Set<Handler>>();

export const fakeSocket = {
  connected: true,
  recovered: false,
  on(event: string, handler: Handler) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(handler);
    return fakeSocket;
  },
  off(event: string, handler: Handler) {
    handlers.get(event)?.delete(handler);
    return fakeSocket;
  },
  disconnect() {
    handlers.clear();
    return fakeSocket;
  },
  serverEmit(event: string, ...args: unknown[]) {
    handlers.get(event)?.forEach((handler) => (handler as (...a: unknown[]) => void)(...args));
  },
  reset() {
    handlers.clear();
    fakeSocket.connected = true;
    fakeSocket.recovered = false;
  },
};

export const io = () => fakeSocket;
export default io;
