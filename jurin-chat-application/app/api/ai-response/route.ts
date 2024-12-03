import { NextResponse } from "next/server";

import { OpenAI } from "openai";

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"], // This is the default and can be omitted
});

export async function POST(request: Request) {
  try {
    // Parse the JSON body from the request
    const { messages, user } = await request.json();
    // console.log("messages", messages);
    // Validate required parameters
    if (!messages || !user) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Prepare OpenAI API parameters
    const params = {
      model: "gpt-4o-2024-08-06",
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
    };
    console.log("params", params);
    // Send the request to OpenAI's API
    const completion = await client.chat.completions.create(params);
    console.log("completion", completion);

    // Extract the AI's response
    const aiResponse = completion.choices[0].message.content;

    // Return the response
    return NextResponse.json({ content: aiResponse });
  } catch (error) {
    console.error("Error getting AI response:", error);
    return NextResponse.json(
      { error: "Error getting AI response" },
      { status: 500 }
    );
  }
}
