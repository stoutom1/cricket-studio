import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getKitRotationKey } from "@/lib/kit/rotation-scope";

export const runtime = "nodejs";

function assignmentReason(rotationMember) {
  const completedCount = Number(
    rotationMember?.completedCount || 0
  );

  if (completedCount === 0) {
    return "This person has not previously taken the kit in this rotation.";
  }

  return (
    "This person has taken the kit the fewest times " +
    "and has waited the longest since the previous pickup."
  );
}

function validPositiveInteger(value) {
  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) &&
    parsedValue > 0
    ? parsedValue
    : null;
}

function dateValue(value) {
  if (!value) {
    return 0;
  }

  const parsedDate = new Date(value).getTime();

  return Number.isFinite(parsedDate)
    ? parsedDate
    : 0;
}

function compareCandidates(
  firstCandidate,
  secondCandidate
) {
  const firstMember =
    firstCandidate.rotationMember;
  const secondMember =
    secondCandidate.rotationMember;

  const firstCompletedCount = Number(
    firstMember.completedCount || 0
  );
  const secondCompletedCount = Number(
    secondMember.completedCount || 0
  );

  if (
    firstCompletedCount !== secondCompletedCount
  ) {
    return (
      firstCompletedCount - secondCompletedCount
    );
  }

  const firstLastCompleted = dateValue(
    firstMember.lastCompletedAt
  );
  const secondLastCompleted = dateValue(
    secondMember.lastCompletedAt
  );

  if (
    firstLastCompleted !== secondLastCompleted
  ) {
    return (
      firstLastCompleted - secondLastCompleted
    );
  }

  const firstLastAssigned = dateValue(
    firstMember.lastAssignedAt
  );
  const secondLastAssigned = dateValue(
    secondMember.lastAssignedAt
  );

  if (
    firstLastAssigned !== secondLastAssigned
  ) {
    return firstLastAssigned - secondLastAssigned;
  }

  return String(
    firstMember.displayName || ""
  ).localeCompare(
    String(secondMember.displayName || ""),
    undefined,
    { sensitivity: "base" }
  );
}

async function loadTeamCandidates({
  tx,
  matchId,
  leagueId,
  teamId,
  rotationMode,
  excludedRotationMemberIds = [],
}) {
  const rotationKey = getKitRotationKey({
    leagueId,
    teamId,
    rotationMode,
  });

  const matchPlayers =
    await tx.matchKitPlayer.findMany({
      where: {
        matchId,
        teamId,
        isConfirmed: true,
        isEligible: true,
      },
      select: {
        id: true,
        teamId: true,
        playerId: true,
        displayName: true,
        normalizedName: true,
      },
    });

  if (matchPlayers.length === 0) {
    throw new Error(
      "No confirmed and eligible kit players were found for the selected team."
    );
  }

  const normalizedNames = [
    ...new Set(
      matchPlayers
        .map((player) =>
          String(
            player.normalizedName || ""
          ).trim()
        )
        .filter(Boolean)
    ),
  ];

  const rotationMembers =
    await tx.kitRotationMember.findMany({
      where: {
        rotationKey,
        normalizedName: {
          in: normalizedNames,
        },
        isActive: true,
        ...(excludedRotationMemberIds.length > 0
          ? {
              id: {
                notIn: excludedRotationMemberIds,
              },
            }
          : {}),
      },
      select: {
        id: true,
        leagueId: true,
        teamId: true,
        playerId: true,
        displayName: true,
        normalizedName: true,
        rotationKey: true,
        completedCount: true,
        lastCompletedAt: true,
        lastAssignedAt: true,
        whatsappNumber: true,
        whatsappOptIn: true,
      },
    });

  const rotationMemberByName = new Map(
    rotationMembers.map((member) => [
      member.normalizedName,
      member,
    ])
  );

  const candidates = matchPlayers
    .map((matchKitPlayer) => {
      const rotationMember =
        rotationMemberByName.get(
          matchKitPlayer.normalizedName
        );

      if (!rotationMember) {
        return null;
      }

      return {
        matchKitPlayer,
        rotationMember,
      };
    })
    .filter(Boolean)
    .sort(compareCandidates);

  if (candidates.length === 0) {
    throw new Error(
      "No eligible kit carrier is available for the selected team."
    );
  }

  return candidates;
}

async function saveSuggestion({
  tx,
  match,
  teamId,
  candidate,
  assignedAt,
}) {
  const reason = assignmentReason(
    candidate.rotationMember
  );

  const assignment =
    await tx.kitAssignment.upsert({
      where: {
        matchId_teamId: {
          matchId: match.id,
          teamId,
        },
      },
      update: {
        rotationMemberId:
          candidate.rotationMember.id,
        matchKitPlayerId:
          candidate.matchKitPlayer.id,
        status: "SUGGESTED",
        assignedAt,
        confirmedAt: null,
        declinedAt: null,
        cancelledAt: null,
        pickupStatus: "PENDING",
        actualRotationMemberId: null,
        actualMatchKitPlayerId: null,
        actualDisplayName: null,
        pickupRecordedAt: null,
        pickupRecordedById: null,
        assignmentReason: reason,
      },
      create: {
        leagueId: match.leagueId,
        matchId: match.id,
        teamId,
        rotationKey: getKitRotationKey({
          leagueId: match.leagueId,
          teamId,
          rotationMode:
            match.league.kitRotationMode ||
            "TEAM",
        }),
        rotationMemberId:
          candidate.rotationMember.id,
        matchKitPlayerId:
          candidate.matchKitPlayer.id,
        status: "SUGGESTED",
        assignedAt,
        pickupStatus: "PENDING",
        assignmentReason: reason,
      },
      include: {
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
            playerId: true,
          },
        },
      },
    });

  await tx.kitRotationMember.update({
    where: {
      id: candidate.rotationMember.id,
    },
    data: {
      lastAssignedAt: assignedAt,
    },
  });

  return assignment;
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const matchId = Number(id);

    if (
      !Number.isInteger(matchId) ||
      matchId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid match id." },
        { status: 400 }
      );
    }

    let body = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const suggestNext = Boolean(
      body?.suggestNext
    );

    const requestedTeamId =
      body?.teamId === undefined ||
      body?.teamId === null ||
      body?.teamId === ""
        ? null
        : validPositiveInteger(body.teamId);

    if (
      body?.teamId !== undefined &&
      body?.teamId !== null &&
      body?.teamId !== "" &&
      !requestedTeamId
    ) {
      return NextResponse.json(
        { error: "Invalid team id." },
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
        league: {
          select: {
            id: true,
            name: true,
            kitRotationMode: true,
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

    if (!match.league) {
      return NextResponse.json(
        {
          error:
            "The match does not belong to a valid league.",
        },
        { status: 400 }
      );
    }

    const validMatchTeamIds = [
      match.teamAId,
      match.teamBId,
    ];

    if (
      requestedTeamId &&
      !validMatchTeamIds.includes(
        requestedTeamId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "The selected team does not belong to this match.",
        },
        { status: 400 }
      );
    }

    const targetTeamIds = requestedTeamId
      ? [requestedTeamId]
      : [match.teamAId, match.teamBId];

    const playerCounts =
      await prisma.matchKitPlayer.groupBy({
        by: ["teamId"],
        where: {
          matchId,
          teamId: {
            in: targetTeamIds,
          },
          isConfirmed: true,
          isEligible: true,
        },
        _count: {
          _all: true,
        },
      });

    const playerCountByTeam = new Map(
      playerCounts.map((item) => [
        item.teamId,
        item._count._all,
      ])
    );

    const missingTeamId = targetTeamIds.find(
      (teamId) =>
        Number(
          playerCountByTeam.get(teamId) || 0
        ) === 0
    );

    if (missingTeamId) {
      const missingTeam =
        missingTeamId === match.teamAId
          ? match.teamA
          : match.teamB;

      return NextResponse.json(
        {
          error:
            `Confirm and save the player list for ${
              missingTeam?.name ||
              "the selected team"
            } before generating a kit assignment.`,
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const existingAssignments =
          await tx.kitAssignment.findMany({
            where: {
              matchId,
              teamId: {
                in: targetTeamIds,
              },
            },
            select: {
              id: true,
              teamId: true,
              status: true,
              rotationMemberId: true,
            },
          });

        const excludedByTeam = new Map();

        for (const teamId of targetTeamIds) {
          excludedByTeam.set(teamId, []);
        }

        if (suggestNext) {
          for (const assignment of existingAssignments) {
            const excludedIds =
              excludedByTeam.get(
                assignment.teamId
              ) || [];

            excludedIds.push(
              assignment.rotationMemberId
            );

            excludedByTeam.set(
              assignment.teamId,
              excludedIds
            );
          }
        }

        const assignedAt = new Date();
        const assignments = [];

        for (const teamId of targetTeamIds) {
          const candidates =
            await loadTeamCandidates({
              tx,
              matchId: match.id,
              leagueId: match.leagueId,
              teamId,
              rotationMode:
                match.league
                  .kitRotationMode || "TEAM",
              excludedRotationMemberIds:
                excludedByTeam.get(teamId) || [],
            });

          const selectedCandidate = candidates[0];

          const assignment =
            await saveSuggestion({
              tx,
              match,
              teamId,
              candidate: selectedCandidate,
              assignedAt,
            });

          assignments.push(assignment);
        }

        return assignments;
      }
    );

    const singleTeamMode = Boolean(
      requestedTeamId
    );

    return NextResponse.json({
      success: true,
      message: suggestNext
        ? singleTeamMode
          ? "The next eligible kit carrier was suggested."
          : "The next eligible kit carriers were suggested."
        : singleTeamMode
          ? "A kit carrier was suggested successfully."
          : "Kit carriers were suggested successfully.",
      mode: singleTeamMode
        ? "SINGLE_TEAM"
        : "BOTH_TEAMS",
      assignmentIds: result.map(
        (assignment) => assignment.id
      ),
      assignments: result,
    });
  } catch (error) {
    console.error(
      "Unable to suggest kit carriers:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to suggest kit carriers.",
      },
      { status: 500 }
    );
  }
}
