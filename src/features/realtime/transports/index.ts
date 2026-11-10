import { fetchCentrifugoToken } from "@/features/todos/api";
import { API_URL, CENTRIFUGO_URL } from "@/app/config";
import { createCentrifugoTransport } from "./centrifugo";
import { createSocketIoTransport } from "./socketio";

export const transports = {
  socketio: createSocketIoTransport(API_URL),
  centrifugo: createCentrifugoTransport(CENTRIFUGO_URL, fetchCentrifugoToken),
};
