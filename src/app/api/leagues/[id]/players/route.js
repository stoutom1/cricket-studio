import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

function parsePositiveInteger(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const leagueId = parsePositiveInteger(id);

    if (!leagueId) {
      return NextResponse.json(
        { error: "Invalid league ID." },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const league = await prisma.league.findUnique({
      where: {
        id: leagueId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found." },
        { status: 404 }
      );
    }

    const teams = await prisma.team.findMany({
      where: {
        leagueId,
      },
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

    const uniquePlayers = new Map();

    for (const team of teams) {
      for (const player of team.players) {
        const playerId = Number(player.id);

        if (!uniquePlayers.has(playerId)) {
          uniquePlayers.set(playerId, {
            id: playerId,
            name: player.name,
            teamIds: [],
            teamNames: [],
          });
        }

        const existingPlayer = uniquePlayers.get(playerId);

        if (!existingPlayer.teamIds.includes(team.id)) {
          existingPlayer.teamIds.push(team.id);
        }

        if (!existingPlayer.teamNames.includes(team.name)) {
          existingPlayer.teamNames.push(team.name);
        }
      }
    }

    const players = Array.from(uniquePlayers.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({
      league,
      players,
      totalPlayers: players.length,
    });
  } catch (error) {
    console.error("GET league players error:", error);

    return NextResponse.json(
      { error: "Unable to load league players." },
      { status: 500 }
    );
  }
}