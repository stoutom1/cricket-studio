import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  assertTeamKitTables,
  ensureLeagueKitTrackingStarted,
  resolveTeamKitAccess,
  SHARED_SCOPE_KEY,
} from "@/lib/kit/team-custody";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECORDED_ACTIONS = [
  "RECORDED",
  "CORRECTED",
  "RECORDED_AS_SUGGESTED",
];

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

function cleanPlayerName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function playerNameKey(value) {
  return cleanPlayerName(value).toLowerCase();
}

function surpriseSharedPlayers(teams) {
  const surpriseTeams = teams.filter((team) => {
    const key = normalizeTeamName(team.name);

    return (
      key === "surprise1" ||
      key === "surprise2"
    );
  });

  const sourceTeams = surpriseTeams.length
    ? surpriseTeams
    : teams;

  const seen = new Set();
  const result = [];

  for (const team of sourceTeams) {
    for (const player of team.players || []) {
      const displayName = cleanPlayerName(
        player.name
      );
      const key = playerNameKey(displayName);

      if (!key || seen.has(key)) {
        continue;
      }

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

  return date &&
    !Number.isNaN(date.getTime())
    ? date
    : null;
}

function consolidatePendingTasks(tasks) {
  const grouped = new Map();

  for (const task of tasks) {
    const existing =
      grouped.get(task.scopeKey);

    const taskDate =
      matchReferenceDate(task.match) ||
      new Date(task.createdAt || 0);

    const existingDate = existing
      ? matchReferenceDate(existing.match) ||
        new Date(existing.createdAt || 0)
      : null;

    if (
      !existing ||
      taskDate > existingDate
    ) {
      grouped.set(task.scopeKey, {
        ...task,
        pendingMatchCount:
          (existing?.pendingMatchCount || 0) +
          1,
      });
    } else {
      existing.pendingMatchCount =
        (existing.pendingMatchCount || 1) +
        1;
    }
  }

  return [...grouped.values()].sort(
    (a, b) => {
      const aDate =
        matchReferenceDate(
          a.match
        )?.getTime() || 0;
      const bDate =
        matchReferenceDate(
          b.match
        )?.getTime() || 0;

      return bDate - aDate;
    }
  );
}


const NON_UPCOMING_MATCH_STATUSES = new Set([
  "COMPLETED",
  "COMPLETED_LOCKED",
  "COMPLETED_CORRECTED",
  "ABANDONED",
  "NO_RESULT",
  "CANCELLED",
  "CANCELED",
  "CANCELLED_AFTER_START",
  "CANCELED_AFTER_START",
  "POSTPONED",
  "DELETED",
]);

function normalizedMatchStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function uniquePlayers(players) {
  const seen = new Set();
  const result = [];

  for (const player of players || []) {
    const name = cleanPlayerName(
      player.displayName ||
        player.name
    );
    const key = playerNameKey(name);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);

    result.push({
      id:
        player.playerId ||
        player.id ||
        null,
      name,
      teamId:
        player.teamId || null,
      teamName:
        player.team?.name ||
        player.teamName ||
        "",
      source:
        player.displayName
          ? "MATCH_ROSTER"
          : "TEAM_ROSTER",
    });
  }

  return result.sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

async function findUpcomingKitMatch({
  leagueId,
  allowedTeamIds,
  sharedKit,
}) {
  const candidateMatches =
    await prisma.match.findMany({
      where: {
        leagueId,
      },
      orderBy: [
        {
          scheduledAt: "asc",
        },
        {
          id: "desc",
        },
      ],
      take: 100,
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        startedAt: true,
        teamAId: true,
        teamBId: true,
        teamA: {
          select: {
            id: true,
            name: true,
            players: {
              orderBy: {
                name: "asc",
              },
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        teamB: {
          select: {
            id: true,
            name: true,
            players: {
              orderBy: {
                name: "asc",
              },
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

  const visibleCandidates =
    candidateMatches.filter((match) => {
      const status =
        normalizedMatchStatus(
          match.status
        );

      if (
        NON_UPCOMING_MATCH_STATUSES.has(
          status
        )
      ) {
        return false;
      }

      if (sharedKit) {
        return true;
      }

      return (
        allowedTeamIds.includes(
          match.teamAId
        ) ||
        allowedTeamIds.includes(
          match.teamBId
        )
      );
    });

  const now = Date.now();

  visibleCandidates.sort((a, b) => {
    const aStatus =
      normalizedMatchStatus(a.status);
    const bStatus =
      normalizedMatchStatus(b.status);

    const statusRank = (status) => {
      if (
        [
          "SCHEDULED",
          "CREATED",
          "UPCOMING",
        ].includes(status)
      ) {
        return 0;
      }

      if (
        [
          "ACTIVE",
          "IN_PROGRESS",
          "STARTED",
          "LIVE",
        ].includes(status)
      ) {
        return 1;
      }

      return 2;
    };

    const rankDifference =
      statusRank(aStatus) -
      statusRank(bStatus);

    if (rankDifference !== 0) {
      return rankDifference;
    }

    const aTime = a.scheduledAt
      ? new Date(
          a.scheduledAt
        ).getTime()
      : Number.MAX_SAFE_INTEGER;

    const bTime = b.scheduledAt
      ? new Date(
          b.scheduledAt
        ).getTime()
      : Number.MAX_SAFE_INTEGER;

    const aIsFuture =
      aTime >= now - 12 * 60 * 60 * 1000;
    const bIsFuture =
      bTime >= now - 12 * 60 * 60 * 1000;

    if (aIsFuture !== bIsFuture) {
      return aIsFuture ? -1 : 1;
    }

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    return b.id - a.id;
  });

  const match =
    visibleCandidates[0] || null;

  if (!match) {
    return null;
  }

  const savedPlayers =
    await prisma.matchKitPlayer.findMany({
      where: {
        matchId: match.id,
        isConfirmed: true,
        isEligible: true,
      },
      orderBy: [
        {
          teamId: "asc",
        },
        {
          sortOrder: "asc",
        },
        {
          displayName: "asc",
        },
      ],
      select: {
        id: true,
        playerId: true,
        teamId: true,
        displayName: true,
        normalizedName: true,
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

  const savedByTeam = new Map();

  for (const player of savedPlayers) {
    if (!savedByTeam.has(player.teamId)) {
      savedByTeam.set(
        player.teamId,
        []
      );
    }

    savedByTeam
      .get(player.teamId)
      .push(player);
  }

  const fallbackTeamPlayers = (team) =>
    (team?.players || []).map(
      (player) => ({
        ...player,
        teamId: team.id,
        teamName: team.name,
      })
    );

  const teamAPlayers = uniquePlayers(
    savedByTeam.get(match.teamAId)
      ?.length
      ? savedByTeam.get(
          match.teamAId
        )
      : fallbackTeamPlayers(
          match.teamA
        )
  );

  const teamBPlayers = uniquePlayers(
    savedByTeam.get(match.teamBId)
      ?.length
      ? savedByTeam.get(
          match.teamBId
        )
      : fallbackTeamPlayers(
          match.teamB
        )
  );

  const eligiblePlayers = sharedKit
    ? uniquePlayers([
        ...teamAPlayers,
        ...teamBPlayers,
      ])
    : uniquePlayers([
        ...(allowedTeamIds.includes(
          match.teamAId
        )
          ? teamAPlayers
          : []),
        ...(allowedTeamIds.includes(
          match.teamBId
        )
          ? teamBPlayers
          : []),
      ]);

  return {
    id: match.id,
    status: match.status,
    scheduledAt:
      match.scheduledAt,
    startedAt: match.startedAt,
    teamAId: match.teamAId,
    teamBId: match.teamBId,
    teamA: {
      id: match.teamA.id,
      name: match.teamA.name,
    },
    teamB: {
      id: match.teamB.id,
      name: match.teamB.name,
    },
    label: `${match.teamA.name} vs ${match.teamB.name}`,
    savedPlayingRoster:
      savedPlayers.length > 0,
    eligiblePlayers,
    eligiblePlayersByTeam: {
      [match.teamAId]:
        teamAPlayers,
      [match.teamBId]:
        teamBPlayers,
    },
  };
}

function buildRotationSummary({
  players,
  aggregateRows,
  scopeKey,
  currentHolderName,
}) {
  const stats = new Map();

  for (const player of players) {
    const key = playerNameKey(player.name);

    if (!key || stats.has(key)) {
      continue;
    }

    stats.set(key, {
      ...player,
      completedTurns: 0,
      lastCompletedAt: null,
    });
  }

  for (const row of aggregateRows) {
    if (row.scopeKey !== scopeKey) {
      continue;
    }

    const key = playerNameKey(row.holderName);

    if (!key) {
      continue;
    }

    const existing =
      stats.get(key) || {
        id: null,
        name: cleanPlayerName(
          row.holderName
        ),
        teamId: row.teamId
          ? Number(row.teamId)
          : null,
        teamName: null,
        completedTurns: 0,
        lastCompletedAt: null,
      };

    existing.completedTurns =
      Number(row.completedTurns || 0);
    existing.lastCompletedAt =
      row.lastCompletedAt || null;

    stats.set(key, existing);
  }

  const currentKey = playerNameKey(
    currentHolderName
  );

  return [...stats.values()]
    .map((item) => ({
      ...item,
      isCurrentHolder:
        playerNameKey(item.name) ===
        currentKey,
    }))
    .sort((a, b) => {
      if (
        a.completedTurns !==
        b.completedTurns
      ) {
        return (
          a.completedTurns -
          b.completedTurns
        );
      }

      const aTime = a.lastCompletedAt
        ? new Date(
            a.lastCompletedAt
          ).getTime()
        : 0;
      const bTime = b.lastCompletedAt
        ? new Date(
            b.lastCompletedAt
          ).getTime()
        : 0;

      if (aTime !== bTime) {
        return aTime - bTime;
      }

      return a.name.localeCompare(b.name);
    });
}

export async function GET(
  request,
  { params }
) {
  try {
    const session =
      await getServerSession(authOptions);
    const { id } = await params;
    const leagueId = numberId(id);

    if (!leagueId) {
      return NextResponse.json(
        {
          error:
            "Invalid league id.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * These checks are cached in-process after the first successful call.
     * Initializing tracking is a one-row lookup after the first league load.
     * The expensive historical match scan is intentionally NOT performed here.
     */
    await Promise.all([
      assertTeamKitTables(),
      ensureLeagueKitTrackingStarted(
        leagueId
      ),
    ]);

    const access =
      await resolveTeamKitAccess({
        session,
        leagueId,
      });

    if (!access.authorized) {
      return NextResponse.json(
        {
          error: access.error,
        },
        {
          status: access.status,
        }
      );
    }

    const allTeams =
      await prisma.team.findMany({
        where: {
          leagueId,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          players: {
            orderBy: {
              name: "asc",
            },
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    const visibleTeams =
      access.sharedKit
        ? allTeams
        : allTeams.filter((team) =>
            access.allowedTeamIds.includes(
              team.id
            )
          );

    const allowedScopeKeys =
      access.sharedKit
        ? [SHARED_SCOPE_KEY]
        : visibleTeams.map(
            (team) =>
              `TEAM:${team.id}`
          );

    if (
      !access.sharedKit &&
      !visibleTeams.length
    ) {
      return NextResponse.json({
        success: true,
        league: {
          ...access.league,
          sharedKit: false,
        },
        access: {
          isOwner:
            access.isOwner,
          canRecord: false,
          canManageAccess:
            access.canManageAccess,
          allowedTeamIds: [],
        },
        teams: [],
        sharedPlayers: [],
        states: [],
        pendingTasks: [],
        pendingMatchTotal: 0,
        history: [],
        upcomingMatch: null,
        latestSuggestions: {},
        rotationByScope: {},
        members: [],
        accessMappings: [],
        emptyReason:
          "Your account is not linked to a team for kit visibility. Ask the league owner to assign your team access.",
      });
    }

    const scopeSql = Prisma.join(
      allowedScopeKeys.map(
        (scopeKey) =>
          Prisma.sql`${scopeKey}`
      )
    );

    const teamMap = new Map(
      allTeams.map((team) => [
        team.id,
        team,
      ])
    );

    const ownerAccessPromise =
      access.canManageAccess
        ? Promise.all([
            prisma.$queryRaw`
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
              JOIN "User" u
                ON u."id"::TEXT =
                   lm."userId"::TEXT
              WHERE lm."leagueId" =
                    ${leagueId}
              ORDER BY
                COALESCE(
                  u."name",
                  u."email"
                ) ASC
            `,
            prisma.$queryRaw`
              SELECT *
              FROM "TeamKitUserAccess"
              WHERE "leagueId" =
                    ${leagueId}
              ORDER BY
                "userId",
                "teamId"
            `,
          ])
        : Promise.resolve([
            [],
            [],
          ]);

    /*
     * All independent reads run concurrently.
     * Recent history is limited for the initial page.
     * Rotation counts are calculated by PostgreSQL instead of loading
     * the entire audit history into Node.js.
     */
    const [
      states,
      pendingTaskRows,
      recentHistory,
      upcomingMatch,
      latestSuggestionRows,
      rotationAggregateRows,
      ownerAccess,
    ] = await Promise.all([
      prisma.$queryRaw`
        SELECT *
        FROM "TeamKitState"
        WHERE "leagueId" =
              ${leagueId}
          AND "scopeKey" IN (
            ${scopeSql}
          )
        ORDER BY "updatedAt" DESC
      `,

      prisma.$queryRaw`
        SELECT
          task.*,
          m."status" AS "matchStatus",
          m."scheduledAt",
          m."endedAt",
          m."lockedAt",
          ta."id" AS "teamAId",
          ta."name" AS "teamAName",
          tb."id" AS "teamBId",
          tb."name" AS "teamBName"
        FROM "TeamKitCustodyTask" task
        JOIN "Match" m
          ON m."id" = task."matchId"
        LEFT JOIN "Team" ta
          ON ta."id" = m."teamAId"
        LEFT JOIN "Team" tb
          ON tb."id" = m."teamBId"
        WHERE task."leagueId" =
              ${leagueId}
          AND task."status" =
              'PENDING'
          AND task."scopeKey" IN (
            ${scopeSql}
          )
        ORDER BY
          COALESCE(
            m."lockedAt",
            m."endedAt",
            m."scheduledAt",
            task."createdAt"
          ) DESC
      `,

      prisma.$queryRaw`
        SELECT
          e.*,
          u."name" AS
            "recordedByName",
          u."email" AS
            "recordedByEmail",
          m."status" AS
            "matchStatus",
          m."scheduledAt",
          m."endedAt",
          m."lockedAt",
          ta."id" AS "teamAId",
          ta."name" AS
            "teamAName",
          tb."id" AS "teamBId",
          tb."name" AS
            "teamBName"
        FROM "TeamKitCustodyEvent" e
        LEFT JOIN "User" u
          ON u."id"::TEXT =
             e."recordedByUserId"::TEXT
        LEFT JOIN "Match" m
          ON m."id" = e."matchId"
        LEFT JOIN "Team" ta
          ON ta."id" = m."teamAId"
        LEFT JOIN "Team" tb
          ON tb."id" = m."teamBId"
        WHERE e."leagueId" =
              ${leagueId}
          AND e."scopeKey" IN (
            ${scopeSql}
          )
          AND e."action" <>
              'TRACKING_STARTED'
        ORDER BY
          e."createdAt" DESC
        LIMIT 40
      `,

      findUpcomingKitMatch({
        leagueId,
        allowedTeamIds:
          access.allowedTeamIds,
        sharedKit:
          access.sharedKit,
      }),

      prisma.$queryRaw`
        SELECT DISTINCT ON (
          e."scopeKey"
        )
          e.*
        FROM "TeamKitCustodyEvent" e
        WHERE e."leagueId" =
              ${leagueId}
          AND e."scopeKey" IN (
            ${scopeSql}
          )
          AND e."action" =
              'SUGGESTED'
        ORDER BY
          e."scopeKey",
          e."createdAt" DESC
      `,

      prisma.$queryRaw`
        SELECT
          e."scopeKey",
          e."teamId",
          e."holderName",
          COUNT(*)::INTEGER AS
            "completedTurns",
          MAX(e."createdAt") AS
            "lastCompletedAt"
        FROM "TeamKitCustodyEvent" e
        WHERE e."leagueId" =
              ${leagueId}
          AND e."scopeKey" IN (
            ${scopeSql}
          )
          AND e."action" IN (
            'RECORDED',
            'CORRECTED',
            'RECORDED_AS_SUGGESTED'
          )
          AND e."holderName"
              IS NOT NULL
        GROUP BY
          e."scopeKey",
          e."teamId",
          e."holderName"
      `,

      ownerAccessPromise,
    ]);

    const [members, accessMappings] =
      ownerAccess;

    const enrichMatch = (row) => {
      const hasMatch =
        row.matchId &&
        (
          row.teamAName ||
          row.teamBName ||
          row.scheduledAt ||
          row.endedAt ||
          row.lockedAt
        );

      return {
        ...row,
        team: row.teamId
          ? teamMap.get(
              Number(row.teamId)
            ) || null
          : null,
        match: hasMatch
          ? {
              id: Number(row.matchId),
              status:
                row.matchStatus || null,
              scheduledAt:
                row.scheduledAt || null,
              endedAt:
                row.endedAt || null,
              lockedAt:
                row.lockedAt || null,
              teamA: row.teamAId
                ? {
                    id: Number(
                      row.teamAId
                    ),
                    name:
                      row.teamAName ||
                      "Team A",
                  }
                : null,
              teamB: row.teamBId
                ? {
                    id: Number(
                      row.teamBId
                    ),
                    name:
                      row.teamBName ||
                      "Team B",
                  }
                : null,
              label: `${
                row.teamAName ||
                "Team A"
              } vs ${
                row.teamBName ||
                "Team B"
              }`,
            }
          : null,
      };
    };

    const enrichedPendingTasks =
      pendingTaskRows.map(
        enrichMatch
      );

    const consolidatedPendingTasks =
      consolidatePendingTasks(
        enrichedPendingTasks
      );

    const enrichedSuggestionRows =
      latestSuggestionRows.map(
        enrichMatch
      );

    const latestSuggestions =
      Object.fromEntries(
        enrichedSuggestionRows.map(
          (row) => [
            row.scopeKey,
            row,
          ]
        )
      );

    /*
     * Preserve the suggestion after the scheduled match becomes final.
     * Prefer a suggestion created for the exact completed match; otherwise
     * fall back to the latest suggestion for that team/shared-kit scope.
     */
    const pendingTasks =
      consolidatedPendingTasks.map(
        (task) => {
          const exactSuggestion =
            enrichedSuggestionRows.find(
              (item) =>
                item.scopeKey ===
                  task.scopeKey &&
                Number(item.matchId) ===
                  Number(task.matchId)
            );

          return {
            ...task,
            suggestion:
              exactSuggestion ||
              latestSuggestions[
                task.scopeKey
              ] ||
              null,
          };
        }
      );

    const sharedPlayers =
      access.sharedKit
        ? surpriseSharedPlayers(
            allTeams
          )
        : [];

    const rotationByScope = {};

    for (const scopeKey of allowedScopeKeys) {
      const state = states.find(
        (item) =>
          item.scopeKey ===
          scopeKey
      );

      const teamId = Number(
        String(scopeKey).replace(
          "TEAM:",
          ""
        )
      );

      const players =
        access.sharedKit
          ? sharedPlayers
          : (
              teamMap.get(
                teamId
              )?.players || []
            ).map((player) => ({
              ...player,
              teamId,
              teamName:
                teamMap.get(
                  teamId
                )?.name || "",
            }));

      rotationByScope[scopeKey] =
        buildRotationSummary({
          players,
          aggregateRows:
            rotationAggregateRows,
          scopeKey,
          currentHolderName:
            state?.currentHolderName ||
            "",
        });
    }

    return NextResponse.json({
      success: true,
      league: {
        ...access.league,
        sharedKit:
          access.sharedKit,
      },
      access: {
        isOwner:
          access.isOwner,
        canRecord:
          access.canRecord,
        canManageAccess:
          access.canManageAccess,
        allowedTeamIds:
          access.allowedTeamIds,
      },
      teams: visibleTeams,
      sharedPlayers,
      states: states.map(
        (item) => ({
          ...item,
          team: item.teamId
            ? teamMap.get(
                Number(
                  item.teamId
                )
              ) || null
            : null,
        })
      ),
      pendingTasks,
      pendingMatchTotal:
        enrichedPendingTasks.length,
      history:
        recentHistory.map(
          enrichMatch
        ),
      upcomingMatch:
        upcomingMatch || null,
      latestSuggestions,
      rotationByScope,
      members,
      accessMappings,
    });
  } catch (error) {
    console.error(
      "Unable to load team-kit overview:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load team-kit overview.",
      },
      {
        status: 500,
      }
    );
  }
}
