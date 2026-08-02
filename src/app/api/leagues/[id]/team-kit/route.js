import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  assertTeamKitTables,
  resolveTeamKitAccess,
  SHARED_SCOPE_KEY,
  syncLeagueKitCustodyTasks,
} from "@/lib/kit/team-custody";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numberId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

function normalizeTeamName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function surpriseSharedPlayers(teams) {
  const surpriseTeams = teams.filter((team) => {
    const key = normalizeTeamName(team.name);
    return key === "surprise1" || key === "surprise2";
  });

  const sourceTeams = surpriseTeams.length
    ? surpriseTeams
    : teams;

  const seen = new Set();
  const result = [];

  for (const team of sourceTeams) {
    for (const player of team.players || []) {
      const displayName = String(player.name || "")
        .trim()
        .replace(/\s+/g, " ");
      const key = displayName.toLowerCase();

      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push({
        id: player.id,
        name: displayName,
        teamId: team.id,
        teamName: team.name,
      });
    }
  }

  return result.sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function matchReferenceDate(match) {
  const value =
    match?.lockedAt ||
    match?.endedAt ||
    match?.scheduledAt ||
    null;

  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date
    : null;
}

function consolidatePendingTasks(tasks) {
  const grouped = new Map();

  for (const task of tasks) {
    const existing = grouped.get(task.scopeKey);
    const taskDate =
      matchReferenceDate(task.match) ||
      new Date(task.createdAt || 0);
    const existingDate = existing
      ? matchReferenceDate(existing.match) ||
        new Date(existing.createdAt || 0)
      : null;

    if (!existing || taskDate > existingDate) {
      grouped.set(task.scopeKey, {
        ...task,
        pendingMatchCount:
          (existing?.pendingMatchCount || 0) + 1,
      });
    } else {
      existing.pendingMatchCount =
        (existing.pendingMatchCount || 1) + 1;
    }
  }

  return [...grouped.values()].sort((a, b) => {
    const aDate =
      matchReferenceDate(a.match)?.getTime() || 0;
    const bDate =
      matchReferenceDate(b.match)?.getTime() || 0;
    return bDate - aDate;
  });
}

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const leagueId = numberId(id);

    if (!leagueId) {
      return NextResponse.json(
        { error: "Invalid league id." },
        { status: 400 }
      );
    }

    await assertTeamKitTables();

    const access = await resolveTeamKitAccess({
      session,
      leagueId,
    });

    if (!access.authorized) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    await syncLeagueKitCustodyTasks(leagueId);

    const allTeams = await prisma.team.findMany({
      where: { leagueId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        players: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const visibleTeams = access.sharedKit
      ? allTeams
      : allTeams.filter((team) =>
          access.allowedTeamIds.includes(team.id)
        );

    const allowedScopeKeys = access.sharedKit
      ? [SHARED_SCOPE_KEY]
      : visibleTeams.map(
          (team) => `TEAM:${team.id}`
        );

    if (!access.sharedKit && !visibleTeams.length) {
      return NextResponse.json({
        success: true,
        league: {
          ...access.league,
          sharedKit: false,
        },
        access: {
          isOwner: access.isOwner,
          canRecord: false,
          canManageAccess: access.canManageAccess,
          allowedTeamIds: [],
        },
        teams: [],
        sharedPlayers: [],
        states: [],
        pendingTasks: [],
        history: [],
        members: [],
        accessMappings: [],
        emptyReason:
          "Your account is not linked to a team for kit visibility. Ask the league owner to assign your team access.",
      });
    }

    const allowedScopeSet = new Set(
      allowedScopeKeys
    );

    const allStates = allowedScopeKeys.length
      ? await prisma.$queryRaw`
          SELECT *
          FROM "TeamKitState"
          WHERE "leagueId" = ${leagueId}
          ORDER BY "updatedAt" DESC
        `
      : [];

    const allPendingTasks = allowedScopeKeys.length
      ? await prisma.$queryRaw`
          SELECT *
          FROM "TeamKitCustodyTask"
          WHERE "leagueId" = ${leagueId}
            AND "status" = 'PENDING'
          ORDER BY "createdAt" DESC
        `
      : [];

    const allHistory = allowedScopeKeys.length
      ? await prisma.$queryRaw`
          SELECT e.*, u."name" AS "recordedByName", u."email" AS "recordedByEmail"
          FROM "TeamKitCustodyEvent" e
          LEFT JOIN "User" u ON u."id"::TEXT = e."recordedByUserId"::TEXT
          WHERE e."leagueId" = ${leagueId}
          ORDER BY e."createdAt" DESC
          LIMIT 250
        `
      : [];

    const states = allStates.filter((item) =>
      allowedScopeSet.has(item.scopeKey)
    );
    const pendingTaskRows = allPendingTasks.filter(
      (item) =>
        allowedScopeSet.has(item.scopeKey)
    );
    const history = allHistory
      .filter((item) =>
        allowedScopeSet.has(item.scopeKey)
      )
      .slice(0, 100);

    const matchIds = [
      ...new Set(
        [...pendingTaskRows, ...history]
          .map((item) => Number(item.matchId))
          .filter(
            (matchId) =>
              Number.isInteger(matchId) && matchId > 0
          )
      ),
    ];

    const matches = matchIds.length
      ? await prisma.match.findMany({
          where: { id: { in: matchIds } },
          select: {
            id: true,
            status: true,
            scheduledAt: true,
            endedAt: true,
            lockedAt: true,
            teamA: {
              select: { id: true, name: true },
            },
            teamB: {
              select: { id: true, name: true },
            },
          },
        })
      : [];

    const matchMap = new Map(
      matches.map((match) => [match.id, match])
    );

    const teamMap = new Map(
      allTeams.map((team) => [team.id, team])
    );

    const enrich = (item) => {
      const match = matchMap.get(Number(item.matchId));
      const team = item.teamId
        ? teamMap.get(Number(item.teamId))
        : null;

      return {
        ...item,
        team: team
          ? { id: team.id, name: team.name }
          : null,
        match: match
          ? {
              ...match,
              label: `${match.teamA?.name || "Team A"} vs ${
                match.teamB?.name || "Team B"
              }`,
            }
          : null,
      };
    };

    const enrichedPendingTasks =
      pendingTaskRows.map(enrich);
    const pendingTasks =
      consolidatePendingTasks(
        enrichedPendingTasks
      );
    const pendingMatchTotal =
      enrichedPendingTasks.length;

    let members = [];
    let accessMappings = [];

    if (access.canManageAccess) {
      members = await prisma.$queryRaw`
        SELECT
          u."id",
          u."name",
          u."email",
          COALESCE(
            to_jsonb(lm)->>'role',
            to_jsonb(lm)->>'membershipRole',
            ''
          ) AS "role"
        FROM "LeagueMember" lm
        JOIN "User" u ON u."id"::TEXT = lm."userId"::TEXT
        WHERE lm."leagueId" = ${leagueId}
        ORDER BY COALESCE(u."name", u."email") ASC
      `;

      accessMappings = await prisma.$queryRaw`
        SELECT *
        FROM "TeamKitUserAccess"
        WHERE "leagueId" = ${leagueId}
        ORDER BY "userId", "teamId"
      `;
    }

    return NextResponse.json({
      success: true,
      league: {
        ...access.league,
        sharedKit: access.sharedKit,
      },
      access: {
        isOwner: access.isOwner,
        canRecord: access.canRecord,
        canManageAccess: access.canManageAccess,
        allowedTeamIds: access.allowedTeamIds,
      },
      teams: visibleTeams,
      sharedPlayers: access.sharedKit
        ? surpriseSharedPlayers(allTeams)
        : [],
      states: states.map((item) => ({
        ...item,
        team: item.teamId
          ? teamMap.get(Number(item.teamId)) || null
          : null,
      })),
      pendingTasks,
      pendingMatchTotal,
      history: history.map(enrich),
      members,
      accessMappings,
    });
  } catch (error) {
    console.error("Unable to load team-kit overview:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load team-kit overview.",
      },
      { status: 500 }
    );
  }
}
