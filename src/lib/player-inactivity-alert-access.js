import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superAdmin";

export async function requirePlayerInactivityAlertManager(
  leagueId
) {
  const session =
    await getServerSession(
      authOptions
    );

  if (
    !session?.user?.email
  ) {
    return {
      allowed:
        false,
      status:
        401,
      error:
        "Unauthorized.",
      session,
      user:
        null,
      league:
        null,
    };
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email:
          session.user.email,
      },
      select: {
        id:
          true,
        email:
          true,
        name:
          true,
      },
    });

  if (!user) {
    return {
      allowed:
        false,
      status:
        404,
      error:
        "User account not found.",
      session,
      user:
        null,
      league:
        null,
    };
  }

  const league =
    await prisma.league.findUnique({
      where: {
        id:
          Number(
            leagueId
          ),
      },
      select: {
        id:
          true,
        name:
          true,
        slug:
          true,
        ownerId:
          true,
      },
    });

  if (!league) {
    return {
      allowed:
        false,
      status:
        404,
      error:
        "League not found.",
      session,
      user,
      league:
        null,
    };
  }

  const superAdmin =
    isSuperAdmin(
      session
    );

  if (
    superAdmin ||
    String(
      league.ownerId ||
        ""
    ) ===
      String(
        user.id
      )
  ) {
    return {
      allowed:
        true,
      status:
        200,
      session,
      user,
      league,
      role:
        superAdmin
          ? "SUPER_ADMIN"
          : "OWNER",
    };
  }

  const membership =
    await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId:
            user.id,
          leagueId:
            Number(
              leagueId
            ),
        },
      },
      select: {
        role:
          true,
      },
    });

  if (
    String(
      membership?.role ||
        ""
    ).toUpperCase() ===
    "OWNER"
  ) {
    return {
      allowed:
        true,
      status:
        200,
      session,
      user,
      league,
      role:
        "OWNER",
    };
  }

  return {
    allowed:
      false,
    status:
      403,
    error:
      "Only the Super Admin or a league Owner can manage player inactivity alerts.",
    session,
    user,
    league,
    role:
      membership?.role ||
      null,
  };
}
