import { createContext, useContext } from "react";
import type { ConnectionStatus } from "./types";

export interface RealtimeState {
  transportName: string;
  status: ConnectionStatus;
  /** Todos recently changed by someone else; cards highlight them briefly. */
  remoteChanges: ReadonlySet<string>;
}

export const RealtimeContext = createContext<RealtimeState>({
  transportName: "",
  status: "connecting",
  remoteChanges: new Set(),
});

export const useRealtime = () => useContext(RealtimeContext);
export const useRemoteHighlight = (id: string) => useContext(RealtimeContext).remoteChanges.has(id);
