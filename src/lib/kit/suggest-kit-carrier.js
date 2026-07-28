export async function suggestKitCarrierForTeam({
  prisma,
  matchId,
  teamId,
  excludedRotationMemberIds = [],
}) {
  const eligibleMatchPlayers =
    await prisma.matchKitPlayer.findMany({
      where: {
        matchId,
        teamId,
        isConfirmed: true,
        isEligible: true,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

  if (!eligibleMatchPlayers.length) {
    throw new Error(
      "No confirmed eligible players were found for this team."
    );
  }

  const normalizedNames =
    eligibleMatchPlayers.map(
      (player) => player.normalizedName
    );

  const rotationMembers =
    await prisma.teamKitRotationMember.findMany({
      where: {
        teamId,
        normalizedName: {
          in: normalizedNames,
        },
        isActive: true,
        id: {
          notIn: excludedRotationMemberIds.map(Number),
        },
      },
    });

  if (!rotationMembers.length) {
    throw new Error(
      "No eligible kit rotation members were found."
    );
  }

  const sortedMembers = [...rotationMembers].sort(
    (a, b) => {
      if (a.completedCount !== b.completedCount) {
        return a.completedCount - b.completedCount;
      }

      if (!a.lastCompletedAt && b.lastCompletedAt) {
        return -1;
      }

      if (a.lastCompletedAt && !b.lastCompletedAt) {
        return 1;
      }

      if (a.lastCompletedAt && b.lastCompletedAt) {
        const dateDifference =
          new Date(a.lastCompletedAt).getTime() -
          new Date(b.lastCompletedAt).getTime();

        if (dateDifference !== 0) {
          return dateDifference;
        }
      }

      if (!a.lastAssignedAt && b.lastAssignedAt) {
        return -1;
      }

      if (a.lastAssignedAt && !b.lastAssignedAt) {
        return 1;
      }

      if (a.lastAssignedAt && b.lastAssignedAt) {
        const assignmentDifference =
          new Date(a.lastAssignedAt).getTime() -
          new Date(b.lastAssignedAt).getTime();

        if (assignmentDifference !== 0) {
          return assignmentDifference;
        }
      }

      return a.id - b.id;
    }
  );

  const suggestedMember = sortedMembers[0];

  const matchPlayer = eligibleMatchPlayers.find(
    (player) =>
      player.normalizedName ===
      suggestedMember.normalizedName
  );

  return {
    rotationMember: suggestedMember,
    matchPlayer,
    reason:
      suggestedMember.completedCount === 0
        ? "This player has not completed kit responsibility for this team."
        : `This player has the fewest completed turns for this team and has been waiting the longest.`,
  };
}