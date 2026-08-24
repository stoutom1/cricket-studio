import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { buildMatchStats } from "@/lib/scoring";
import { filterMatchStatsForLeague } from "@/lib/player-analytics-exclusions";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Next.js 15: params is a Promise
  const { matchId: matchIdParam } = await params;
  const matchId = Number(matchIdParam);

  if (Number.isNaN(matchId) || matchId <= 0) {
    return NextResponse.json(
      { error: "Invalid match id 5" },
      { status: 400 }
    );
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: {
        include: {
          players: {
            include: {
              team: true,
            },
          },
        },
      },
      teamB: {
        include: {
          players: {
            include: {
              team: true,
            },
          },
        },
      },
      league: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      balls: {
        orderBy: [
          { inningsNo: "asc" },
          { sequence: "asc" },
        ],
      },
    },
  });

  if (!match) {
    return NextResponse.json(
      { error: "Match not found" },
      { status: 404 }
    );
  }

  const stats = filterMatchStatsForLeague(
    buildMatchStats(match),
    match.league
  );

  return NextResponse.json(stats);
}