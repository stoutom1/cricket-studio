import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["OWNER", "ADMIN"]);

export async function requireBirthdayManager({
  userId,
  leagueId,
}) {
  if (!userId) {
    return {
      allowed: false,
      status: 401,
      error: "Authentication required.",
    };
  }

  if (!Number.isInteger(leagueId) || leagueId <= 0) {
    return {
      allowed: false,
      status: 400,
      error: "Invalid league ID.",
    };
  }

  /*
   * IMPORTANT:
   * Replace leagueMember with your actual league-membership model.
   * Replace userId, leagueId and role with your real field names.
   */
  const membership = await prisma.leagueMember.findFirst({
    where: {
      userId,
      leagueId,
      role: {
        in: ["OWNER", "ADMIN"],
      },
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!membership || !ALLOWED_ROLES.has(membership.role)) {
    return {
      allowed: false,
      status: 403,
      error: "Only the league owner or an administrator can manage birthdays.",
    };
  }

  return {
    allowed: true,
    membership,
  };
}