import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const leagueId = searchParams.get("leagueId");
  const matchId = searchParams.get("matchId");

  const where = {};

  if (leagueId && leagueId !== "ALL") {
    where.leagueId = Number(leagueId);
  }

  if (matchId) {
    where.matchId = Number(matchId);
  }

  const auditLogs = await prisma.auditLog.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    take: 300,
  });

  const leagueIds = [
    ...new Set(
      auditLogs
        .map((log) => log.leagueId)
        .filter(Boolean)
    ),
  ];

  const leagues = leagueIds.length
    ? await prisma.league.findMany({
        where: {
          id: {
            in: leagueIds,
          },
        },
        select: {
          id: true,
          name: true,
        },
      })
    : [];

  const leagueNameById = new Map(
    leagues.map((league) => [league.id, league.name])
  );

  return NextResponse.json(
    auditLogs.map((log) => ({
      ...log,
      leagueName:
        log.leagueId && leagueNameById.has(log.leagueId)
          ? leagueNameById.get(log.leagueId)
          : "System / No League",
    }))
  );
}