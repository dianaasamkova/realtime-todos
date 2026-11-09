// Mock backend with the same contract as the one this client was built against,
// so the app runs standalone. In-memory only: data resets on restart.
//
//   GET    /api/todos         -> ITodo[]
//   POST   /api/todos         -> created ITodo
//   PUT    /api/todos         -> ITodo[] (the full list, as the client expects)
//   DELETE /api/todos/:id     -> 204
//   socket "update-todo-progress" { _id, progress } -> every client when progress changes
const http = require("http");
const { randomUUID } = require("crypto");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT) || 8000;
const ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

let todos = [
    { _id: randomUUID(), name: "Design the API contract", description: "Agree on REST + socket events with backend", progress: 100 },
    { _id: randomUUID(), name: "Real-time progress", description: "Broadcast slider changes to every open tab", progress: 60 },
    { _id: randomUUID(), name: "Write the README", description: "Explain decisions and trade-offs", progress: 20 },
];

function send(res, status, body) {
    res.writeHead(status, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": ORIGIN,
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end(body === undefined ? undefined : JSON.stringify(body));
}

function readJson(req) {
    return new Promise((resolve, reject) => {
        let raw = "";
        req.on("data", (chunk) => (raw += chunk));
        req.on("end", () => {
            try {
                resolve(raw ? JSON.parse(raw) : {});
            } catch (error) {
                reject(error);
            }
        });
    });
}

function clampProgress(value) {
    return Math.min(100, Math.max(0, Number(value) || 0));
}

const server = http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "OPTIONS") return send(res, 204);

    try {
        if (pathname === "/api/todos" && req.method === "GET") return send(res, 200, todos);

        if (pathname === "/api/todos" && req.method === "POST") {
            const { name, description, progress } = await readJson(req);
            if (!name || !description) return send(res, 400, { message: "name and description are required" });
            // The server owns ids; any client-sent _id is ignored.
            const todo = { _id: randomUUID(), name, description, progress: clampProgress(progress) };
            todos.push(todo);
            return send(res, 201, todo);
        }

        if (pathname === "/api/todos" && req.method === "PUT") {
            const update = await readJson(req);
            const current = todos.find((todo) => todo._id === update._id);
            if (!current) return send(res, 404, { message: "todo not found" });
            const next = { ...current, ...update, progress: clampProgress(update.progress ?? current.progress) };
            todos = todos.map((todo) => (todo._id === next._id ? next : todo));
            if (next.progress !== current.progress) {
                io.emit("update-todo-progress", { _id: next._id, progress: next.progress });
            }
            return send(res, 200, todos);
        }

        const match = pathname.match(/^\/api\/todos\/([^/]+)$/);
        if (match && req.method === "DELETE") {
            todos = todos.filter((todo) => todo._id !== match[1]);
            return send(res, 204);
        }

        send(res, 404, { message: "not found" });
    } catch {
        send(res, 400, { message: "invalid JSON" });
    }
});

const io = new Server(server, { cors: { origin: ORIGIN } });
io.on("connection", (socket) => console.log(`client connected: ${socket.id}`));

server.listen(PORT, () => console.log(`Mock API on http://localhost:${PORT} (CORS: ${ORIGIN})`));
