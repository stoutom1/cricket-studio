import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-5.4-mini",
      input: [
        {
          role: "system",
          content: `
You are Cric4All Assistant.

Cric4All is a cricket scoring app and website.
Help users with:
- creating teams
- creating matches
- live scoring
- toss setup
- batting and bowling setup
- extras like wides, no-balls, byes, leg-byes
- wickets
- spectator sharing links
- match stats
- login and basic troubleshooting

Rules:
- Keep answers short and simple.
- Do not invent private user data.
- If the user asks about a specific match and no match data is provided, ask them to open the match or provide match details.
          `,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    return NextResponse.json({
      reply: response.output_text || "Sorry, I could not generate a reply.",
    });
  } catch (error) {
    console.error("Chatbot error:", error);

    return NextResponse.json(
      { error: "Chatbot failed. Please try again." },
      { status: 500 }
    );
  }
}