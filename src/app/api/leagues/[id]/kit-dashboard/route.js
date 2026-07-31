import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_ASSIGNMENT_STATUSES = [
  "SUGGESTED",
  "ASSIGNED",
  "CONFIRMED",
];

const CLOSED_MATCH_STATUSES = new Set([
  "COMPLETED",
  "COMPLETED_LOCKED",
  "COMPLETED_CORRECTED",
  "ABANDONED",
  "CANCELLED",
  "CANCELED",
]);

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function isClosedMatch(status) {
  return CLOSED_MATCH_STATUSES.has(
    normalizeStatus(status)
  );
}

function readinessFrom({
  leagueKit,
  assignment,
  match,
}) {
  if (!leagueKit) {
    return {
      level: "NOT_CONFIGURED",
      label: "League kit not configured",
      message:
        "Create or generate a shared league-kit assignment.",
    };
  }

  if (!assignment) {
    return {
      level: "NO_ASSIGNMENT",
      label: "No upcoming carrier",
      message:
        "Generate the assigned carrier for the next match.",
    };
  }

  if (
    normalizeStatus(leagueKit.status) ===
      "AT_VENUE" ||
    leagueKit.venueConfirmedAt
  ) {
    return {
      level: "READY",
      label: "Kit at venue",
      message:
        "The league kit is confirmed at the match venue.",
    };
  }

  if (
    ["COORDINATED", "HANDED_OVER"].includes(
      normalizeStatus(
        leagueKit.handoverStatus
      )
    )
  ) {
    return {
      level: "COORDINATED",
      label: "Coordination complete",
      message:
        "The holder and assigned carrier have coordinated. Venue arrival is not yet confirmed.",
    };
  }

  if (
    !leagueKit
      .currentHolderRotationMember
  ) {
    return {
      level: "HOLDER_MISSING",
      label: "Current holder missing",
      message:
        "Record who currently has the shared league kit.",
    };
  }

  const scheduledAt =
    match?.scheduledAt
      ? new Date(match.scheduledAt)
      : null;

  const hoursUntilMatch =
    scheduledAt &&
    !Number.isNaN(
      scheduledAt.getTime()
    )
      ? (scheduledAt.getTime() -
          Date.now()) /
        3600000
      : null;

  if (
    hoursUntilMatch !== null &&
    hoursUntilMatch <= 2 &&
    hoursUntilMatch > 0
  ) {
    return {
      level: "URGENT",
      label: "Action required",
      message:
        "The match begins within two hours and the kit is not confirmed at the venue.",
    };
  }

  return {
    level: "PENDING",
    label: "Awaiting coordination",
    message:
      "The assigned carrier must coordinate with the current holder.",
  };
}

export async function GET(
  request,
  {
    params,
  }
) {
  try {
    const {
      leagueId:
        leagueIdParam,
    } = await params;

    const leagueId =
      Number(leagueIdParam);

    if (
      !Number.isInteger(
        leagueId
      ) ||
      leagueId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid league id.",
        },
        {
          status:
            400,
        }
      );
    }

    const league =
      await prisma.league.findUnique({
        where: {
          id:
            leagueId,
        },

        select: {
          id:
            true,

          name:
            true,

          kitRotationMode:
            true,

          timeZone:
            true,

          leagueKit: {
            include: {
              currentHolderRotationMember:
                {
                  select: {
                    id:
                      true,

                    displayName:
                      true,

                    completedCount:
                      true,

                    lastCompletedAt:
                      true,
                  },
                },

              previousHolderRotationMember:
                {
                  select: {
                    id:
                      true,

                    displayName:
                      true,
                  },
                },
            },
          },
        },
      });

    if (!league) {
      return NextResponse.json(
        {
          error:
            "League not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const now =
      new Date();

    const upcomingMatches =
      await prisma.match.findMany({
        where: {
          leagueId,

          scheduledAt: {
            gte:
              now,
          },
        },

        orderBy: {
          scheduledAt:
            "asc",
        },

        take:
          10,

        select: {
          id:
            true,

          scheduledAt:
            true,

          status:
            true,

          teamA: {
            select: {
              id:
                true,

              name:
                true,
            },
          },

          teamB: {
            select: {
              id:
                true,

              name:
                true,
            },
          },

          kitAssignments: {
            where: {
              leagueKitId: {
                not:
                  null,
              },

              status: {
                in:
                  ACTIVE_ASSIGNMENT_STATUSES,
              },
            },

            orderBy: {
              assignedAt:
                "desc",
            },

            take:
              1,

            include: {
              team: {
                select: {
                  id:
                    true,

                  name:
                    true,
                },
              },

              rotationMember: {
                select: {
                  id:
                    true,

                  displayName:
                    true,

                  completedCount:
                    true,

                  lastCompletedAt:
                    true,
                },
              },

              matchKitPlayer: {
                select: {
                  id:
                    true,

                  displayName:
                    true,

                  team: {
                    select: {
                      id:
                        true,

                      name:
                        true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    const nextMatch =
      upcomingMatches.find(
        (match) =>
          !isClosedMatch(
            match.status
          )
      ) || null;

    const nextAssignment =
      nextMatch
        ?.kitAssignments?.[0] ||
      null;

    const recentEvents =
      league.leagueKit
        ? await prisma
            .leagueKitEvent
            .findMany({
              where: {
                leagueKitId:
                  league
                    .leagueKit
                    .id,
              },

              orderBy: [
                {
                  occurredAt:
                    "desc",
                },
                {
                  id:
                    "desc",
                },
              ],

              take:
                12,

              select: {
                id:
                  true,

                eventType:
                  true,

                description:
                  true,

                fromHolderName:
                  true,

                toHolderName:
                  true,

                occurredAt:
                  true,

                match: {
                  select: {
                    id:
                      true,

                    scheduledAt:
                      true,

                    teamA: {
                      select: {
                        name:
                          true,
                      },
                    },

                    teamB: {
                      select: {
                        name:
                          true,
                      },
                    },
                  },
                },
              },
            })
        : [];

    const rotationMembers =
      await prisma
        .kitRotationMember
        .findMany({
          where: {
            leagueId,

            rotationKey:
              `LEAGUE:${leagueId}`,

            isActive:
              true,
          },

          orderBy: [
            {
              completedCount:
                "asc",
            },
            {
              lastCompletedAt:
                "asc",
            },
            {
              displayName:
                "asc",
            },
          ],

          select: {
            id:
              true,

            displayName:
              true,

            completedCount:
              true,

            lastCompletedAt:
              true,

            lastAssignedAt:
              true,
          },
        });

    const completedCounts =
      rotationMembers.map(
        (member) =>
          Number(
            member.completedCount ||
              0
          )
      );

    const minimumCompleted =
      completedCounts.length
        ? Math.min(
            ...completedCounts
          )
        : 0;

    const maximumCompleted =
      completedCounts.length
        ? Math.max(
            ...completedCounts
          )
        : 0;

    const readiness =
      readinessFrom({
        leagueKit:
          league.leagueKit,

        assignment:
          nextAssignment,

        match:
          nextMatch,
      });

    return NextResponse.json({
      success:
        true,

      league: {
        id:
          league.id,

        name:
          league.name,

        kitRotationMode:
          league
            .kitRotationMode,

        timeZone:
          league.timeZone,
      },

      leagueKit:
        league.leagueKit,

      readiness,

      nextMatch:
        nextMatch
          ? {
              id:
                nextMatch.id,

              scheduledAt:
                nextMatch
                  .scheduledAt,

              status:
                nextMatch.status,

              teamA:
                nextMatch.teamA,

              teamB:
                nextMatch.teamB,

              assignment:
                nextAssignment,
            }
          : null,

      upcomingMatches:
        upcomingMatches.map(
          (match) => ({
            id:
              match.id,

            scheduledAt:
              match.scheduledAt,

            status:
              match.status,

            teamA:
              match.teamA,

            teamB:
              match.teamB,

            hasAssignment:
              Boolean(
                match
                  .kitAssignments
                  ?.[0]
              ),
          })
        ),

      analytics: {
        activeRotationMembers:
          rotationMembers.length,

        minimumCompleted,

        maximumCompleted,

        completionSpread:
          maximumCompleted -
          minimumCompleted,

        fairnessStatus:
          maximumCompleted -
            minimumCompleted <=
          1
            ? "BALANCED"
            : "NEEDS_ATTENTION",

        rotationMembers,
      },

      recentEvents,
    });
  } catch (error) {
    console.error(
      "[LEAGUE_KIT_DASHBOARD_FAILED]",
      {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      }
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the league-kit dashboard.",
      },
      {
        status:
          500,
      }
    );
  }
}
