import { Server } from "ws";
import { createServer } from "http";
import { parse } from "url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();
const server = createServer(app);
const wss = new Server({ noServer: true });

app.use(cookieParser());
app.use(express.json());
app.use(
  cors({
    credentials: true,
    origin: "http://localhost:5173",
  })
);

wss.on("connection", (ws, request) => {
  const { query } = parse(request.url!, true);
  const userId = query.userId as string;

  console.log(`New WebSocket connection from userId: ${userId}`);

  ws.on("message", async (message: string) => {
    try {
      const data = JSON.parse(message);
      if (data.type === "chat") {
        const newMessage = await prisma.message.create({
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
            client.send(
              JSON.stringify({
                type: "newMessage",
                message: newMessage,
              })
            );
          }
        });
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  });

  ws.on("close", () => {
    console.log(`WebSocket disconnected for userId: ${userId}`);
  });
});

server.on("upgrade", (request, socket, head) => {
  const { pathname } = parse(request.url!, true);

  if (pathname === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

app.post("/api/users", async (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
  }

  try {
    const user = await prisma.user.create({ data: { name } });
    res.status(201).json(user);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

import { OpenAI } from "openai";

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"], // This is the default and can be omitted
});

app.post("/api/ai-response", async (req, res) => {
  const { messages, user } = req.body;

  if (!messages || !user) {
    res.status(400).json({ error: "Invalid request" });
  }

  try {
    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant in a chat application.",
        },
        ...messages.map((msg: any) => ({
          role: msg.userId === "ai" ? "assistant" : "user",
          content: `${msg.user.name}: ${msg.content}`,
        })),
      ],
      model: "gpt-4o",
    };

    const completion = await client.chat.completions.create(params);

    const aiResponse = completion.choices[0].message.content;

    res.json({ content: aiResponse });
  } catch (error) {
    console.error("Error getting AI response:", error);
    res.status(500).json({ error: "Error getting AI response" });
  }
});

server.listen(3001, () => {
  console.log("Server listening on port 3001");
});
