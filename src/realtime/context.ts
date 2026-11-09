import { createContext, useContext } from "react";
import type { ConnectionStatus } from "./types";

export interface RealtimeState {
  transportName: string;
  status: ConnectionStatus;
  /**
   * True once the realtime connection is up (or failed, or took too long). The first list
   * load waits for it, so no write can fall between the load and the subscription.
   */
  ready: boolean;
  /** Todos recently changed by someone else; cards highlight them briefly. */
  remoteChanges: ReadonlySet<string>;
}

export const RealtimeContext = createContext<RealtimeState>({
  transportName: "",
  status: "connecting",
  ready: true,
  remoteChanges: new Set(),
});

export const useRealtime = () => useContext(RealtimeContext);
export const useRemoteHighlight = (id: string) => useContext(RealtimeContext).remoteChanges.has(id);
