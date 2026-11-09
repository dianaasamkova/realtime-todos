import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { eventsSince, journalPosition, recordEvent } from "./journal";

const deleted = (id: string) => ({ type: "todo:deleted" as const, _id: id });

describe("event journal", () => {
  it("returns the events recorded after a position, per query client", () => {
    const client = new QueryClient();
    recordEvent(client, deleted("a"));
    const position = journalPosition(client);
    recordEvent(client, deleted("b"));
    recordEvent(client, deleted("c"));

    expect(eventsSince(client, position)).toEqual([deleted("b"), deleted("c")]);
    expect(eventsSince(new QueryClient(), 0)).toEqual([]);
  });

  it("keeps a bounded number of entries", () => {
    const client = new QueryClient();
    for (let i = 0; i < 600; i++) recordEvent(client, deleted(String(i)));
    const events = eventsSince(client, 0);
    expect(events).toHaveLength(500);
    expect(events[0]).toEqual(deleted("100"));
  });
});
