import { NextResponse } from "next/server";
import { balancePlayers } from "@/lib/teamBalancer";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { players } = await req.json();

    if (!Array.isArray(players) || players.length < 4) {
      return NextResponse.json(
        { error: "Please select at least 4 players." },
        { status: 400 }
      );
    }

    const result = balancePlayers(players);

    return NextResponse.json({
      ok: true,
      teamAName: "Surprise 1",
      teamBName: "Surprise 2",
      ...result,
    });
  } catch (error) {
    console.error("AI splitter balance error:", error);
    return NextResponse.json(
      { error: "Failed to balance teams." },
      { status: 500 }
    );
  }
}