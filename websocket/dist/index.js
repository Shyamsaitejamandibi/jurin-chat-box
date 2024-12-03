"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const http_1 = require("http");
const url_1 = require("url");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const wss = new ws_1.Server({ noServer: true });
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
app.use((0, cors_1.default)({
    credentials: true,
    origin: "http://localhost:5173",
}));
wss.on("connection", (ws, request) => {
    const { query } = (0, url_1.parse)(request.url, true);
    const userId = query.userId;
    console.log(`New WebSocket connection from userId: ${userId}`);
    ws.on("message", (message) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const data = JSON.parse(message);
            if (data.type === "chat") {
                const newMessage = yield prisma.message.create({
                    data: {
                        content: data.content,
                        userId: userId,
                    },
                    include: {
                        user: true,
                    },
                });
                wss.clients.forEach((client) => {
                    if (client.readyState === client.OPEN) {
                        client.send(JSON.stringify({
                            type: "newMessage",
                            message: newMessage,
                        }));
                    }
                });
            }
        }
        catch (error) {
            console.error("Error handling WebSocket message:", error);
        }
    }));
    ws.on("close", () => {
        console.log(`WebSocket disconnected for userId: ${userId}`);
    });
});
server.on("upgrade", (request, socket, head) => {
    const { pathname } = (0, url_1.parse)(request.url, true);
    if (pathname === "/ws") {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, request);
        });
    }
    else {
        socket.destroy();
    }
});
app.post("/api/users", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name } = req.body;
    if (!name) {
        res.status(400).json({ error: "Name is required" });
    }
    try {
        const user = yield prisma.user.create({ data: { name } });
        res.status(201).json(user);
    }
    catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}));
const openai_1 = require("openai");
const client = new openai_1.OpenAI({
    apiKey: process.env["OPENAI_API_KEY"], // This is the default and can be omitted
});
app.post("/api/ai-response", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { messages, user } = req.body;
    if (!messages || !user) {
        res.status(400).json({ error: "Invalid request" });
    }
    try {
        const params = {
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant in a chat application.",
                },
                ...messages.map((msg) => ({
                    role: msg.userId === "ai" ? "assistant" : "user",
                    content: `${msg.user.name}: ${msg.content}`,
                })),
            ],
            model: "gpt-4o",
        };
        const completion = yield client.chat.completions.create(params);
        const aiResponse = completion.choices[0].message.content;
        res.json({ content: aiResponse });
    }
    catch (error) {
        console.error("Error getting AI response:", error);
        res.status(500).json({ error: "Error getting AI response" });
    }
}));
server.listen(3001, () => {
    console.log("Server listening on port 3001");
});
