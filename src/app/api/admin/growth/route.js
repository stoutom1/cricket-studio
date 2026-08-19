import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superAdmin";
import { growthInternalLeagueIds } from "@/lib/growth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function daysAgo(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days + 1);
  return d;
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const requestedDays = Number(url.searchParams.get("days") || 30);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const since = daysAgo(days);
  const internalLeagueIds = growthInternalLeagueIds();
  const externalLeagueWhere = internalLeagueIds.length ? { id: { notIn: internalLeagueIds } } : {};
  const externalMatchWhere = internalLeagueIds.length ? { leagueId: { notIn: internalLeagueIds } } : {};

  const [
    visitors, signups, leagues, matches, startedMatches, completedMatches,
    externalLeagues, externalMatches, externalStarted, externalCompleted,
    spectatorViews, spectatorCtaClicks, recentEvents,
  ] = await Promise.all([
    prisma.growthEvent.groupBy({ by: ["visitorId"], where: { eventType: "LANDING_VIEW", createdAt: { gte: since }, visitorId: { not: null } } }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.league.count({ where: { createdAt: { gte: since } } }),
    prisma.match.count({ where: { createdAt: { gte: since } } }),
    prisma.match.count({ where: { createdAt: { gte: since }, OR: [{ startedAt: { not: null } }, { balls: { some: {} } }] } }),
    prisma.match.count({ where: { createdAt: { gte: since }, OR: [{ endedAt: { not: null } }, { status: { in: ["COMPLETED", "COMPLETED_LOCKED"] } }] } }),
    prisma.league.count({ where: { createdAt: { gte: since }, ...externalLeagueWhere } }),
    prisma.match.count({ where: { createdAt: { gte: since }, ...externalMatchWhere } }),
    prisma.match.count({ where: { createdAt: { gte: since }, ...externalMatchWhere, OR: [{ startedAt: { not: null } }, { balls: { some: {} } }] } }),
    prisma.match.count({ where: { createdAt: { gte: since }, ...externalMatchWhere, OR: [{ endedAt: { not: null } }, { status: { in: ["COMPLETED", "COMPLETED_LOCKED"] } }] } }),
    prisma.growthEvent.count({ where: { eventType: "SPECTATOR_VIEW", createdAt: { gte: since } } }),
    prisma.growthEvent.count({ where: { eventType: "SPECTATOR_CTA_CLICKED", createdAt: { gte: since } } }),
    prisma.growthEvent.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  const completedByLeague = await prisma.match.groupBy({
    by: ["leagueId"],
    where: { createdAt: { gte: since }, leagueId: { not: null }, OR: [{ endedAt: { not: null } }, { status: { in: ["COMPLETED", "COMPLETED_LOCKED"] } }] },
    _count: { id: true },
  });
  const repeatLeagues = completedByLeague.filter((row) => row._count.id >= 2).length;
  const externalRepeatLeagues = completedByLeague.filter((row) => row._count.id >= 2 && !internalLeagueIds.includes(Number(row.leagueId))).length;

  return NextResponse.json({
    days, since: since.toISOString(), internalLeagueIds,
    all: {
      visitors: visitors.length, signups, leagues, matches, startedMatches, completedMatches, repeatLeagues, spectatorViews, spectatorCtaClicks,
      conversion: { visitorToSignup: pct(signups, visitors.length), leagueToMatch: pct(matches, leagues), matchToStart: pct(startedMatches, matches), startToComplete: pct(completedMatches, startedMatches), spectatorToCta: pct(spectatorCtaClicks, spectatorViews) },
    },
    external: { leagues: externalLeagues, matches: externalMatches, startedMatches: externalStarted, completedMatches: externalCompleted, repeatLeagues: externalRepeatLeagues },
    recentEvents: recentEvents.map((event) => ({ ...event, id: String(event.id) })),
  });
}
