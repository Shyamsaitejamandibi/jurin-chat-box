"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface Message {
  id: string;
  content: string;
  userId: string;
  user: {
    name: string;
  };
  timestamp: string;
}

interface User {
  id: string;
  name: string;
}

export default function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (user) {
      connectWebSocket();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user]);

  const connectWebSocket = () => {
    if (!user) return;
    wsRef.current = new WebSocket(`ws://localhost:3001/ws?userId=${user.id}`);

    wsRef.current.onopen = () => {
      console.log("WebSocket connected");
    };

    wsRef.current.onclose = () => {
      console.log("WebSocket disconnected");
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "newMessage") {
          setMessages((prevMessages) => [...prevMessages, data.message]);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  };

  const createUser = async () => {
    if (userName.trim() !== "") {
      try {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: userName }),
        });

        if (!response.ok) {
          throw new Error("Failed to create user");
        }

        const data = await response.json();
        setUser(data);
      } catch (error) {
        console.error("Error creating user:", error);
      }
    }
  };

  const handleSendMessage = () => {
    if (newMessage.trim() !== "" && wsRef.current && user) {
      wsRef.current.send(
        JSON.stringify({
          type: "chat",
          content: newMessage,
        })
      );
      setNewMessage("");
    }
  };

  const handleAiResponse = async () => {
    setIsAiLoading(true);
    try {
      const response = await fetch("/api/ai-response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages }),
      });
      console.log("response", response);
      const data = await response.json();
      if (data.content) {
        const aiMessage: Message = {
          id: Date.now().toString(),
          content: data.content,
          userId: "ai",
          user: { name: "AI Assistant" },
          timestamp: new Date().toISOString(),
        };
        setMessages((prevMessages) => [...prevMessages, aiMessage]);
      }
    } catch (error) {
      console.error("Error getting AI response:", error);
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Enter your name"
          className="mb-4 w-64"
        />
        <Button onClick={createUser}>Join Chat</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.userId === user.id ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-lg ${
                message.userId === user.id
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              <p className="font-bold">{message.user.name}</p>
              <p>{message.content}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t flex">
        <Input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 mr-2"
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              handleSendMessage();
            }
          }}
        />
        <Button onClick={handleSendMessage}>Send</Button>
        <Button
          onClick={handleAiResponse}
          disabled={isAiLoading}
          variant="secondary"
        >
          {isAiLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          AI
        </Button>
      </div>
    </div>
  );
}
