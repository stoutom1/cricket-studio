import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  getKitRotationKey,
  isLeaguePlayerKitRotation,
} from "@/lib/kit/rotation-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_ASSIGNMENT_STATUSES = [
  "SUGGESTED",
  "ASSIGNED",
  "CONFIRMED",
];

const CLOSED_MATCH_STATUSES = [
  "COMPLETED",
  "COMPLETED_LOCKED",
  "COMPLETED_CORRECTED",
  "ABANDONED",
  "CANCELLED",
  "CANCELED",
];

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeLeagueName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function assignmentPersonName(assignment) {
  return (
    assignment?.rotationMember?.displayName ||
    assignment?.matchKitPlayer?.displayName ||
    "Not assigned"
  );
}

function actualHolderName(assignment) {
  return (
    assignment?.actualDisplayName ||
    assignment?.actualRotationMember?.displayName ||
    assignment?.actualMatchKitPlayer?.displayName ||
    null
  );
}

function buildMatchName(match) {
  if (!match) {
    return "";
  }

  return `${
    match.teamA?.name || "Team A"
  } vs ${
    match.teamB?.name || "Team B"
  }`;
}

function sharedReadiness({
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
    normalizeStatus(leagueKit.status) === "AT_VENUE" ||
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
      normalizeStatus(leagueKit.handoverStatus)
    )
  ) {
    return {
      level: "COORDINATED",
      label: "Coordination complete",
      message:
        "The holder and assigned carrier have coordinated. Venue arrival is not yet confirmed.",
    };
  }

  if (!leagueKit.currentHolderRotationMember) {
    return {
      level: "HOLDER_MISSING",
      label: "Current holder missing",
      message:
        "Record who currently has the shared league kit.",
    };
  }

  const scheduledAt = match?.scheduledAt
    ? new Date(match.scheduledAt)
    : null;

  const hoursUntilMatch =
    scheduledAt &&
    !Number.isNaN(scheduledAt.getTime())
      ? (scheduledAt.getTime() - Date.now()) /
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

function teamReadiness({
  teamCustody,
  nextAssignments,
  requiredTeamIds = [],
}) {
  /*
   * Only teams participating in the next match are
   * required. Other league teams may legitimately have
   * no custody record yet.
   */
  const requiredIds =
    new Set(
      requiredTeamIds
        .map(Number)
        .filter(
          (teamId) =>
            Number.isInteger(teamId) &&
            teamId > 0
        )
    );

  const relevantCustody =
    requiredIds.size > 0
      ? teamCustody.filter(
          (item) =>
            requiredIds.has(
              Number(item.teamId)
            )
        )
      : teamCustody.filter(
          (item) =>
            Boolean(item.holderName)
        );

  if (
    requiredIds.size > 0 &&
    relevantCustody.length === 0
  ) {
    return {
      level: "HOLDER_MISSING",
      label: "Upcoming team-kit holders not recorded",
      message:
        "Record who currently has the kits for the teams in the next match.",
    };
  }

  const missingHolders =
    relevantCustody.filter(
      (item) => !item.holderName
    );

  if (missingHolders.length > 0) {
    const missingNames =
      missingHolders
        .map(
          (item) =>
            item.teamName ||
            `Team ${item.teamId}`
        )
        .join(", ");

    return {
      level: "HOLDER_MISSING",
      label: "Upcoming kit holder missing",
      message:
        `Record the current physical kit holder for: ${missingNames}.`,
    };
  }

  if (
    requiredIds.size > 0 &&
    !nextAssignments.length
  ) {
    return {
      level: "NO_ASSIGNMENT",
      label: "Current holders recorded",
      message:
        "Confirm the next match rosters and generate the next team-kit assignments.",
    };
  }

  if (requiredIds.size === 0) {
    return {
      level: "READY",
      label: "Team-kit custody available",
      message:
        "Recorded team-kit holders are available. No upcoming match is currently scheduled.",
    };
  }

  return {
    level: "READY",
    label: "Upcoming team kits tracked",
    message:
      "Current physical holders and next-match responsibilities are available for both playing teams.",
  };
}

const assignmentRelations = {
  team: {
    select: {
      id: true,
      name: true,
    },
  },
  rotationMember: {
    select: {
      id: true,
      displayName: true,
      completedCount: true,
      lastCompletedAt: true,
      lastAssignedAt: true,
      rotationKey: true,
    },
  },
  matchKitPlayer: {
    select: {
      id: true,
      displayName: true,
      teamId: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  actualRotationMember: {
    select: {
      id: true,
      displayName: true,
    },
  },
  actualMatchKitPlayer: {
    select: {
      id: true,
      displayName: true,
      teamId: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
};

export async function GET(
  request,
  { params }
) {
  try {
    const resolvedParams = await params;
    const leagueId = Number(
      resolvedParams.id ??
        resolvedParams.leagueId
    );

    if (
      !Number.isInteger(leagueId) ||
      leagueId <= 0
    ) {
      return NextResponse.json(
        {
          error: "Invalid league id.",
        },
        {
          status: 400,
        }
      );
    }

    const league =
      await prisma.league.findUnique({
        where: {
          id: leagueId,
        },
        select: {
          id: true,
          name: true,
          kitRotationMode: true,
          timeZone: true,
          teams: {
            select: {
              id: true,
              name: true,
            },
            orderBy: {
              name: "asc",
            },
          },
          leagueKit: {
            include: {
              currentHolderRotationMember: {
                select: {
                  id: true,
                  displayName: true,
                  completedCount: true,
                  lastCompletedAt: true,
                },
              },
              previousHolderRotationMember: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
        },
      });

    if (!league) {
      return NextResponse.json(
        {
          error: "League not found.",
        },
        {
          status: 404,
        }
      );
    }

    const configuredRotationMode =
      league.kitRotationMode || "TEAM";

    /*
     * Surprise Cricket League is a permanent exception:
     * every team uses the same physical kit and therefore
     * the dashboard must always use one league-wide holder,
     * one next responsibility, and one rotation table.
     */
    const isSurpriseCricketLeague =
      normalizeLeagueName(
        league.name
      ) ===
      "surprise cricket league";

    const rotationMode =
      isSurpriseCricketLeague
        ? "LEAGUE_PLAYER"
        : configuredRotationMode;

    const sharedKit =
      isSurpriseCricketLeague ||
      isLeaguePlayerKitRotation(
        rotationMode
      );

    const now = new Date();

    const upcomingMatches =
      await prisma.match.findMany({
        where: {
          leagueId,
          scheduledAt: {
            not: null,
            gte: now,
          },
          status: {
            notIn:
              CLOSED_MATCH_STATUSES,
          },
        },
        orderBy: {
          scheduledAt: "asc",
        },
        take: 10,
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          teamAId: true,
          teamBId: true,
          teamA: {
            select: {
              id: true,
              name: true,
            },
          },
          teamB: {
            select: {
              id: true,
              name: true,
            },
          },
          kitAssignments: {
            where: {
              status: {
                in:
                  ACTIVE_ASSIGNMENT_STATUSES,
              },
            },
            orderBy: [
              {
                assignedAt: "desc",
              },
              {
                id: "desc",
              },
            ],
            include:
              assignmentRelations,
          },
        },
      });

    const nextMatch =
      upcomingMatches[0] || null;

    if (sharedKit) {
      const nextAssignment =
        nextMatch?.kitAssignments?.find(
          (assignment) =>
            assignment.leagueKitId !==
            null
        ) ||
        nextMatch?.kitAssignments?.[0] ||
        null;

      /*
       * Older Surprise Cricket League records may have been
       * saved as a team assignment even though the physical
       * kit is shared. Use the latest recorded pickup from
       * any league match as a fallback current holder.
       */
      const latestSharedPickup =
        await prisma.kitAssignment.findFirst({
          where: {
            match: {
              leagueId,
            },
            pickupStatus:
              "TOOK_KIT",
          },
          orderBy: [
            {
              pickupRecordedAt:
                "desc",
            },
            {
              id:
                "desc",
            },
          ],
          include: {
            ...assignmentRelations,
            match: {
              select: {
                id: true,
                scheduledAt: true,
                teamA: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                teamB: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

      const fallbackCurrentHolderName =
        actualHolderName(
          latestSharedPickup
        );

      const effectiveCurrentHolder =
        league.leagueKit
          ?.currentHolderRotationMember ||
        (
          fallbackCurrentHolderName
            ? {
                id:
                  latestSharedPickup
                    ?.actualRotationMember
                    ?.id ||
                  latestSharedPickup
                    ?.actualMatchKitPlayer
                    ?.id ||
                  null,
                displayName:
                  fallbackCurrentHolderName,
                completedCount:
                  latestSharedPickup
                    ?.actualRotationMember
                    ?.completedCount ||
                  0,
                lastCompletedAt:
                  latestSharedPickup
                    ?.pickupRecordedAt ||
                  null,
              }
            : null
        );

      const effectiveLeagueKit =
        league.leagueKit
          ? {
              ...league.leagueKit,
              currentHolderRotationMember:
                effectiveCurrentHolder,
            }
          : (
              effectiveCurrentHolder
                ? {
                    id:
                      null,
                    status:
                      "WITH_HOLDER",
                    handoverStatus:
                      "PENDING",
                    currentHolderRotationMember:
                      effectiveCurrentHolder,
                    previousHolderRotationMember:
                      null,
                    venueConfirmedAt:
                      null,
                  }
                : null
            );

      const recentEvents =
        league.leagueKit
          ? await prisma.leagueKitEvent.findMany({
              where: {
                leagueKitId:
                  league.leagueKit.id,
              },
              orderBy: [
                {
                  occurredAt: "desc",
                },
                {
                  id: "desc",
                },
              ],
              take: 12,
              select: {
                id: true,
                eventType: true,
                description: true,
                fromHolderName: true,
                toHolderName: true,
                occurredAt: true,
                match: {
                  select: {
                    id: true,
                    scheduledAt: true,
                    teamA: {
                      select: {
                        name: true,
                      },
                    },
                    teamB: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            })
          : [];

      const rotationMembers =
        await prisma.kitRotationMember.findMany({
          where: {
            leagueId,
            rotationKey:
              `LEAGUE:${leagueId}`,
            isActive: true,
          },
          orderBy: [
            {
              completedCount: "asc",
            },
            {
              lastCompletedAt: "asc",
            },
            {
              displayName: "asc",
            },
          ],
          select: {
            id: true,
            displayName: true,
            completedCount: true,
            lastCompletedAt: true,
            lastAssignedAt: true,
          },
        });

      const completedCounts =
        rotationMembers.map(
          (member) =>
            Number(
              member.completedCount || 0
            )
        );

      const minimumCompleted =
        completedCounts.length
          ? Math.min(...completedCounts)
          : 0;

      const maximumCompleted =
        completedCounts.length
          ? Math.max(...completedCounts)
          : 0;

      return NextResponse.json({
        success: true,
        mode: "SHARED",
        sharedKit: true,
        league: {
          id: league.id,
          name: league.name,
          kitRotationMode:
            rotationMode,
          configuredKitRotationMode:
            configuredRotationMode,
          isSurpriseCricketLeague,
          timeZone:
            league.timeZone,
        },
        leagueKit:
          effectiveLeagueKit,
        readiness:
          sharedReadiness({
            leagueKit:
              effectiveLeagueKit,
            assignment:
              nextAssignment,
            match:
              nextMatch,
          }),
        nextMatch: nextMatch
          ? {
              id: nextMatch.id,
              scheduledAt:
                nextMatch.scheduledAt,
              status:
                nextMatch.status,
              teamA:
                nextMatch.teamA,
              teamB:
                nextMatch.teamB,
              assignment:
                nextAssignment,
              assignments:
                nextAssignment
                  ? [nextAssignment]
                  : [],
            }
          : null,
        upcomingMatches:
          upcomingMatches.map(
            (match) => ({
              id: match.id,
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
        teamCustody: [],
        teamAnalytics: [],
      });
    }

    const teamIds =
      league.teams.map(
        (team) => team.id
      );

    const [
      latestPickupRows,
      allTeamRotationMembers,
      recentPickupRows,
    ] = await Promise.all([
      prisma.kitAssignment.findMany({
        where: {
          teamId: {
            in: teamIds,
          },
          pickupStatus:
            "TOOK_KIT",
        },
        orderBy: [
          {
            pickupRecordedAt:
              "desc",
          },
          {
            id: "desc",
          },
        ],
        include: {
          ...assignmentRelations,
          match: {
            select: {
              id: true,
              scheduledAt: true,
              teamA: {
                select: {
                  id: true,
                  name: true,
                },
              },
              teamB: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),

      prisma.kitRotationMember.findMany({
        where: {
          leagueId,
          rotationKey: {
            in: teamIds.map(
              (teamId) =>
                getKitRotationKey({
                  leagueId,
                  teamId,
                  rotationMode,
                })
            ),
          },
          isActive: true,
        },
        orderBy: [
          {
            rotationKey: "asc",
          },
          {
            completedCount: "asc",
          },
          {
            lastCompletedAt: "asc",
          },
          {
            displayName: "asc",
          },
        ],
        select: {
          id: true,
          displayName: true,
          completedCount: true,
          lastCompletedAt: true,
          lastAssignedAt: true,
          rotationKey: true,
        },
      }),

      prisma.kitAssignment.findMany({
        where: {
          teamId: {
            in: teamIds,
          },
          pickupStatus: {
            in: [
              "TOOK_KIT",
              "DID_NOT_TAKE_KIT",
            ],
          },
        },
        orderBy: [
          {
            pickupRecordedAt:
              "desc",
          },
          {
            id: "desc",
          },
        ],
        take: 20,
        include: {
          ...assignmentRelations,
          match: {
            select: {
              id: true,
              scheduledAt: true,
              teamA: {
                select: {
                  name: true,
                },
              },
              teamB: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const latestPickupByTeam =
      new Map();

    for (
      const pickup
      of latestPickupRows
    ) {
      if (
        pickup.teamId &&
        !latestPickupByTeam.has(
          pickup.teamId
        )
      ) {
        latestPickupByTeam.set(
          pickup.teamId,
          pickup
        );
      }
    }

    const teamCustody =
      league.teams.map((team) => {
        const pickup =
          latestPickupByTeam.get(
            team.id
          ) || null;

        return {
          teamId: team.id,
          teamName: team.name,
          holderName:
            actualHolderName(
              pickup
            ),
          holderRotationMemberId:
            pickup
              ?.actualRotationMember
              ?.id || null,
          previousMatchId:
            pickup?.matchId ||
            null,
          previousMatchName:
            buildMatchName(
              pickup?.match
            ),
          recordedAt:
            pickup
              ?.pickupRecordedAt ||
            null,
        };
      });

    const nextAssignments =
      nextMatch
        ? nextMatch.kitAssignments
            .filter(
              (assignment) =>
                assignment.teamId !==
                null
            )
            .map(
              (assignment) => ({
                ...assignment,
                assignedName:
                  assignmentPersonName(
                    assignment
                  ),
              })
            )
        : [];

    const teamAnalytics =
      league.teams.map((team) => {
        const rotationKey =
          getKitRotationKey({
            leagueId,
            teamId: team.id,
            rotationMode,
          });

        const members =
          allTeamRotationMembers.filter(
            (member) =>
              member.rotationKey ===
              rotationKey
          );

        const completedCounts =
          members.map(
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

        return {
          teamId: team.id,
          teamName: team.name,
          activeRotationMembers:
            members.length,
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
          rotationMembers:
            members,
        };
      });

    const recentEvents =
      recentPickupRows.map(
        (assignment) => {
          const holderName =
            actualHolderName(
              assignment
            );

          const tookKit =
            assignment.pickupStatus ===
            "TOOK_KIT";

          return {
            id:
              `assignment-${assignment.id}`,
            eventType:
              tookKit
                ? "CUSTODY_TRANSFERRED"
                : "CUSTODY_NOT_TRANSFERRED",
            description:
              tookKit
                ? `${holderName || "A player"} took ${assignment.team?.name || "the team"} kit home after ${buildMatchName(assignment.match)}.`
                : `No custody transfer was recorded for ${assignment.team?.name || "the team"} kit after ${buildMatchName(assignment.match)}.`,
            fromHolderName:
              null,
            toHolderName:
              tookKit
                ? holderName
                : null,
            occurredAt:
              assignment.pickupRecordedAt,
            team:
              assignment.team,
            match:
              assignment.match,
          };
        }
      );

    const aggregateSpread =
      teamAnalytics.length
        ? Math.max(
            ...teamAnalytics.map(
              (item) =>
                item.completionSpread
            )
          )
        : 0;

    return NextResponse.json({
      success: true,
      mode: "TEAM",
      sharedKit: false,
      league: {
        id: league.id,
        name: league.name,
        kitRotationMode:
          rotationMode,
        configuredKitRotationMode:
          configuredRotationMode,
        isSurpriseCricketLeague,
        timeZone:
          league.timeZone,
      },
      leagueKit: null,
      readiness:
        teamReadiness({
          teamCustody,
          nextAssignments,
          requiredTeamIds:
            nextMatch
              ? [
                  nextMatch.teamAId,
                  nextMatch.teamBId,
                ]
              : [],
        }),
      nextMatch: nextMatch
        ? {
            id: nextMatch.id,
            scheduledAt:
              nextMatch.scheduledAt,
            status:
              nextMatch.status,
            teamA:
              nextMatch.teamA,
            teamB:
              nextMatch.teamB,
            assignment:
              nextAssignments[0] ||
              null,
            assignments:
              nextAssignments,
          }
        : null,
      upcomingMatches:
        upcomingMatches.map(
          (match) => ({
            id: match.id,
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
      teamCustody,
      teamAnalytics,
      analytics: {
        activeRotationMembers:
          allTeamRotationMembers.length,
        completionSpread:
          aggregateSpread,
        fairnessStatus:
          aggregateSpread <= 1
            ? "BALANCED"
            : "NEEDS_ATTENTION",
        rotationMembers:
          allTeamRotationMembers,
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
        status: 500,
      }
    );
  }
}
