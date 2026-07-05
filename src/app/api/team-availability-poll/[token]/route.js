import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function GET(req, { params }) {
  try {
    const { token } = await params;

    const poll = await prisma.teamAvailabilityPoll.findUnique({
      where: { token },
      include: {
        options: {
          orderBy: { sortOrder: "asc" },
        },
        responses: true,
      },
    });

    if (!poll) {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }

    const teams = await prisma.team.findMany({
      where: {
        leagueId: poll.leagueId || undefined,
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
            playerKey: key,
            playerName: player.name,
            sourceTeams: [team.name],
          });
        } else {
          const existing = uniqueMap.get(key);
          if (!existing.sourceTeams.includes(team.name)) {
            existing.sourceTeams.push(team.name);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      poll,
      players: Array.from(uniqueMap.values()).sort((a, b) =>
        a.playerName.localeCompare(b.playerName)
      ),
    });
  } catch (error) {
    console.error("Load availability poll failed:", error);
    return NextResponse.json(
      { error: "Failed to load poll." },
      { status: 500 }
    );
  }
}