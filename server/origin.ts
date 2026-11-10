import type { TodoChange } from "../contract/todos.ts";

const MAX_CLIENT_ID_LENGTH = 100;

/**
 * Marks a change with the id of the client that made the write, taken from its `X-Client-Id`
 * header. A missing, empty or over-long id is ignored. The id is advisory: any client can send
 * any value, so it only tells a well-behaved tab which changes are its own echo and must not
 * be used for authorisation.
 */
export function withOrigin(
  change: TodoChange,
  header: string | string[] | null | undefined,
): TodoChange {
  const id = typeof header === "string" ? header : undefined;
  return id && id.length <= MAX_CLIENT_ID_LENGTH ? { ...change, origin: id } : change;
}
