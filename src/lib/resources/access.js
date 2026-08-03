import prisma from "@/lib/prisma";

function normalizedRole(value) {
  return String(value || "VIEWER")
    .trim()
    .toUpperCase();
}

export async function getLeagueResourceAccess({
  leagueId,
  userId,
}) {
  const numericLeagueId = Number(leagueId);

  if (
    !Number.isInteger(numericLeagueId) ||
    numericLeagueId <= 0 ||
    !userId
  ) {
    return {
      exists: false,
      canView: false,
      canManage: false,
      isOwner: false,
      member: null,
      league: null,
    };
  }

  const league = await prisma.league.findUnique({
    where: { id: numericLeagueId },
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
      ownerId: true,
    },
  });

  if (!league) {
    return {
      exists: false,
      canView: false,
      canManage: false,
      isOwner: false,
      member: null,
      league: null,
    };
  }

  const isOwner = league.ownerId === userId;

  const member = isOwner
    ? null
    : await prisma.leagueMember.findUnique({
        where: {
          userId_leagueId: {
            userId,
            leagueId: numericLeagueId,
          },
        },
        select: {
          role: true,
          canViewManagement: true,
          canEditLeague: true,
          canManageMembers: true,
          canManagePermissions: true,
        },
      });

  const role = normalizedRole(member?.role);
  const roleCanManage = ["ADMIN", "OWNER"].includes(role);

  return {
    exists: true,
    league,
    member,
    isOwner,
    canView: isOwner || Boolean(member),
    canManage:
      isOwner ||
      roleCanManage ||
      member?.canEditLeague === true ||
      member?.canManageMembers === true ||
      member?.canManagePermissions === true,
  };
}
