import prisma from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";

export const KIT_CLOSED_MATCH_STATUSES = new Set([
  "COMPLETED",
  "COMPLETED_LOCKED",
  "COMPLETED_CORRECTED",
  "ABANDONED",
  "NO_RESULT",
  "CANCELLED_AFTER_START",
  "CANCELED_AFTER_START",
]);

export const SHARED_SCOPE_KEY = "LEAGUE";
export const TRACKING_SCOPE_KEY = "SYSTEM:TRACKING";
export const TRACKING_STARTED_ACTION = "TRACKING_STARTED";

const ACTIVATION_TOLERANCE_MS = 5 * 60 * 1000;

export function normalizeKitStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export function isKitClosedMatchStatus(value) {
  return KIT_CLOSED_MATCH_STATUSES.has(
    normalizeKitStatus(value)
  );
}

export function isSharedKitLeague(league) {
  const mode = normalizeKitStatus(
    league?.kitRotationMode
  );
  const name = String(league?.name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  return (
    mode === "LEAGUE_PLAYER" ||
    name === "surprise cricket league"
  );
}

export function teamScopeKey(teamId) {
  return `TEAM:${Number(teamId)}`;
}

function roleValue(member) {
  return normalizeKitStatus(
    member?.role ||
      member?.membershipRole ||
      member?.leagueRole
  );
}

export function isLeagueOwner(member) {
  return (
    roleValue(member) === "OWNER" ||
    member?.isOwner === true
  );
}

export function isLeagueWideAdmin(member) {
  return (
    isLeagueOwner(member) ||
    ["ADMIN", "LEAGUE_ADMIN"].includes(
      roleValue(member)
    ) ||
    member?.canManageMembers === true ||
    member?.canManagePermissions === true
  );
}

export function canScoreKit(member) {
  return (
    isLeagueWideAdmin(member) ||
    member?.canScoreMatch === true
  );
}

const REQUIRED_TEAM_KIT_TABLES = [
  "TeamKitState",
  "TeamKitCustodyTask",
  "TeamKitCustodyEvent",
  "TeamKitUserAccess",
];

let teamKitTableCheckPromise = null;
const columnCache = new Map();

export async function assertTeamKitTables() {
  if (!teamKitTableCheckPromise) {
    teamKitTableCheckPromise = (async () => {
      const rows = await prisma.$queryRaw`
        SELECT table_name AS "name"
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (
            'TeamKitState',
            'TeamKitCustodyTask',
            'TeamKitCustodyEvent',
            'TeamKitUserAccess'
          )
      `;

      const existing = new Set(
        rows.map((row) => row.name)
      );

      const missing =
        REQUIRED_TEAM_KIT_TABLES.filter(
          (tableName) =>
            !existing.has(tableName)
        );

      if (missing.length) {
        throw new Error(
          `Team-kit migration is not installed. Missing table${
            missing.length === 1 ? "" : "s"
          }: ${missing.join(", ")}.`
        );
      }

      return true;
    })().catch((error) => {
      teamKitTableCheckPromise = null;
      throw error;
    });
  }

  return teamKitTableCheckPromise;
}

async function getColumns(tableName) {
  if (!columnCache.has(tableName)) {
    columnCache.set(
      tableName,
      prisma.$queryRaw`
        SELECT column_name AS "name"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${tableName}
      `
        .then(
          (rows) =>
            new Set(
              rows.map((row) => row.name)
            )
        )
        .catch((error) => {
          columnCache.delete(tableName);
          throw error;
        })
    );
  }

  return columnCache.get(tableName);
}

async function inferTeamIds({
  leagueId,
  userId,
  email,
}) {
  const teamIds = new Set();

  const explicitRows = await prisma.$queryRaw`
    SELECT "teamId"
    FROM "TeamKitUserAccess"
    WHERE "leagueId" = ${leagueId}
      AND "userId" = ${userId}
      AND "canView" = TRUE
  `;

  explicitRows.forEach((row) =>
    teamIds.add(Number(row.teamId))
  );

  const leagueMemberColumns =
    await getColumns("LeagueMember");

  if (leagueMemberColumns.has("teamId")) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT "teamId" FROM "LeagueMember" WHERE "leagueId" = $1 AND "userId" = $2 AND "teamId" IS NOT NULL`,
      leagueId,
      userId
    );
    rows.forEach((row) =>
      teamIds.add(Number(row.teamId))
    );
  }

  const playerColumns = await getColumns("Player");

  if (playerColumns.has("userId")) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT p."teamId" FROM "Player" p JOIN "Team" t ON t."id" = p."teamId" WHERE t."leagueId" = $1 AND p."userId" = $2`,
      leagueId,
      userId
    );
    rows.forEach((row) =>
      teamIds.add(Number(row.teamId))
    );
  }

  if (email && playerColumns.has("email")) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT p."teamId" FROM "Player" p JOIN "Team" t ON t."id" = p."teamId" WHERE t."leagueId" = $1 AND LOWER(TRIM(p."email")) = LOWER(TRIM($2))`,
      leagueId,
      email
    );
    rows.forEach((row) =>
      teamIds.add(Number(row.teamId))
    );
  }

  return [...teamIds].filter(
    (teamId) =>
      Number.isInteger(teamId) && teamId > 0
  );
}

export async function resolveTeamKitAccess({
  session,
  leagueId,
}) {
  if (!session?.user?.email) {
    return {
      authorized: false,
      status: 401,
      error: "You must be signed in.",
    };
  }

  const league = await prisma.league.findUnique({
    where: { id: Number(leagueId) },
    select: {
      id: true,
      name: true,
      kitRotationMode: true,
    },
  });

  if (!league) {
    return {
      authorized: false,
      status: 404,
      error: "League not found.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    return {
      authorized: false,
      status: 401,
      error: "Authenticated user was not found.",
    };
  }

  const member = await getPermissions(
    user.email,
    league.id
  );

  if (!member) {
    return {
      authorized: false,
      status: 403,
      error: "You do not have access to this league.",
    };
  }

  const sharedKit = isSharedKitLeague(league);
  const owner = isLeagueOwner(member);
  const leagueWide = isLeagueWideAdmin(member);
  const canRecord = canScoreKit(member);

  let allowedTeamIds = [];

  if (owner || leagueWide) {
    const teams = await prisma.team.findMany({
      where: { leagueId: league.id },
      select: { id: true },
    });
    allowedTeamIds = teams.map((team) => team.id);
  } else if (!sharedKit) {
    allowedTeamIds = await inferTeamIds({
      leagueId: league.id,
      userId: user.id,
      email: user.email,
    });
  }

  return {
    authorized: true,
    league,
    user,
    member,
    sharedKit,
    isOwner: owner,
    isLeagueWideAdmin: leagueWide,
    canManageAccess: owner,
    canRecord,
    allowedTeamIds,
  };
}

export async function ensureLeagueKitTrackingStarted(
  leagueId
) {
  await assertTeamKitTables();

  const existing = await prisma.$queryRaw`
    SELECT "createdAt"
    FROM "TeamKitCustodyEvent"
    WHERE "leagueId" = ${Number(leagueId)}
      AND "scopeKey" = ${TRACKING_SCOPE_KEY}
      AND "action" = ${TRACKING_STARTED_ACTION}
    ORDER BY "createdAt" ASC
    LIMIT 1
  `;

  if (existing[0]?.createdAt) {
    return new Date(existing[0].createdAt);
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        ${Number(leagueId)},
        82411
      )
    `;

    const recheck = await tx.$queryRaw`
      SELECT "createdAt"
      FROM "TeamKitCustodyEvent"
      WHERE "leagueId" = ${Number(leagueId)}
        AND "scopeKey" = ${TRACKING_SCOPE_KEY}
        AND "action" = ${TRACKING_STARTED_ACTION}
      ORDER BY "createdAt" ASC
      LIMIT 1
    `;

    if (recheck[0]?.createdAt) {
      return new Date(recheck[0].createdAt);
    }

    await tx.$executeRaw`
      UPDATE "TeamKitCustodyTask"
      SET
        "status" = 'ARCHIVED',
        "resolvedAt" = NOW()
      WHERE "leagueId" = ${Number(leagueId)}
        AND "status" = 'PENDING'
    `;

    const rows = await tx.$queryRaw`
      INSERT INTO "TeamKitCustodyEvent"
        (
          "leagueId",
          "scopeKey",
          "action",
          "note"
        )
      VALUES
        (
          ${Number(leagueId)},
          ${TRACKING_SCOPE_KEY},
          ${TRACKING_STARTED_ACTION},
          'Team-based kit custody tracking started fresh.'
        )
      RETURNING "createdAt"
    `;

    return new Date(rows[0].createdAt);
  });
}

function effectiveMatchEnd(match) {
  const value =
    match?.lockedAt ||
    match?.endedAt ||
    match?.scheduledAt ||
    null;

  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date;
}

async function loadFullMatch(matchOrId) {
  const supplied =
    typeof matchOrId === "object"
      ? matchOrId
      : null;

  const suppliedHasTiming = Boolean(
    supplied?.lockedAt ||
      supplied?.endedAt ||
      supplied?.scheduledAt
  );

  if (supplied && suppliedHasTiming && supplied.league) {
    return supplied;
  }

  const matchId = Number(
    supplied?.id || matchOrId
  );

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return null;
  }

  return prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      leagueId: true,
      teamAId: true,
      teamBId: true,
      status: true,
      scheduledAt: true,
      endedAt: true,
      lockedAt: true,
      league: {
        select: {
          id: true,
          name: true,
          kitRotationMode: true,
        },
      },
    },
  });
}

export async function syncKitCustodyTasksForMatch(
  matchOrId,
  options = {}
) {
  await assertTeamKitTables();

  const match = await loadFullMatch(matchOrId);

  if (
    !match ||
    !isKitClosedMatchStatus(match.status)
  ) {
    return { created: 0 };
  }

  const trackingStartedAt =
    options.trackingStartedAt ||
    (await ensureLeagueKitTrackingStarted(
      match.leagueId
    ));

  const matchEndedAt = effectiveMatchEnd(match);
  const cutoff = new Date(
    trackingStartedAt.getTime() -
      ACTIVATION_TOLERANCE_MS
  );

  if (
    !matchEndedAt ||
    matchEndedAt < cutoff
  ) {
    return {
      created: 0,
      skippedBeforeTrackingStart: true,
    };
  }

  const league =
    match.league ||
    (await prisma.league.findUnique({
      where: { id: Number(match.leagueId) },
      select: {
        id: true,
        name: true,
        kitRotationMode: true,
      },
    }));

  if (!league) {
    return { created: 0 };
  }

  const sharedKit = isSharedKitLeague(league);
  const scopes = sharedKit
    ? [
        {
          scopeKey: SHARED_SCOPE_KEY,
          teamId: null,
        },
      ]
    : [match.teamAId, match.teamBId]
        .map(Number)
        .filter(
          (teamId) =>
            Number.isInteger(teamId) && teamId > 0
        )
        .map((teamId) => ({
          scopeKey: teamScopeKey(teamId),
          teamId,
        }));

  let created = 0;

  for (const scope of scopes) {
    const result = await prisma.$executeRaw`
      INSERT INTO "TeamKitCustodyTask"
        ("leagueId", "scopeKey", "teamId", "matchId", "status")
      VALUES
        (${league.id}, ${scope.scopeKey}, ${scope.teamId}, ${match.id}, 'PENDING')
      ON CONFLICT ("matchId", "scopeKey") DO NOTHING
    `;
    created += Number(result || 0);
  }

  return { created };
}

export async function syncLeagueKitCustodyTasks(
  leagueId
) {
  await assertTeamKitTables();

  const trackingStartedAt =
    await ensureLeagueKitTrackingStarted(
      leagueId
    );

  const matches = await prisma.match.findMany({
    where: {
      leagueId: Number(leagueId),
      status: {
        in: [...KIT_CLOSED_MATCH_STATUSES],
      },
    },
    select: {
      id: true,
      leagueId: true,
      teamAId: true,
      teamBId: true,
      status: true,
      scheduledAt: true,
      endedAt: true,
      lockedAt: true,
      league: {
        select: {
          id: true,
          name: true,
          kitRotationMode: true,
        },
      },
    },
  });

  let created = 0;
  for (const match of matches) {
    const result =
      await syncKitCustodyTasksForMatch(
        match,
        { trackingStartedAt }
      );
    created += result.created;
  }

  return {
    created,
    trackingStartedAt,
  };
}
