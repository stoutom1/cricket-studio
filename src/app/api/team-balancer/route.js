import { NextResponse } from "next/server";
import { balancePlayers } from "@/lib/teamBalancer";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { players } = await req.json();

    if (!Array.isArray(players) || players.length < 2) {
      return NextResponse.json(
        { error: "At least 2 players are required." },
        { status: 400 }
      );
    }
const membership = await prisma.leagueMember.findFirst({
  where: {
    leagueId,
    userId: user.id,
  },
});

const canUseBuilder =
  membership?.role === "OWNER" ||
  membership?.role === "ADMIN" ||
  membership?.role === "CAPTAIN" ||
  Boolean(membership?.canScoreMatch);

if (!canUseBuilder) {
  return NextResponse.json(
    {
      error:
        "You do not have permission to use the team builder.",
    },
    { status: 403 }
  );
}
    const result = balancePlayers(players);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Team balancer error:", error);

    return NextResponse.json(
      { error: "Failed to balance teams." },
      { status: 500 }
    );
  }
}