import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  getKitRotationKey,
  isLeaguePlayerKitRotation,
} from "@/lib/kit/rotation-scope";

export const runtime = "nodejs";

function assignmentReason(rotationMember) {
  const completedCount = Number(
    rotationMember?.completedCount || 0
  );

  if (completedCount === 0) {
    return "This person has not previously taken the shared league kit in this rotation.";
  }

  return (
    "This person has taken the shared league kit the fewest times " +
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

function compareCandidates(firstCandidate, secondCandidate) {
  const firstMember = firstCandidate.rotationMember;
  const secondMember = secondCandidate.rotationMember;

  const firstCompletedCount = Number(
    firstMember.completedCount || 0
  );
  const secondCompletedCount = Number(
    secondMember.completedCount || 0
  );

  if (firstCompletedCount !== secondCompletedCount) {
    return firstCompletedCount - secondCompletedCount;
  }

  const firstLastCompleted = dateValue(
    firstMember.lastCompletedAt
  );
  const secondLastCompleted = dateValue(
    secondMember.lastCompletedAt
  );

  if (firstLastCompleted !== secondLastCompleted) {
    return firstLastCompleted - secondLastCompleted;
  }

  const firstLastAssigned = dateValue(
    firstMember.lastAssignedAt
  );
  const secondLastAssigned = dateValue(
    secondMember.lastAssignedAt
  );

  if (firstLastAssigned !== secondLastAssigned) {
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

async function loadCandidates({
  tx,
  matchId,
  leagueId,
  teamIds,
  rotationMode,
  excludedRotationMemberIds = [],
}) {
  const leaguePlayerMode =
    isLeaguePlayerKitRotation(rotationMode);

  const rotationKey = getKitRotationKey({
    leagueId,
    teamId: teamIds[0],
    rotationMode,
  });

  const matchPlayers =
    await tx.matchKitPlayer.findMany({
      where: {
        matchId,
        teamId: {
          in: teamIds,
        },
        isConfirmed: true,
        isEligible: true,
      },
      orderBy: [
        { teamId: "asc" },
        { sortOrder: "asc" },
        { id: "asc" },
      ],
      select: {
        id: true,
        teamId: true,
        playerId: true,
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

  if (matchPlayers.length === 0) {
    throw new Error(
      leaguePlayerMode
        ? "No confirmed and eligible kit players were found across the two playing teams."
        : "No confirmed and eligible kit players were found for the selected team."
    );
  }

  const normalizedNames = [
    ...new Set(
      matchPlayers
        .map((player) =>
          String(player.normalizedName || "").trim()
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
      leaguePlayerMode
        ? "No eligible shared-kit carrier is available across the two playing teams."
        : "No eligible kit carrier is available for the selected team."
    );
  }

  return candidates;
}

async function includeAssignment(tx, assignmentId) {
  return tx.kitAssignment.findUnique({
    where: {
      id: assignmentId,
    },
    include: {
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
            },
          },
          previousHolderRotationMember: {
            select: {
              id: true,
              playerId: true,
              displayName: true,
              normalizedName: true,
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
          completedCount: true,
          lastCompletedAt: true,
          lastAssignedAt: true,
          rotationKey: true,
          whatsappNumber: true,
          whatsappOptIn: true,
        },
      },
      matchKitPlayer: {
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
    },
  });
}

async function saveTeamSuggestion({
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
        leagueKitId: null,
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
        leagueKitId: null,
        rotationKey: getKitRotationKey({
          leagueId: match.leagueId,
          teamId,
          rotationMode: "TEAM",
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
      select: {
        id: true,
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

  return includeAssignment(tx, assignment.id);
}

async function saveSharedLeagueKitSuggestion({
  tx,
  match,
  candidate,
  assignedAt,
}) {
  const reason = assignmentReason(
    candidate.rotationMember
  );

  const leagueKit = await tx.leagueKit.upsert({
    where: {
      leagueId: match.leagueId,
    },
    update: {},
    create: {
      leagueId: match.leagueId,
      name: "League Kit",
      status: "UNASSIGNED",
      handoverStatus: "NOT_REQUIRED",
    },
  });

  const existingAssignments =
    await tx.kitAssignment.findMany({
      where: {
        matchId: match.id,
      },
      select: {
        id: true,
        teamId: true,
        leagueKitId: true,
        rotationMemberId: true,
        rotationMember: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

  const candidateTeamId =
    candidate.matchKitPlayer.teamId;

  const matchingTeamAssignment =
    existingAssignments.find(
      (assignment) =>
        assignment.teamId === candidateTeamId
    );

  const previousAssignedMemberId =
    matchingTeamAssignment
      ?.rotationMemberId ||
    null;

  const previousAssignedName =
    matchingTeamAssignment
      ?.rotationMember
      ?.displayName ||
    null;

  const assignmentEventType =
    matchingTeamAssignment
      ? "ASSIGNMENT_CHANGED"
      : "ASSIGNMENT_CREATED";

  let assignmentId;

  if (matchingTeamAssignment) {
    const updated =
      await tx.kitAssignment.update({
        where: {
          id: matchingTeamAssignment.id,
        },
        data: {
          leagueKitId: leagueKit.id,
          rotationKey: getKitRotationKey({
            leagueId: match.leagueId,
            teamId: candidateTeamId,
            rotationMode: "LEAGUE_PLAYER",
          }),
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
        select: {
          id: true,
        },
      });

    assignmentId = updated.id;
  } else {
    const created =
      await tx.kitAssignment.create({
        data: {
          leagueId: match.leagueId,
          matchId: match.id,
          teamId: candidateTeamId,
          leagueKitId: leagueKit.id,
          rotationKey: getKitRotationKey({
            leagueId: match.leagueId,
            teamId: candidateTeamId,
            rotationMode: "LEAGUE_PLAYER",
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
        select: {
          id: true,
        },
      });

    assignmentId = created.id;
  }

  await tx.kitAssignment.updateMany({
    where: {
      matchId: match.id,
      id: {
        not: assignmentId,
      },
      status: {
        not: "CANCELLED",
      },
    },
    data: {
      status: "CANCELLED",
      cancelledAt: assignedAt,
      leagueKitId: null,
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

  const updatedLeagueKit =
    await tx.leagueKit.update({
      where: {
        id: leagueKit.id,
      },
      data: {
        status: leagueKit.currentHolderRotationMemberId
          ? "AWAITING_COORDINATION"
          : "UNASSIGNED",
        handoverStatus:
          leagueKit.currentHolderRotationMemberId
            ? "PENDING"
            : "NOT_REQUIRED",
        handoverConfirmedAt: null,
        venueConfirmedAt: null,
      },
      select: {
        id: true,
        currentHolderRotationMemberId: true,
        status: true,
        handoverStatus: true,
      },
    });

  /*
   * Append assignment history instead of relying only on
   * the mutable KitAssignment row.
   */
  await tx.leagueKitEvent.create({
    data: {
      leagueKitId:
        updatedLeagueKit.id,

      leagueId:
        match.leagueId,

      matchId:
        match.id,

      assignmentId,

      eventType:
        assignmentEventType,

      fromHolderRotationMemberId:
        previousAssignedMemberId,

      toHolderRotationMemberId:
        candidate.rotationMember.id,

      fromHolderName:
        previousAssignedName,

      toHolderName:
        candidate.rotationMember.displayName,

      description:
        assignmentEventType ===
        "ASSIGNMENT_CREATED"
          ? `${candidate.rotationMember.displayName} was assigned responsibility for the shared league kit for this match.`
          : `${previousAssignedName || "The previous carrier"} was replaced by ${candidate.rotationMember.displayName} as the assigned shared-kit carrier for this match.`,

      metadata: {
        suggestNext,
        selectedTeamId:
          candidateTeamId,
        selectedTeamName:
          candidate.matchKitPlayer
            ?.team
            ?.name ||
          null,
        assignmentReason:
          reason,
        previousAssignedMemberId,
        newAssignedMemberId:
          candidate.rotationMember.id,
        kitStatus:
          updatedLeagueKit.status,
        handoverStatus:
          updatedLeagueKit.handoverStatus,
      },

      occurredAt:
        assignedAt,
    },
  });

  return includeAssignment(tx, assignmentId);
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const matchId = Number(id);

    if (!Number.isInteger(matchId) || matchId <= 0) {
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

    const suggestNext = Boolean(body?.suggestNext);

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

    const sharedLeagueKitMode =
      isLeaguePlayerKitRotation(rotationMode);

    const validMatchTeamIds = [
      match.teamAId,
      match.teamBId,
    ];

    if (
      requestedTeamId &&
      !validMatchTeamIds.includes(requestedTeamId)
    ) {
      return NextResponse.json(
        {
          error:
            "The selected team does not belong to this match.",
        },
        { status: 400 }
      );
    }

    /*
     * Shared-kit leagues always use the combined player pool,
     * even when an older UI still sends a teamId.
     */
    const targetTeamIds = sharedLeagueKitMode
      ? validMatchTeamIds
      : requestedTeamId
        ? [requestedTeamId]
        : validMatchTeamIds;

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

    if (sharedLeagueKitMode) {
      const totalPlayerCount = targetTeamIds.reduce(
        (total, teamId) =>
          total + Number(playerCountByTeam.get(teamId) || 0),
        0
      );

      if (totalPlayerCount === 0) {
        return NextResponse.json(
          {
            error:
              "Confirm and save at least one eligible player across the two playing teams before generating the shared league-kit assignment.",
          },
          { status: 400 }
        );
      }
    } else {
      const missingTeamId = targetTeamIds.find(
        (teamId) =>
          Number(playerCountByTeam.get(teamId) || 0) === 0
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
                missingTeam?.name || "the selected team"
              } before generating a kit assignment.`,
          },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const assignedAt = new Date();

        if (sharedLeagueKitMode) {
          const existingActiveAssignment =
            await tx.kitAssignment.findFirst({
              where: {
                matchId,
                status: {
                  not: "CANCELLED",
                },
              },
              orderBy: {
                assignedAt: "desc",
              },
              select: {
                rotationMemberId: true,
              },
            });

          const candidates = await loadCandidates({
            tx,
            matchId: match.id,
            leagueId: match.leagueId,
            teamIds: targetTeamIds,
            rotationMode,
            excludedRotationMemberIds:
              suggestNext && existingActiveAssignment
                ? [existingActiveAssignment.rotationMemberId]
                : [],
          });

          const assignment =
            await saveSharedLeagueKitSuggestion({
              tx,
              match,
              candidate: candidates[0],
              assignedAt,
            });

          return [assignment];
        }

        const existingAssignments =
          await tx.kitAssignment.findMany({
            where: {
              matchId,
              teamId: {
                in: targetTeamIds,
              },
            },
            select: {
              teamId: true,
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
              excludedByTeam.get(assignment.teamId) || [];

            excludedIds.push(
              assignment.rotationMemberId
            );

            excludedByTeam.set(
              assignment.teamId,
              excludedIds
            );
          }
        }

        const assignments = [];

        for (const teamId of targetTeamIds) {
          const candidates = await loadCandidates({
            tx,
            matchId: match.id,
            leagueId: match.leagueId,
            teamIds: [teamId],
            rotationMode,
            excludedRotationMemberIds:
              excludedByTeam.get(teamId) || [],
          });

          const assignment = await saveTeamSuggestion({
            tx,
            match,
            teamId,
            candidate: candidates[0],
            assignedAt,
          });

          assignments.push(assignment);
        }

        return assignments;
      }
    );

    if (sharedLeagueKitMode) {
      return NextResponse.json({
        success: true,
        message: suggestNext
          ? "The next eligible shared league-kit carrier was suggested."
          : "A shared league-kit carrier was suggested successfully.",
        mode: "SHARED_LEAGUE_KIT",
        sharedKit: true,
        assignmentIds: result.map(
          (assignment) => assignment.id
        ),
        assignment: result[0] || null,
        assignments: result,
      });
    }

    const singleTeamMode = Boolean(requestedTeamId);

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
      sharedKit: false,
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
