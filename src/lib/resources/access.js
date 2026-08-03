import prisma from "@/lib/prisma";

export async function getLeagueResourceAccess({
  leagueId,
  userId,
}) {
  const numericLeagueId =
    Number(leagueId);

  if (
    !Number.isInteger(
      numericLeagueId
    ) ||
    numericLeagueId <= 0 ||
    !userId
  ) {
    return {
      exists: false,
      canView: false,
      canAddEdit: false,
      canDelete: false,

      /*
       * Backward-compatible alias used by older
       * Knowledge Center components.
       */
      canManage: false,

      isOwner: false,
      member: null,
      league: null,
    };
  }

  const league =
    await prisma.league.findUnique({
      where: {
        id:
          numericLeagueId,
      },

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
      canAddEdit: false,
      canDelete: false,
      canManage: false,
      isOwner: false,
      member: null,
      league: null,
    };
  }

  const isOwner =
    league.ownerId === userId;

  const member = isOwner
    ? null
    : await prisma.leagueMember
        .findUnique({
          where: {
            userId_leagueId: {
              userId,
              leagueId:
                numericLeagueId,
            },
          },

          select: {
            role: true,
            canManagePermissions:
              true,
          },
        });

  const isLeagueMember =
    isOwner ||
    Boolean(member);

  /*
   * Every league member may add and edit
   * Knowledge Center resources.
   *
   * Delete remains restricted to:
   * 1. The league owner; or
   * 2. A LeagueMember whose
   *    canManagePermissions flag is true.
   */
  const canAddEdit =
    isLeagueMember;

  const canDelete =
    isOwner ||
    member
      ?.canManagePermissions ===
      true;

  return {
    exists: true,
    league,
    member,
    isOwner,

    canView:
      isLeagueMember,

    canAddEdit,
    canDelete,

    /*
     * Retained so older callers do not break.
     * It now means add/edit permission only.
     */
    canManage:
      canAddEdit,
  };
}
