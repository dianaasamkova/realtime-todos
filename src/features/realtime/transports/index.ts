import { fetchCentrifugoToken } from "@/features/todos/api";
import { API_URL, CENTRIFUGO_URL } from "@/app/config";
import { lazyTransport } from "./lazy";
import { createSocketIoTransport } from "./socketio";

export const transports = {
  socketio: createSocketIoTransport(API_URL),
  // Only the /centrifugo page needs this client, so it is a separate chunk.
  centrifugo: lazyTransport("Centrifugo", async () => {
    const { createCentrifugoTransport } = await import("./centrifugo");
    return createCentrifugoTransport(CENTRIFUGO_URL, fetchCentrifugoToken);
  }),
};
