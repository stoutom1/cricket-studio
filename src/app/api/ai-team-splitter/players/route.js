import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function GET() {
  try {
    const league = await prisma.league.findFirst({
      where: {
        name: {
          equals: "Surprise Cricket League",
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!league) {
      return NextResponse.json(
        { error: "Surprise Cricket League not found." },
        { status: 404 }
      );
    }

    const teams = await prisma.team.findMany({
      where: {
        leagueId: league.id,
        name: {
          in: ["Surprise 1", "Surprise 2"],
        },
      },
      include: {
        players: true,
      },
    });

    const uniqueMap = new Map();

    for (const team of teams) {
      for (const player of team.players || []) {
        const key = normalizeName(player.name);
        if (!key) continue;

        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, {
            id: key,
            playerId: player.id,
            playerName: player.name,
            teamName: "Surprise Pool",
            sourceTeams: [team.name],

            runs: 0,
            average: 0,
            strikeRate: 0,
            wickets: 0,
            economy: 12,
            catches: 0,
            runOuts: 0,
            stumpings: 0,
            dismissals: 0,
            winPct: 0,
          });
        } else {
          const existing = uniqueMap.get(key);

          if (!existing.sourceTeams.includes(team.name)) {
            existing.sourceTeams.push(team.name);
          }
        }
      }
    }

    const players = Array.from(uniqueMap.values()).sort((a, b) =>
      a.playerName.localeCompare(b.playerName)
    );

    return NextResponse.json({
      ok: true,
      leagueId: league.id,
      leagueName: league.name,
      players,
    });
  } catch (error) {
    console.error("AI splitter players error:", error);

    return NextResponse.json(
      { error: "Failed to load players." },
      { status: 500 }
    );
  }
}