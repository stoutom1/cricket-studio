import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canUseAIStrategy } from "@/lib/aiStrategyAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canUseAIStrategy(session.user?.email)) {
      return NextResponse.json(
        { error: "AI Match Strategy is not enabled for this account." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const leagueId = Number(searchParams.get("leagueId"));

    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      return NextResponse.json({ error: "A valid leagueId is required." }, { status: 400 });
    }

    // Load directly from Team -> Player. This deliberately does not use the
    // Team Builder's currently filtered player pool, match, poll, or upload.
    const teams = await prisma.team.findMany({
      where: { leagueId },
      select: {
        id: true,
        name: true,
        players: {
          select: {
            id: true,
            name: true,
          },
          orderBy: {
            name: "asc",
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(
      {
        success: true,
        leagueId,
        teams: teams.map((team) => ({
          id: team.id,
          name: team.name,
          players: team.players.map((player) => ({
            id: player.id,
            name: player.name,
            playerName: player.name,
            teamId: team.id,
            teamName: team.name,
          })),
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("AI Strategy team-data load failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load league teams and players.",
      },
      { status: 500 }
    );
  }
}
