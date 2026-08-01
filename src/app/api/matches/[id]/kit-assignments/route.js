import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  getKitRotationKey,
  isLeaguePlayerKitRotation,
} from "@/lib/kit/rotation-scope";

export const runtime = "nodejs";

function isValidPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

const assignmentInclude = {
  leagueKit: {
    include: {
      currentHolderRotationMember: {
        select: {
          id: true,
          playerId: true,
          displayName: true,
          normalizedName: true,
          whatsappNumber: true,
          whatsappOptIn: true,
          completedCount: true,
          lastCompletedAt: true,
          lastAssignedAt: true,
          rotationKey: true,
        },
      },
      previousHolderRotationMember: {
        select: {
          id: true,
          playerId: true,
          displayName: true,
          normalizedName: true,
          rotationKey: true,
        },
      },
    },
  },
  team: {
    select: {
      id: true,
      name: true,
    },
  },
  rotationMember: {
    select: {
      id: true,
      playerId: true,
      displayName: true,
      normalizedName: true,
      whatsappNumber: true,
      whatsappOptIn: true,
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
      normalizedName: true,
      teamId: true,
      playerId: true,
      isConfirmed: true,
      isEligible: true,
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
      playerId: true,
      displayName: true,
      normalizedName: true,
      rotationKey: true,
    },
  },
  actualMatchKitPlayer: {
    select: {
      id: true,
      displayName: true,
      normalizedName: true,
      teamId: true,
      playerId: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
};

function buildPreviousMatchName(previousMatch) {
  if (!previousMatch) {
    return "";
  }

  const teamAName =
    previousMatch.teamA?.name ||
    "Team A";

  const teamBName =
    previousMatch.teamB?.name ||
    "Team B";

  return `${teamAName} vs ${teamBName}`;
}

function pickupHolderName(assignment) {
  return (
    assignment?.actualDisplayName ||
    assignment?.actualRotationMember
      ?.displayName ||
    assignment?.actualMatchKitPlayer
      ?.displayName ||
    null
  );
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const matchId = Number(id);

    if (!isValidPositiveInteger(matchId)) {
      return NextResponse.json(
        { error: "Invalid match id." },
        { status: 400 }
      );
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        leagueId: true,
        teamAId: true,
        teamBId: true,
        status: true,
        scheduledAt: true,
        league: {
          select: {
            id: true,
            name: true,
            kitRotationMode: true,
            leagueKit: {
              include: {
                currentHolderRotationMember: {
                  select: {
                    id: true,
                    playerId: true,
                    displayName: true,
                    normalizedName: true,
                    whatsappNumber: true,
                    whatsappOptIn: true,
                    completedCount: true,
                    lastCompletedAt: true,
                    lastAssignedAt: true,
                    rotationKey: true,
                  },
                },
                previousHolderRotationMember: {
                  select: {
                    id: true,
                    playerId: true,
                    displayName: true,
                    normalizedName: true,
                    rotationKey: true,
                  },
                },
              },
            },
          },
        },
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
    });

    if (!match) {
      return NextResponse.json(
        { error: "Match not found." },
        { status: 404 }
      );
    }

    if (!match.league || !match.leagueId) {
      return NextResponse.json(
        {
          error:
            "The match does not belong to a valid league.",
        },
        { status: 400 }
      );
    }

    const rotationMode =
      match.league.kitRotationMode || "TEAM";

    const sharedKit =
      isLeaguePlayerKitRotation(rotationMode);

    const teamARotationKey = getKitRotationKey({
      leagueId: match.leagueId,
      teamId: match.teamAId,
      rotationMode,
    });

    const teamBRotationKey = getKitRotationKey({
      leagueId: match.leagueId,
      teamId: match.teamBId,
      rotationMode,
    });

    const [
      assignments,
      savedPlayers,
      rotationMembers,
      latestTeamAPickup,
      latestTeamBPickup,
    ] = await Promise.all([
      prisma.kitAssignment.findMany({
        where: { matchId },
        orderBy: [
          { assignedAt: "desc" },
          { id: "desc" },
        ],
        include: assignmentInclude,
      }),

      prisma.matchKitPlayer.findMany({
        where: {
          matchId,
          isConfirmed: true,
          isEligible: true,
        },
        orderBy: [
          { teamId: "asc" },
          { sortOrder: "asc" },
          { displayName: "asc" },
        ],
        select: {
          id: true,
          matchId: true,
          teamId: true,
          playerId: true,
          displayName: true,
          normalizedName: true,
          isConfirmed: true,
          isEligible: true,
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),

      prisma.kitRotationMember.findMany({
        where: {
          rotationKey: {
            in: [
              ...new Set([
                teamARotationKey,
                teamBRotationKey,
              ]),
            ],
          },
          isActive: true,
        },
        select: {
          id: true,
          playerId: true,
          displayName: true,
          normalizedName: true,
          rotationKey: true,
        },
      }),

      sharedKit
        ? Promise.resolve(null)
        : prisma.kitAssignment.findFirst({
            where: {
              teamId: match.teamAId,
              matchId: {
                not: matchId,
              },
              pickupStatus: "TOOK_KIT",
            },
            orderBy: [
              { pickupRecordedAt: "desc" },
              { id: "desc" },
            ],
            select: {
              id: true,
              teamId: true,
              matchId: true,
              actualDisplayName: true,
              pickupRecordedAt: true,
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
                },
              },
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          }),

      sharedKit
        ? Promise.resolve(null)
        : prisma.kitAssignment.findFirst({
            where: {
              teamId: match.teamBId,
              matchId: {
                not: matchId,
              },
              pickupStatus: "TOOK_KIT",
            },
            orderBy: [
              { pickupRecordedAt: "desc" },
              { id: "desc" },
            ],
            select: {
              id: true,
              teamId: true,
              matchId: true,
              actualDisplayName: true,
              pickupRecordedAt: true,
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
                },
              },
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          }),
    ]);

    const previousMatchIds = [
      latestTeamAPickup?.matchId,
      latestTeamBPickup?.matchId,
    ].filter(isValidPositiveInteger);

    const previousMatches =
      previousMatchIds.length > 0
        ? await prisma.match.findMany({
            where: {
              id: {
                in: [
                  ...new Set(previousMatchIds),
                ],
              },
            },
            select: {
              id: true,
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
          })
        : [];

    const previousMatchById = new Map(
      previousMatches.map(
        (previousMatch) => [
          previousMatch.id,
          previousMatch,
        ]
      )
    );

    const teamCurrentHolders = sharedKit
      ? []
      : [
          {
            teamId: match.teamAId,
            teamName:
              match.teamA?.name ||
              latestTeamAPickup?.team?.name ||
              `Team ${match.teamAId}`,
            holderName:
              pickupHolderName(
                latestTeamAPickup
              ),
            previousMatchId:
              latestTeamAPickup?.matchId ||
              null,
            previousMatchName:
              buildPreviousMatchName(
                previousMatchById.get(
                  latestTeamAPickup?.matchId
                )
              ),
            recordedAt:
              latestTeamAPickup
                ?.pickupRecordedAt ||
              null,
          },
          {
            teamId: match.teamBId,
            teamName:
              match.teamB?.name ||
              latestTeamBPickup?.team?.name ||
              `Team ${match.teamBId}`,
            holderName:
              pickupHolderName(
                latestTeamBPickup
              ),
            previousMatchId:
              latestTeamBPickup?.matchId ||
              null,
            previousMatchName:
              buildPreviousMatchName(
                previousMatchById.get(
                  latestTeamBPickup?.matchId
                )
              ),
            recordedAt:
              latestTeamBPickup
                ?.pickupRecordedAt ||
              null,
          },
        ];

    const rotationMemberByKeyAndName = new Map(
      rotationMembers.map((member) => [
        `${member.rotationKey}:${member.normalizedName}`,
        member,
      ])
    );

    const eligiblePlayers = savedPlayers.map((player) => {
      const rotationKey = getKitRotationKey({
        leagueId: match.leagueId,
        teamId: player.teamId,
        rotationMode,
      });

      const rotationMember =
        rotationMemberByKeyAndName.get(
          `${rotationKey}:${player.normalizedName}`
        ) || null;

      return {
        ...player,
        rotationKey,
        rotationMemberId:
          rotationMember?.id || null,
      };
    });

    const teamAPlayers = eligiblePlayers.filter(
      (player) =>
        player.teamId === match.teamAId
    );

    const teamBPlayers = eligiblePlayers.filter(
      (player) =>
        player.teamId === match.teamBId
    );

    const activeAssignments = assignments.filter(
      (assignment) =>
        assignment.status !== "CANCELLED"
    );

    const sharedAssignment = sharedKit
      ? activeAssignments.find(
          (assignment) =>
            assignment.leagueKitId !== null
        ) ||
        activeAssignments[0] ||
        null
      : null;

    const assignmentsByTeam = {
      teamA: sharedKit
        ? null
        : activeAssignments.find(
            (assignment) =>
              assignment.teamId ===
              match.teamAId
          ) || null,
      teamB: sharedKit
        ? null
        : activeAssignments.find(
            (assignment) =>
              assignment.teamId ===
              match.teamBId
          ) || null,
    };

    const currentHolder =
      match.league.leagueKit
        ?.currentHolderRotationMember || null;

    const previousHolder =
      match.league.leagueKit
        ?.previousHolderRotationMember || null;

    return NextResponse.json({
      success: true,
      match: {
        id: match.id,
        status: match.status,
        scheduledAt: match.scheduledAt,
        leagueId: match.leagueId,
        leagueName:
          match.league.name || "",
        kitRotationMode: rotationMode,
        sharedKit,
        teamA: match.teamA,
        teamB: match.teamB,
      },
      leagueKit: match.league.leagueKit
        ? {
            ...match.league.leagueKit,
            currentHolder,
            previousHolder,
          }
        : null,
      currentHolder,
      previousHolder,
      teamCurrentHolders,
      sharedAssignment,
      savedPlayerCount:
        eligiblePlayers.length,
      savedPlayerCounts: {
        total:
          eligiblePlayers.length,
        teamA:
          teamAPlayers.length,
        teamB:
          teamBPlayers.length,
      },
      savedPlayers:
        eligiblePlayers,
      eligiblePlayers,
      playersByTeam: {
        teamA:
          teamAPlayers,
        teamB:
          teamBPlayers,
      },
      assignments: sharedKit
        ? sharedAssignment
          ? [sharedAssignment]
          : []
        : activeAssignments,
      assignmentHistory:
        assignments,
      assignmentsByTeam,
    });
  } catch (error) {
    console.error(
      "Unable to load kit assignments:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load kit assignments.",
      },
      { status: 500 }
    );
  }
}
