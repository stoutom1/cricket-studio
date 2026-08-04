import prisma from "@/lib/prisma";

const DEFAULT_SUPER_ADMIN_EMAIL =
  "surprisecricket11@gmail.com";

function normalizedEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizedRole(value) {
  return String(value || "VIEWER")
    .trim()
    .toUpperCase();
}

function invalidAccess({
  error,
  status,
}) {
  return {
    allowed: false,
    canView: false,
    canManage: false,
    canViewKit: false,
    isReadOnly: true,
    isViewer: false,
    isOwner: false,
    isSuperAdmin: false,
    role: null,
    member: null,
    league: null,
    user: null,
    error,
    status,
  };
}

export async function getLeagueBirthdayAccess({
  userId,
  email,
  leagueId,
}) {
  const numericLeagueId =
    Number(leagueId);

  if (
    !Number.isInteger(
      numericLeagueId
    ) ||
    numericLeagueId <= 0
  ) {
    return invalidAccess({
      error:
        "Invalid league ID.",
      status: 400,
    });
  }

  const normalizedUserEmail =
    normalizedEmail(email);

  let user = null;

  if (userId) {
    user =
      await prisma.user
        .findUnique({
          where: {
            id:
              userId,
          },

          select: {
            id: true,
            email: true,
          },
        });
  }

  if (
    !user &&
    normalizedUserEmail
  ) {
    user =
      await prisma.user
        .findUnique({
          where: {
            email:
              normalizedUserEmail,
          },

          select: {
            id: true,
            email: true,
          },
        });
  }

  if (!user) {
    return invalidAccess({
      error:
        "You must be logged in.",
      status: 401,
    });
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
          ownerId: true,

          members: {
            where: {
              userId:
                user.id,
            },

            select: {
              id: true,
              role: true,
              canScoreMatch:
                true,
              canManagePermissions:
                true,
            },

            take: 1,
          },
        },
      });

  if (!league) {
    return invalidAccess({
      error:
        "League not found.",
      status: 404,
    });
  }

  const configuredSuperAdminEmail =
    normalizedEmail(
      process.env
        .SUPER_ADMIN_EMAIL ||
      DEFAULT_SUPER_ADMIN_EMAIL
    );

  const isSuperAdmin =
    Boolean(
      configuredSuperAdminEmail
    ) &&
    normalizedEmail(
      user.email
    ) ===
      configuredSuperAdminEmail;

  const isOwner =
    league.ownerId ===
    user.id;

  const member =
    league.members[0] ||
    null;

  const role =
    isOwner
      ? "OWNER"
      : normalizedRole(
          member?.role
        );

  const isViewer =
    role ===
    "VIEWER";

  const hasMembership =
    isOwner ||
    Boolean(member);

  /*
   * Birthday visibility:
   * - Super Admin
   * - League Owner
   * - canManagePermissions
   * - canScoreMatch
   * - every Viewer, regardless of canScoreMatch
   */
  const canView =
    isSuperAdmin ||
    isOwner ||
    (
      hasMembership &&
      (
        isViewer ||
        member
          ?.canScoreMatch ===
          true ||
        member
          ?.canManagePermissions ===
          true
      )
    );

  /*
   * Birthday mutation remains deliberately narrow.
   * A Viewer is always read-only, even if canScoreMatch=true
   * or a conflicting management flag was accidentally assigned.
   */
  const canManage =
    !isViewer &&
    (
      isSuperAdmin ||
      isOwner ||
      member
        ?.canManagePermissions ===
        true
    );

  /*
   * League Kit shortcut visibility:
   * Viewer role alone does not grant Kit visibility.
   * canScoreMatch does.
   */
  const canViewKit =
    isSuperAdmin ||
    isOwner ||
    member
      ?.canManagePermissions ===
      true ||
    member
      ?.canScoreMatch ===
      true;

  return {
    allowed:
      canView,

    canView,
    canManage,
    canViewKit,

    isReadOnly:
      canView &&
      !canManage,

    isViewer,
    isOwner,
    isSuperAdmin,
    role,
    member,
    league,
    user,

    error:
      canView
        ? null
        : "You do not have permission to view birthday events for this league.",

    status:
      canView
        ? 200
        : 403,
  };
}

export async function requireBirthdayViewer(
  options
) {
  const access =
    await getLeagueBirthdayAccess(
      options
    );

  if (!access.canView) {
    return {
      ...access,
      allowed: false,
    };
  }

  return {
    ...access,
    allowed: true,
  };
}

export async function requireBirthdayManager(
  options
) {
  const access =
    await getLeagueBirthdayAccess(
      options
    );

  if (!access.canManage) {
    return {
      ...access,
      allowed: false,

      error:
        access.canView
          ? "You have read-only birthday access. Birthday changes are restricted to the league owner, Super Admin, or a member with permission-management access."
          : access.error,

      status:
        access.canView
          ? 403
          : access.status,
    };
  }

  return {
    ...access,
    allowed: true,
  };
}
