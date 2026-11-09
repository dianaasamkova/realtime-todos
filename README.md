# Real-time Todos

[![CI](https://github.com/dianaasamkova/socket-todos/actions/workflows/ci.yml/badge.svg)](https://github.com/dianaasamkova/socket-todos/actions/workflows/ci.yml)

A shared todo board in React: progress, new todos and deletes sync live between everyone who has it open, over socket.io or Centrifugo.

<img src="docs/screenshot.png" alt="Todo list with a connection status of Live over socket.io. The Real-time progress card is highlighted with the label Updated just now after another user moved it to 85%." width="720">

<sub>Another user just moved “Real-time progress” to 85%, and the card highlights the change. Data comes from the bundled mock server.</sub>

> **Context:** a 2024 take-home on real-time state (React 18, Create React App, MUI, socket.io), revisited in 2026. The original backend wasn't in the repo, so I wrote a mock server with the same contract. Then I rebuilt the client with Vite, TanStack Query and Tailwind, added Centrifugo as a second transport, and covered it with tests from unit level to two-browser end-to-end. [TECH.md](TECH.md) explains the decisions.

## Highlights

- **One realtime interface, two transports.** `/` uses socket.io and `/centrifugo` uses Centrifugo. The pages are identical. The mock API publishes every write to both, so a tab on each page stays in sync ([`src/realtime/types.ts`](src/realtime/types.ts)).
- **No lost updates after a disconnect.** socket.io's connection state recovery and Centrifugo's channel history replay missed events. When they can't, the client refetches the list. A Playwright test cuts a page's connection to prove it.
- **Late data can't overwrite newer data.** Every todo carries a server-side version, and the cache applies an event or response only if it's newer, so late, duplicate and echoed events are ignored ([`src/todos/cache.ts`](src/todos/cache.ts)). A list response replays the events that arrived while it was in flight, and this tab's unsaved edits stay on top of anything the server sends ([`src/todos/journal.ts`](src/todos/journal.ts), [`src/todos/queries.ts`](src/todos/queries.ts)).
- **Optimistic edits with targeted rollback.** Renames, progress changes and deletes show instantly. If the server refuses one, only that todo rolls back (and only if no newer version arrived meanwhile), and a message says why.
- **Saving that suits a slider.** Dragging sends one request per pause, after 1 s. If you leave the page, a pending save goes out immediately; if you delete the todo, it's dropped.
- **Product details:** a live connection status, highlights on todos someone else changed, a Done state at 100% with filters kept in the URL, Undo after delete, and loading, error and empty states with Retry.
- **Accessible and tested:** named sliders and buttons, visible focus, and no axe violations on any page. 106 Vitest tests (97% line coverage), plus Playwright tests for two-user sync, reconnect catch-up and a keyboard-only flow.

## Tech stack

React 19 · TypeScript 6 · Vite 8 · TanStack Query 5 · React Router 8 · Tailwind CSS 4 · Radix Slider · socket.io 4 · Centrifugo 6 · Vitest 5 + Testing Library + MSW · Playwright · Node 22 mock server

## Quick start

Requires Node 22.18 or later, because the mock server runs TypeScript directly. Docker is only needed for the Centrifugo page.

```bash
npm install
```

```bash
npm run server     # mock API + socket.io on http://localhost:8000
```

```bash
npm run dev        # app on http://localhost:5173
```

Open the app in two windows and move a slider in one: the other window follows about a second later.

To try the Centrifugo page, start Centrifugo, then open <http://localhost:5173/centrifugo>:

```bash
docker compose up -d     # Centrifugo on http://localhost:8001
```

Without Centrifugo, that page shows "Reconnecting…" and the socket.io page works as usual.

<img src="docs/screenshot-mobile.png" alt="Todo detail page on a phone: title, description and a progress bar at 85%." width="260">

## Scripts

| Script                            | What it does                                                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Vite dev server on port 5173                                                                                                        |
| `npm run server`                  | Mock API, socket.io and Centrifugo publisher on port 8000                                                                           |
| `npm run build`                   | Production build into `dist/`                                                                                                       |
| `npm run preview`                 | Serves the build on port 4173                                                                                                       |
| `npm test`                        | Unit, component and server tests (Vitest)                                                                                           |
| `npm run coverage`                | Tests with a coverage report                                                                                                        |
| `npm run e2e`                     | Playwright tests; starts the API and a production build itself. Add `E2E_CENTRIFUGO=1` with Centrifugo running to include its tests |
| `npm run lint`                    | ESLint                                                                                                                              |
| `npm run typecheck`               | TypeScript for the app and for Node code (server, configs, e2e)                                                                     |
| `npm run format` / `format:check` | Prettier                                                                                                                            |

## Configuration

| Variable                                        | Default                                       | Used by                                                                                        |
| ----------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `VITE_API_URL`                                  | `http://localhost:8000`                       | App: REST API and socket.io                                                                    |
| `VITE_CENTRIFUGO_URL`                           | `ws://localhost:8001/connection/websocket`    | App: Centrifugo endpoint                                                                       |
| `PORT`                                          | `8000`                                        | Server                                                                                         |
| `CLIENT_ORIGINS`                                | `http://localhost:5173,http://localhost:4173` | Server: CORS and socket.io. Keep it in sync with `allowed_origins` in `centrifugo/config.json` |
| `CENTRIFUGO_API_URL`                            | `http://localhost:8001`                       | Server: where to publish. An empty value disables Centrifugo                                   |
| `CENTRIFUGO_API_KEY`, `CENTRIFUGO_TOKEN_SECRET` | match `centrifugo/config.json`                | Server. These are local development values, not secrets                                        |

## API contract

| Method   | Path                    | Response                           | Realtime event            |
| -------- | ----------------------- | ---------------------------------- | ------------------------- |
| `GET`    | `/api/todos`            | `Todo[]`                           |                           |
| `POST`   | `/api/todos`            | `201 Todo`                         | `todo:created` `{ todo }` |
| `PATCH`  | `/api/todos/:id`        | `200 Todo`                         | `todo:updated` `{ todo }` |
| `DELETE` | `/api/todos/:id`        | `204`                              | `todo:deleted` `{ _id }`  |
| `GET`    | `/api/centrifugo/token` | `{ token }` (HS256 connection JWT) |                           |

`Todo = { _id, name, description, progress (0–100), version }`. The server owns `_id` and `version`. Invalid input gets a `400` with a `message`. socket.io emits each event under its type. Centrifugo publishes it to the `todos` channel. The types are shared by client and server in [`shared/todo.ts`](shared/todo.ts).

## Project structure

```
shared/todo.ts              # Todo and event types used by client and server
server/                     # Mock backend (Node, TypeScript): store, REST, socket.io, Centrifugo publisher
centrifugo/config.json      # Centrifugo config for docker compose (history + recovery)
src/
├── api/todos.ts            # fetch client with readable errors
├── todos/                  # TanStack Query hooks, versioned cache updates, undoable delete
├── realtime/               # Transport interface, socket.io and Centrifugo transports, provider
├── pages/                  # List page (filters, add form), detail page
├── components/             # Todo card, form, connection status, shadcn-style ui/
├── hooks/                  # useDebouncedCallback (flush on unmount, cancel)
└── test/                   # MSW API mock, fake socket.io and Centrifugo clients
e2e/                        # Playwright: two-user sync, reconnect, accessibility
```

## Docs

- [TECH.md](TECH.md): problem and acceptance criteria, architecture diagrams, decisions and trade-offs, accessibility, testing strategy, a 2026 retrospective, and a roadmap.
