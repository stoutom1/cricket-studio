import prisma from "@/lib/prisma";

export async function canAccessLeague(
  leagueId,
  userId
) {
  const league =
    await prisma.league.findUnique({
      where: { id: leagueId }
    });

  if (!league) {
    return false;
  }

  if (league.ownerId === userId) {
    return true;
  }

  const member =
    await prisma.leagueMember.findFirst({
      where: {
        userId,
        leagueId
      }
    });

  return !!member;
}