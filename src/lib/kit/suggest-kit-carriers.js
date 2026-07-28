function compareCandidates(a, b) {
  const aCount = Number(
    a.rotationMember.completedCount || 0
  );

  const bCount = Number(
    b.rotationMember.completedCount || 0
  );

  if (aCount !== bCount) {
    return aCount - bCount;
  }

  const aCompletedAt =
    a.rotationMember.lastCompletedAt
      ? new Date(
          a.rotationMember.lastCompletedAt
        ).getTime()
      : null;

  const bCompletedAt =
    b.rotationMember.lastCompletedAt
      ? new Date(
          b.rotationMember.lastCompletedAt
        ).getTime()
      : null;

  /*
   * Players who never completed kit duty
   * come before players who completed it.
   */
  if (
    aCompletedAt === null &&
    bCompletedAt !== null
  ) {
    return -1;
  }

  if (
    aCompletedAt !== null &&
    bCompletedAt === null
  ) {
    return 1;
  }

  /*
   * Among people with the same completion count,
   * the person who completed longest ago comes first.
   */
  if (
    aCompletedAt !== null &&
    bCompletedAt !== null &&
    aCompletedAt !== bCompletedAt
  ) {
    return aCompletedAt - bCompletedAt;
  }

  const aAssignedAt =
    a.rotationMember.lastAssignedAt
      ? new Date(
          a.rotationMember.lastAssignedAt
        ).getTime()
      : null;

  const bAssignedAt =
    b.rotationMember.lastAssignedAt
      ? new Date(
          b.rotationMember.lastAssignedAt
        ).getTime()
      : null;

  if (
    aAssignedAt === null &&
    bAssignedAt !== null
  ) {
    return -1;
  }

  if (
    aAssignedAt !== null &&
    bAssignedAt === null
  ) {
    return 1;
  }

  if (
    aAssignedAt !== null &&
    bAssignedAt !== null &&
    aAssignedAt !== bAssignedAt
  ) {
    return aAssignedAt - bAssignedAt;
  }

  return String(
    a.rotationMember.normalizedName || ""
  ).localeCompare(
    String(
      b.rotationMember.normalizedName || ""
    )
  );
}

async function loadRankedCandidates({
  tx,
  matchId,
  leagueId,
  teamId,
  rotationKey,
  excludedRotationMemberIds = [],
  excludedNormalizedNames = [],
}) {
  const eligibleMatchPlayers =
    await tx.matchKitPlayer.findMany({
      where: {
        matchId,
        leagueId,
        teamId,
        isConfirmed: true,
        isEligible: true,
      },

      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          id: "asc",
        },
      ],
    });

  if (eligibleMatchPlayers.length === 0) {
    return [];
  }

  const eligibleNames =
    eligibleMatchPlayers.map(
      (player) => player.normalizedName
    );

  const matchPlayerByName = new Map(
    eligibleMatchPlayers.map((player) => [
      player.normalizedName,
      player,
    ])
  );

  const rotationMembers =
    await tx.kitRotationMember.findMany({
      where: {
        leagueId,
        rotationKey,
        isActive: true,

        normalizedName: {
          in: eligibleNames,
          notIn:
            excludedNormalizedNames.length > 0
              ? excludedNormalizedNames
              : undefined,
        },

        id: {
          notIn:
            excludedRotationMemberIds.length >
            0
              ? excludedRotationMemberIds
              : undefined,
        },
      },
    });

  return rotationMembers
    .map((rotationMember) => ({
      rotationMember,

      matchKitPlayer:
        matchPlayerByName.get(
          rotationMember.normalizedName
        ) || null,
    }))
    .filter(
      (candidate) =>
        candidate.matchKitPlayer !== null
    )
    .sort(compareCandidates);
}

export async function suggestKitCarriers({
  tx,
  match,
  teamARotationKey,
  teamBRotationKey,
  excludedAssignmentIds = [],
}) {
  const excludedAssignments =
    excludedAssignmentIds.length > 0
      ? await tx.kitAssignment.findMany({
          where: {
            id: {
              in: excludedAssignmentIds,
            },
          },

          select: {
            rotationMemberId: true,

            rotationMember: {
              select: {
                normalizedName: true,
              },
            },
          },
        })
      : [];

  const excludedRotationMemberIds =
    excludedAssignments.map(
      (assignment) =>
        assignment.rotationMemberId
    );

  const excludedNormalizedNames =
    excludedAssignments
      .map(
        (assignment) =>
          assignment.rotationMember
            ?.normalizedName
      )
      .filter(Boolean);

  const teamACandidates =
    await loadRankedCandidates({
      tx,
      matchId: match.id,
      leagueId: match.leagueId,
      teamId: match.teamAId,
      rotationKey: teamARotationKey,
      excludedRotationMemberIds,
      excludedNormalizedNames,
    });

  if (teamACandidates.length === 0) {
    throw new Error(
      `No eligible kit carrier was found for ${match.teamA.name}.`
    );
  }

  const teamASelection =
    teamACandidates[0];

  /*
   * The first selected person is excluded from
   * Team B, even in league-player mode.
   */
  const teamBCandidates =
    await loadRankedCandidates({
      tx,
      matchId: match.id,
      leagueId: match.leagueId,
      teamId: match.teamBId,
      rotationKey: teamBRotationKey,

      excludedRotationMemberIds: [
        ...excludedRotationMemberIds,
        teamASelection.rotationMember.id,
      ],

      excludedNormalizedNames: [
        ...excludedNormalizedNames,
        teamASelection.rotationMember
          .normalizedName,
      ],
    });

  if (teamBCandidates.length === 0) {
    throw new Error(
      `No eligible kit carrier was found for ${match.teamB.name}.`
    );
  }

  return {
    teamA: {
      teamId: match.teamAId,
      teamName: match.teamA.name,
      rotationMember:
        teamASelection.rotationMember,
      matchKitPlayer:
        teamASelection.matchKitPlayer,
    },

    teamB: {
      teamId: match.teamBId,
      teamName: match.teamB.name,
      rotationMember:
        teamBCandidates[0].rotationMember,
      matchKitPlayer:
        teamBCandidates[0].matchKitPlayer,
    },
  };
}