import { randomInt } from "node:crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  assertTeamKitTables,
  resolveTeamKitAccess,
  SHARED_SCOPE_KEY,
  teamScopeKey,
} from "@/lib/kit/team-custody";

export const runtime = "nodejs";

function positiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

function cleanName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 160);
}

function nameKey(value) {
  return cleanName(value).toLowerCase();
}

export async function POST(request, { params }) {
  try {
    const session =
      await getServerSession(authOptions);
    const { id } = await params;
    const leagueId = positiveId(id);

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

    if (!access.canRecord) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to create kit suggestions.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const teamId = access.sharedKit
      ? null
      : positiveId(body.teamId);
    const matchId = positiveId(body.matchId);
    const requestedNames = Array.isArray(
      body.eligibleNames
    )
      ? body.eligibleNames
      : [];

    if (
      !access.sharedKit &&
      (!teamId ||
        (!access.isOwner &&
          !access.isLeagueWideAdmin &&
          !access.allowedTeamIds.includes(teamId)))
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot create a suggestion for this team.",
        },
        { status: 403 }
      );
    }

    const scopeKey = access.sharedKit
      ? SHARED_SCOPE_KEY
      : teamScopeKey(teamId);

    const uniqueNames = [];
    const seen = new Set();

    for (const value of requestedNames) {
      const name = cleanName(value);
      const key = nameKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      uniqueNames.push(name);
    }

    if (!uniqueNames.length) {
      return NextResponse.json(
        {
          error:
            "Select at least one eligible player before asking for a suggestion.",
        },
        { status: 400 }
      );
    }

    const history = await prisma.$queryRaw`
      SELECT *
      FROM "TeamKitCustodyEvent"
      WHERE "leagueId" = ${leagueId}
        AND "scopeKey" = ${scopeKey}
      ORDER BY "createdAt" DESC
    `;

    const stateRows = await prisma.$queryRaw`
      SELECT *
      FROM "TeamKitState"
      WHERE "leagueId" = ${leagueId}
        AND "scopeKey" = ${scopeKey}
      LIMIT 1
    `;

    const currentHolderKey = nameKey(
      stateRows[0]?.currentHolderName || ""
    );

    const counts = new Map();

    for (const name of uniqueNames) {
      counts.set(nameKey(name), {
        name,
        completedTurns: 0,
        lastCompletedAt: null,
      });
    }

    for (const event of history) {
      if (
        !["RECORDED", "CORRECTED"].includes(
          String(event.action || "").toUpperCase()
        ) ||
        !event.holderName
      ) {
        continue;
      }

      const key = nameKey(event.holderName);
      const item = counts.get(key);
      if (!item) continue;

      item.completedTurns += 1;
      if (
        !item.lastCompletedAt ||
        new Date(event.createdAt) >
          new Date(item.lastCompletedAt)
      ) {
        item.lastCompletedAt = event.createdAt;
      }
    }

    const fairnessSorted = [
      ...counts.values(),
    ].sort((a, b) => {
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

      return aTime - bTime;
    });

    const nonCurrent =
      fairnessSorted.filter(
        (item) =>
          nameKey(item.name) !==
          currentHolderKey
      );

    const eligiblePool =
      nonCurrent.length
        ? nonCurrent
        : fairnessSorted;

    const minimumTurns =
      eligiblePool[0]?.completedTurns;

    /*
     * Fair first, random second:
     * Only players with the lowest completed-turn count enter
     * the random draw. Alphabetical order never decides the carrier.
     */
    const fairestCandidates =
      eligiblePool.filter(
        (item) =>
          item.completedTurns ===
          minimumTurns
      );

    const selected =
      fairestCandidates.length
        ? fairestCandidates[
            randomInt(
              fairestCandidates.length
            )
          ]
        : null;

    /*
     * Randomize players inside equal-turn groups for display too.
     * Completed-turn groups themselves remain ordered from fairest
     * to least fair.
     */
    const grouped = new Map();

    for (const item of fairnessSorted) {
      const key = item.completedTurns;

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }

      grouped.get(key).push(item);
    }

    const ranked = [];

    for (const turns of [
      ...grouped.keys(),
    ].sort((a, b) => a - b)) {
      const group = [
        ...grouped.get(turns),
      ];

      for (
        let index = group.length - 1;
        index > 0;
        index -= 1
      ) {
        const swapIndex =
          randomInt(index + 1);

        [
          group[index],
          group[swapIndex],
        ] = [
          group[swapIndex],
          group[index],
        ];
      }

      ranked.push(...group);
    }

    if (!selected) {
      return NextResponse.json(
        {
          error:
            "No eligible player could be suggested.",
        },
        { status: 400 }
      );
    }

    const selectedPlayer =
      await prisma.player.findFirst({
        where: {
          name: {
            equals:
              selected.name,
            mode:
              "insensitive",
          },
          team: {
            leagueId,
          },
          ...(teamId
            ? {
                teamId,
              }
            : {}),
        },
        select: {
          id: true,
        },
      });

    const rows = await prisma.$queryRaw`
      INSERT INTO "TeamKitCustodyEvent"
        (
          "leagueId",
          "scopeKey",
          "teamId",
          "matchId",
          "holderPlayerId",
          "holderName",
          "action",
          "note",
          "recordedByUserId"
        )
      VALUES
        (
          ${leagueId},
          ${scopeKey},
          ${teamId},
          ${matchId},
          ${selectedPlayer?.id || null},
          ${selected.name},
          'SUGGESTED',
          ${`Fair suggestion from ${uniqueNames.length} eligible player(s). Completed turns: ${selected.completedTurns}.`},
          ${access.user.id}
        )
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      message: `${selected.name} is the next fair kit-carrier suggestion.`,
      suggestion: {
        ...rows[0],
        completedTurns:
          selected.completedTurns,
        lastCompletedAt:
          selected.lastCompletedAt,
        eligibleCount:
          uniqueNames.length,
        fairCandidateCount:
          fairestCandidates.length,
        selectionMethod:
          "RANDOM_AMONG_LOWEST_TURNS",
      },
      ranked,
    });
  } catch (error) {
    console.error(
      "Unable to suggest a kit carrier:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to suggest a kit carrier.",
      },
      { status: 500 }
    );
  }
}
