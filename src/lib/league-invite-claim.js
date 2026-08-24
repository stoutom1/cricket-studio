import prisma from "@/lib/prisma";
import {
  ROLE_LABELS,
  getAllowedInviteRoles,
  getRolePermissionDefaults,
  isLeagueRolePromotion,
  normalizeLeagueRole,
} from "@/lib/league-role-permissions";
import { verifyLeagueInviteToken } from "@/lib/league-invite-token";

const SUPER_ADMIN_EMAIL = "surprisecricket11@gmail.com";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export class LeagueInviteClaimError extends Error {
  constructor(message, { status = 400, code = "INVITE_ERROR" } = {}) {
    super(message);
    this.name = "LeagueInviteClaimError";
    this.status = status;
    this.code = code;
  }
}

export async function getLeagueInviteDetails(token) {
  const invite = await prisma.leagueInvite.findUnique({
    where: { token },
    include: {
      league: {
        select: {
          id: true,
          name: true,
          visibility: true,
          ownerId: true,
        },
      },
    },
  });

  if (!invite) {
    throw new LeagueInviteClaimError("Invite not found.", {
      status: 404,
      code: "INVITE_NOT_FOUND",
    });
  }

  const verified = verifyLeagueInviteToken(token);

  // Backward compatibility: generic links created before role-bound invites
  // continue to work, but only as the least-privileged Viewer role.
  if (!verified.valid && verified.reason === "INVALID_FORMAT") {
    return {
      invite,
      legacy: true,
      role: "VIEWER",
      roleLabel: ROLE_LABELS.VIEWER,
      permissions: getRolePermissionDefaults("VIEWER"),
      expiresAt: null,
      payload: null,
    };
  }

  if (!verified.valid) {
    const expired = verified.reason === "EXPIRED";
    throw new LeagueInviteClaimError(
      expired ? "This invitation has expired." : "This invitation is invalid.",
      {
        status: expired ? 410 : 400,
        code: expired ? "INVITE_EXPIRED" : "INVITE_INVALID",
      }
    );
  }

  if (Number(verified.payload.leagueId) !== Number(invite.leagueId)) {
    throw new LeagueInviteClaimError("Invite league mismatch.", {
      status: 400,
      code: "INVITE_LEAGUE_MISMATCH",
    });
  }

  return {
    invite,
    legacy: false,
    role: verified.payload.role,
    roleLabel: ROLE_LABELS[verified.payload.role] || verified.payload.role,
    permissions: getRolePermissionDefaults(verified.payload.role),
    expiresAt: new Date(Number(verified.payload.expiresAt)).toISOString(),
    payload: verified.payload,
  };
}

export async function claimLeagueInviteForUser({ token, userId, userEmail }) {
  if (!token) {
    throw new LeagueInviteClaimError("Invite token is required.", {
      status: 400,
      code: "TOKEN_REQUIRED",
    });
  }

  if (!userId) {
    throw new LeagueInviteClaimError("Complete your Cric4All profile before accepting this invitation.", {
      status: 409,
      code: "PROFILE_REQUIRED",
    });
  }

  const details = await getLeagueInviteDetails(token);
  const { invite, legacy, role, payload } = details;

  const existingMembership = await prisma.leagueMember.findUnique({
    where: {
      userId_leagueId: {
        userId,
        leagueId: invite.leagueId,
      },
    },
  });

  const requestedRole = normalizeLeagueRole(role);
  const currentRole = normalizeLeagueRole(existingMembership?.role || "VIEWER");
  const shouldPromoteExistingMember = Boolean(
    existingMembership &&
      !legacy &&
      isLeagueRolePromotion(currentRole, requestedRole)
  );

  /*
   * Existing members are never downgraded by an invite. Legacy generic links
   * also never alter an existing membership.
   *
   * A signed higher-role invite, however, is allowed to promote an existing
   * member after the inviter is revalidated below. This is what lets an
   * existing VIEWER accept a SCORER invite.
   */
  if (existingMembership && !shouldPromoteExistingMember) {
    return {
      success: true,
      alreadyMember: true,
      promoted: false,
      legacy,
      leagueId: invite.leagueId,
      leagueName: invite.league.name,
      role: existingMembership.role,
      roleLabel: ROLE_LABELS[existingMembership.role] || existingMembership.role,
      member: existingMembership,
    };
  }

  if (!legacy) {
    const inviter = await prisma.user.findUnique({
      where: { id: payload.inviterUserId },
      select: { id: true, email: true },
    });

    if (!inviter) {
      throw new LeagueInviteClaimError("The invitation issuer is no longer available.", {
        status: 403,
        code: "INVITER_UNAVAILABLE",
      });
    }

    const inviterMembership = await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId: inviter.id,
          leagueId: invite.leagueId,
        },
      },
    });

    const isInviterSuperAdmin =
      normalizeEmail(inviter.email) === normalizeEmail(SUPER_ADMIN_EMAIL);

    const inviterRole =
      invite.league.ownerId === inviter.id
        ? "OWNER"
        : inviterMembership?.role || "VIEWER";

    const allowedRolesNow = getAllowedInviteRoles({
      role: inviterRole,
      permissions: inviterMembership,
      isSuperAdmin: isInviterSuperAdmin,
    });

    if (!allowedRolesNow.includes(requestedRole)) {
      throw new LeagueInviteClaimError(
        "This invitation can no longer be used because the inviter's league access changed.",
        {
          status: 403,
          code: "INVITER_ACCESS_CHANGED",
        }
      );
    }

    if (
      requestedRole === "OWNER" &&
      !(isInviterSuperAdmin || invite.league.ownerId === inviter.id)
    ) {
      throw new LeagueInviteClaimError("This Owner invitation can no longer be used.", {
        status: 403,
        code: "OWNER_INVITE_REVOKED",
      });
    }
  }

  const rolePermissions = getRolePermissionDefaults(requestedRole);

  if (shouldPromoteExistingMember) {
    /*
     * Promotion rules:
     * - set the higher role from the signed invite;
     * - guarantee every permission required by that role;
     * - preserve any extra TRUE permissions previously granted manually;
     * - do not carry FALSE customizations that would make the promoted role
     *   unusable (for example SCORER without canScoreMatch).
     */
    const mergedPermissions = {};

    for (const [permissionName, defaultValue] of Object.entries(rolePermissions)) {
      mergedPermissions[permissionName] =
        Boolean(defaultValue) || Boolean(existingMembership[permissionName]);
    }

    const member = await prisma.leagueMember.update({
      where: { id: existingMembership.id },
      data: {
        role: requestedRole,
        ...mergedPermissions,
      },
    });

    return {
      success: true,
      alreadyMember: true,
      promoted: true,
      previousRole: currentRole,
      leagueId: invite.leagueId,
      leagueName: invite.league.name,
      role: member.role,
      roleLabel: ROLE_LABELS[member.role] || member.role,
      member,
    };
  }

  try {
    const member = await prisma.leagueMember.create({
      data: {
        userId,
        leagueId: invite.leagueId,
        role: requestedRole,
        ...rolePermissions,
      },
    });

    return {
      success: true,
      alreadyMember: false,
      legacy,
      leagueId: invite.leagueId,
      leagueName: invite.league.name,
      role: member.role,
      roleLabel: ROLE_LABELS[member.role] || member.role,
      member,
    };
  } catch (error) {
    /*
     * Idempotency / duplicate-request protection.
     *
     * In development React Strict Mode can invoke the join effect twice. Two
     * requests may therefore both observe no membership before either insert
     * commits. The first insert wins and the second receives Prisma P2002 on
     * the compound (userId, leagueId) unique key. That is not a real failure.
     * Re-read the authoritative membership and apply the same safe promotion
     * rules instead of returning HTTP 500.
     */
    if (error?.code !== "P2002") {
      throw error;
    }

    const concurrentMembership = await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId: invite.leagueId,
        },
      },
    });

    if (!concurrentMembership) {
      throw error;
    }

    const concurrentRole = normalizeLeagueRole(
      concurrentMembership.role || "VIEWER"
    );

    const shouldPromoteConcurrentMember = Boolean(
      !legacy &&
        isLeagueRolePromotion(concurrentRole, requestedRole)
    );

    if (shouldPromoteConcurrentMember) {
      const mergedPermissions = {};

      for (const [permissionName, defaultValue] of Object.entries(
        rolePermissions
      )) {
        mergedPermissions[permissionName] =
          Boolean(defaultValue) ||
          Boolean(concurrentMembership[permissionName]);
      }

      const promotedMember = await prisma.leagueMember.update({
        where: { id: concurrentMembership.id },
        data: {
          role: requestedRole,
          ...mergedPermissions,
        },
      });

      return {
        success: true,
        alreadyMember: true,
        promoted: true,
        previousRole: concurrentRole,
        legacy,
        leagueId: invite.leagueId,
        leagueName: invite.league.name,
        role: promotedMember.role,
        roleLabel:
          ROLE_LABELS[promotedMember.role] || promotedMember.role,
        member: promotedMember,
      };
    }

    return {
      success: true,
      alreadyMember: true,
      promoted: false,
      legacy,
      leagueId: invite.leagueId,
      leagueName: invite.league.name,
      role: concurrentMembership.role,
      roleLabel:
        ROLE_LABELS[concurrentMembership.role] || concurrentMembership.role,
      member: concurrentMembership,
    };
  }
}
