import prisma from "@/lib/prisma";

const CONTRIBUTOR_ROLES =
  new Set([
    "ADMIN",
    "CAPTAIN",
    "SCORER",
  ]);

function normalizedRole(
  value
) {
  return String(
    value ||
    "VIEWER"
  )
    .trim()
    .toUpperCase();
}

function emptyAccess() {
  return {
    exists: false,
    canView: false,

    canAdd: false,
    canEditAny: false,
    canEditOwn: false,
    canDelete: false,

    /*
     * Backward-compatible aliases used by older
     * Knowledge Center components and routes.
     */
    canAddEdit: false,
    canManage: false,

    isOwner: false,
    role: null,
    member: null,
    league: null,
  };
}

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
    return emptyAccess();
  }

  const league =
    await prisma.league
      .findUnique({
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
    return emptyAccess();
  }

  const isOwner =
    league.ownerId ===
    userId;

  const member =
    isOwner
      ? null
      : await prisma
          .leagueMember
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
              canScoreMatch:
                true,
              canManagePermissions:
                true,
            },
          });

  const isLeagueMember =
    isOwner ||
    Boolean(member);

  const role =
    isOwner
      ? "OWNER"
      : normalizedRole(
          member?.role
        );

  /*
   * Full Knowledge Center contributors:
   * - Owner
   * - Admin
   * - Captain
   * - Scorer
   *
   * They may add resources and edit any resource.
   */
  const fullContributor =
    isOwner ||
    CONTRIBUTOR_ROLES.has(
      role
    );

  /*
   * Special case:
   * A Viewer with canScoreMatch=true may contribute,
   * but may edit only resources that they created.
   */
  const viewerScorerContributor =
    role === "VIEWER" &&
    member?.canScoreMatch ===
      true;

  const canAdd =
    isLeagueMember &&
    (
      fullContributor ||
      viewerScorerContributor
    );

  const canEditAny =
    isLeagueMember &&
    fullContributor;

  const canEditOwn =
    isLeagueMember &&
    (
      fullContributor ||
      viewerScorerContributor
    );

  /*
   * Delete remains deliberately restricted:
   * - League owner; or
   * - League member with canManagePermissions=true.
   *
   * Resource ownership alone never grants delete access.
   */
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
    role,

    canView:
      isLeagueMember,

    canAdd,
    canEditAny,
    canEditOwn,
    canDelete,

    /*
     * Older code treated canAddEdit/canManage as one broad flag.
     * Preserve them as "can contribute" aliases, while new code
     * uses the granular values above.
     */
    canAddEdit:
      canAdd,

    canManage:
      canAdd,
  };
}

export function canEditLeagueResource({
  access,
  resource,
  userId,
}) {
  if (
    !access ||
    !resource ||
    !userId
  ) {
    return false;
  }

  if (
    access.canEditAny ===
    true
  ) {
    return true;
  }

  return (
    access.canEditOwn ===
      true &&
    resource.createdById ===
      userId
  );
}
