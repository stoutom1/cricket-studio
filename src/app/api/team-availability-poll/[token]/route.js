import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function GET(request, { params }) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: "Invalid poll token." },
        { status: 400 }
      );
    }

    const poll = await prisma.teamAvailabilityPoll.findUnique({
      where: {
        token,
      },
      include: {
        options: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        responses: true,
      },
    });

    if (!poll) {
      return NextResponse.json(
        { error: "Poll not found." },
        { status: 404 }
      );
    }

    const savedSourceTeamIds = String(poll.sourceTeamIds || "")
      .split(",")
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);

    /*
      New polls:
      Load only teams selected when the poll was created.

      Old polls:
      If sourceTeamIds is empty, load all teams in that poll's league.
    */
    const teams = await prisma.team.findMany({
      where: {
        leagueId: poll.leagueId,
        ...(savedSourceTeamIds.length
          ? {
              id: {
                in: savedSourceTeamIds,
              },
            }
          : {}),
      },
      include: {
        players: {
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
      for (const player of team.players || []) {
        const playerKey =
          player.globalPlayerId != null
            ? String(player.globalPlayerId)
            : normalizeName(player.name);

        if (!uniquePlayers.has(playerKey)) {
          uniquePlayers.set(playerKey, {
            id: player.id,
            playerKey,
            playerName: player.name,
            leagueId: poll.leagueId,
            sourceTeamIds: [team.id],
            sourceTeams: [team.name],
          });
        } else {
          const existing = uniquePlayers.get(playerKey);

          if (!existing.sourceTeamIds.includes(team.id)) {
            existing.sourceTeamIds.push(team.id);
          }

          if (!existing.sourceTeams.includes(team.name)) {
            existing.sourceTeams.push(team.name);
          }
        }
      }
    }

    const players = Array.from(uniquePlayers.values()).sort((a, b) =>
      a.playerName.localeCompare(b.playerName, undefined, {
        sensitivity: "base",
        numeric: true,
      })
    );

    return NextResponse.json({
      poll: {
        ...poll,
        players,
        sourceTeams: teams.map((team) => ({
          id: team.id,
          name: team.name,
        })),
      },
    });
  } catch (error) {
    console.error("Load availability poll failed:", error);

    return NextResponse.json(
      { error: "Failed to load availability poll." },
      { status: 500 }
    );
  }
}