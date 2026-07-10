import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Read and validate leagueId first
    const leagueIdParam = searchParams.get("leagueId");
    const leagueId = Number(leagueIdParam);

    if (!leagueIdParam || !Number.isInteger(leagueId) || leagueId <= 0) {
      return NextResponse.json(
        { error: "A valid leagueId is required." },
        { status: 400 }
      );
    }

    // Declare teamIds BEFORE using it
    const teamIds = String(searchParams.get("teamIds") || "")
      .split(",")
      .map((value) => Number(value))
      .filter((id) => Number.isInteger(id) && id > 0);

    const teams = await prisma.team.findMany({
      where: {
        leagueId,
        ...(teamIds.length
          ? {
              id: {
                in: teamIds,
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

    // If explicit team IDs were supplied, make sure all belong to the league
    if (teamIds.length && teams.length !== teamIds.length) {
      return NextResponse.json(
        {
          error:
            "One or more selected teams do not exist or do not belong to this league.",
        },
        { status: 400 }
      );
    }

    const uniquePlayers = new Map();

    for (const team of teams) {
      for (const player of team.players || []) {
        /*
          Use a true shared/global player ID here if your schema has one.
          Otherwise name-based deduplication keeps the existing Surprise
          roster behavior.
        */
        const playerKey =
          player.globalPlayerId ||
          normalizeName(player.name);

        if (!uniquePlayers.has(playerKey)) {
          uniquePlayers.set(playerKey, {
            id: player.id,
            playerKey,
            playerName: player.name,
            leagueId,
            teamId: team.id,
            teamName: team.name,
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

    return NextResponse.json({
      leagueId,
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        playerCount: team.players?.length || 0,
      })),
      players: Array.from(uniquePlayers.values()).sort((a, b) =>
        a.playerName.localeCompare(b.playerName, undefined, {
          sensitivity: "base",
          numeric: true,
        })
      ),
    });
  } catch (error) {
    console.error("AI splitter players error:", error);

    return NextResponse.json(
      { error: "Failed to load team-builder players." },
      { status: 500 }
    );
  }
}