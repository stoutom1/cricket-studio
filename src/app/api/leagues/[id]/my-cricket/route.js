import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superAdmin";
import {
  buildPlayerPerformanceCenter,
} from "@/lib/player-performance-center";

export const runtime = "nodejs";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function playerMatchesIdentity(row, linkedIds, linkedNames) {
  const id = Number(row?.playerId);

  return (
    (Number.isInteger(id) && linkedIds.has(id)) ||
    linkedNames.has(normalize(row?.playerName))
  );
}

function findPlayerRow(rows, linkedIds, linkedNames) {
  return (
    (rows || []).find((row) =>
      playerMatchesIdentity(row, linkedIds, linkedNames)
    ) || null
  );
}

function rankFor(rows, linkedIds, linkedNames) {
  const row = findPlayerRow(rows, linkedIds, linkedNames);

  if (!row) return null;

  return {
    rank: row.rank,
    movement: row.movement,
    isNew: row.isNew,
    careerBestRank: row.careerBestRank,
    points: row.points,
  };
}

async function getPlayerColumns() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Player'`
  );

  return new Set(
    rows.map((row) => String(row.column_name))
  );
}

async function linkedPlayersForUser({
  user,
  leagueId,
}) {
  const columns = await getPlayerColumns();
  const clauses = [];
  const values = [];
  let parameter = 2;

  /*
   * userId is authoritative whenever it exists. Player.email can also be a
   * contact field, so using both with OR would allow an old contact email to
   * keep a profile linked after an owner intentionally relinks/unlinks userId.
   * Email is therefore only the legacy fallback when Player.userId does not
   * exist in the deployed schema.
   */
  if (columns.has("userId")) {
    clauses.push(`p."userId" = $${parameter}`);
    values.push(user.id);
    parameter += 1;
  } else if (columns.has("email") && user.email) {
    clauses.push(
      `LOWER(TRIM(p."email")) = LOWER(TRIM($${parameter}))`
    );
    values.push(user.email);
    parameter += 1;
  }

  if (!clauses.length) {
    return [];
  }

  return prisma.$queryRawUnsafe(
    `SELECT
       p."id",
       p."name",
       p."teamId",
       t."name" AS "teamName"
     FROM "Player" p
     JOIN "Team" t ON t."id" = p."teamId"
     WHERE t."leagueId" = $1
       AND (${clauses.join(" OR ")})
     ORDER BY p."id" ASC`,
    Number(leagueId),
    ...values
  );
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const leagueId = Number(id);

    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      return NextResponse.json(
        { error: "Invalid league id" },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const league = await prisma.league.findUnique({
      where: {
        id: leagueId,
      },
      include: {
        teams: {
          include: {
            players: true,
          },
        },
      },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    const membership = await prisma.leagueMember.findFirst({
      where: {
        leagueId,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!membership && !isSuperAdmin(session)) {
      return NextResponse.json(
        { error: "You do not have access to this league" },
        { status: 403 }
      );
    }

    const linkedPlayers = await linkedPlayersForUser({
      user,
      leagueId,
    });

    if (!linkedPlayers.length) {
      return NextResponse.json({
        linked: false,
        leagueId,
        playerName: user.name || "",
        teamNames: [],
      });
    }

    const linkedIds = new Set(
      linkedPlayers
        .map((player) => Number(player.id))
        .filter(
          (id) => Number.isInteger(id) && id > 0
        )
    );

    const linkedNames = new Set(
      linkedPlayers
        .map((player) => normalize(player.name))
        .filter(Boolean)
    );

    const matches = await prisma.match.findMany({
      where: {
        leagueId,
        status: {
          in: [
            "COMPLETED",
            "COMPLETED_LOCKED",
            "COMPLETED_CORRECTED",
          ],
        },
      },
      include: {
        teamA: {
          include: {
            players: true,
          },
        },
        teamB: {
          include: {
            players: true,
          },
        },
        balls: true,
        wicketKeeperChanges: true,
      },
      orderBy: [
        {
          createdAt: "asc",
        },
        {
          id: "asc",
        },
      ],
    });

    const center = buildPlayerPerformanceCenter(
      matches,
      league
    );

    const progressRow =
      findPlayerRow(
        center.progress,
        linkedIds,
        linkedNames
      ) || {};

    const formRow =
      findPlayerRow(
        center.form,
        linkedIds,
        linkedNames
      ) || {};

    const achievementRow =
      findPlayerRow(
        center.achievements,
        linkedIds,
        linkedNames
      );

    const streaks = (center.streaks || []).filter(
      (row) =>
        playerMatchesIdentity(
          row,
          linkedIds,
          linkedNames
        )
    );

    const selectedTeamOfWeek =
      (center.teamOfWeek?.lineup || []).find(
        (row) =>
          playerMatchesIdentity(
            row,
            linkedIds,
            linkedNames
          )
      ) || null;

    const linkedTeamIds = new Set(
      linkedPlayers.map((player) =>
        Number(player.teamId)
      )
    );

    const now = new Date();

    const upcoming = await prisma.match.findMany({
      where: {
        leagueId,
        status: "SCHEDULED",
        OR: [
          {
            teamAId: {
              in: [...linkedTeamIds],
            },
          },
          {
            teamBId: {
              in: [...linkedTeamIds],
            },
          },
        ],
      },
      include: {
        teamA: true,
        teamB: true,
      },
      orderBy: [
        {
          scheduledAt: "asc",
        },
        {
          id: "asc",
        },
      ],
      take: 10,
    });

    const nextMatch =
      upcoming.find((match) => {
        const value =
          match.scheduledAt ||
          match.matchDate ||
          match.createdAt;

        const date = value
          ? new Date(value)
          : null;

        return (
          !date ||
          Number.isNaN(date.getTime()) ||
          date >= now
        );
      }) || upcoming[0] || null;

    let nextMatchPayload = null;

    if (nextMatch) {
      const playerTeamId =
        [...linkedTeamIds].find(
          (teamId) =>
            Number(teamId) === Number(nextMatch.teamAId) ||
            Number(teamId) === Number(nextMatch.teamBId)
        ) || null;

      const opponent =
        Number(nextMatch.teamAId) === Number(playerTeamId)
          ? nextMatch.teamB
          : nextMatch.teamA;

      const scheduledValue =
        nextMatch.scheduledAt ||
        nextMatch.matchDate ||
        nextMatch.createdAt ||
        null;

      nextMatchPayload = {
        id: nextMatch.id,
        teamAName: nextMatch.teamA?.name || "Team A",
        teamBName: nextMatch.teamB?.name || "Team B",
        opponentName: opponent?.name || "",
        venue:
          nextMatch.venue ||
          nextMatch.location ||
          "",
        /*
         * Do not format this timestamp in the API/server runtime.
         * Vercel/server timezone can differ from the user's browser timezone.
         * The client formats this ISO timestamp for display.
         */
        scheduledAt:
          scheduledValue
            ? new Date(scheduledValue).toISOString()
            : null,
      };
    }

    const nearest = progressRow?.nearest
      ? {
          ...progressRow.nearest,
          label:
            progressRow.nearest.metric === "fielding"
              ? "Fielding"
              : progressRow.nearest.metric === "matches"
                ? "Appearances"
                : progressRow.nearest.metric === "wickets"
                  ? "Wickets"
                  : "Runs",
        }
      : null;

    return NextResponse.json({
      linked: true,
      leagueId,
      playerIds: [...linkedIds],
      playerName:
        progressRow.playerName ||
        formRow.playerName ||
        linkedPlayers[0]?.name ||
        user.name ||
        "Player",
      teamNames: [
        ...new Set(
          linkedPlayers
            .map((player) => player.teamName)
            .filter(Boolean)
        ),
      ],
      career: {
        runs: Number(progressRow.runs || 0),
        wickets: Number(progressRow.wickets || 0),
        fielding: Number(progressRow.fielding || 0),
        matches: Number(progressRow.matches || 0),
        strikeRate: progressRow.strikeRate || 0,
        economy: progressRow.economy || 0,
      },
      rankings: {
        overall: rankFor(
          center.rankings?.overall,
          linkedIds,
          linkedNames
        ),
        batting: rankFor(
          center.rankings?.batting,
          linkedIds,
          linkedNames
        ),
        bowling: rankFor(
          center.rankings?.bowling,
          linkedIds,
          linkedNames
        ),
        fielding: rankFor(
          center.rankings?.fielding,
          linkedIds,
          linkedNames
        ),
      },
      form: {
        formScore: Number(formRow.formScore || 0),
        trend: formRow.trend || "",
        lastFiveRuns: Number(formRow.lastFiveRuns || 0),
        lastFiveWickets: Number(
          formRow.lastFiveWickets || 0
        ),
        lastFive: (formRow.lastFive || []).map(
          (row) => ({
            matchId: row.matchId,
            runs: Number(row.runs || 0),
            wickets: Number(row.wickets || 0),
            fieldingTotal: Number(
              row.fieldingTotal || 0
            ),
            impact: Number(row.impact || 0),
          })
        ),
      },
      streaks,
      achievements:
        achievementRow?.badges || [],
      progress: {
        nearest,
        metrics: progressRow.metrics || [],
      },
      teamOfWeek: {
        selected: Boolean(selectedTeamOfWeek),
        windowLabel:
          center.teamOfWeek?.windowLabel || "",
        captain:
          Boolean(selectedTeamOfWeek?.captain),
        wicketkeeper:
          Boolean(selectedTeamOfWeek?.wicketkeeper),
      },
      nextMatch: nextMatchPayload,
    });
  } catch (error) {
    console.error("Your Cricket failed:", error);

    return NextResponse.json(
      {
        error: "Failed to load Your Cricket",
      },
      {
        status: 500,
      }
    );
  }
}
