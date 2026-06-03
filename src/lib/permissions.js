import prisma from "@/lib/prisma";

export async function getPermissions(
  email,
  leagueId
) {
  const user =
    await prisma.user.findUnique({
      where: { email }
    });

  if (!user) {
    return null;
  }

  const member =
    await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId: user.id,
          leagueId: Number(leagueId)
        }
      }
    });

  return member;
}