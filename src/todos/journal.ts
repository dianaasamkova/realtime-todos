import type { QueryClient } from "@tanstack/react-query";
import type { TodoEvent } from "../../shared/todo.ts";

/**
 * Recent realtime events per query client. A list request can be answered before an event
 * that arrives ahead of the response; replaying the events received since the request started
 * keeps the newer state. Versions make the replay idempotent.
 */
interface Journal {
  position: number;
  entries: Array<{ position: number; event: TodoEvent }>;
}

/** Enough for any realistic burst during one list request. */
const MAX_ENTRIES = 500;
const journals = new WeakMap<QueryClient, Journal>();

function journalFor(client: QueryClient): Journal {
  let journal = journals.get(client);
  if (!journal) {
    journal = { position: 0, entries: [] };
    journals.set(client, journal);
  }
  return journal;
}

export function recordEvent(client: QueryClient, event: TodoEvent) {
  const journal = journalFor(client);
  journal.entries.push({ position: ++journal.position, event });
  if (journal.entries.length > MAX_ENTRIES) journal.entries.shift();
}

export const journalPosition = (client: QueryClient) => journalFor(client).position;

export const eventsSince = (client: QueryClient, position: number) =>
  journalFor(client)
    .entries.filter((entry) => entry.position > position)
    .map((entry) => entry.event);
