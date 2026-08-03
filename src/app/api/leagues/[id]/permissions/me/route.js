import {
  getServerSession,
} from "next-auth";
import {
  NextResponse,
} from "next/server";

import prisma from "@/lib/prisma";
import {
  authOptions,
} from "@/lib/auth";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

function emptyPermissions() {
  return {
    canViewDashboard:
      false,

    canViewManagement:
      false,

    canViewMatches:
      false,

    canViewScoring:
      false,

    canViewStats:
      false,

    canCreateLeague:
      false,

    canCreateTeam:
      false,

    canCreateMatch:
      false,

    canDeleteLeague:
      false,

    canDeleteTeam:
      false,

    canDeletePlayer:
      false,

    canDeleteMatch:
      false,

    canScoreMatch:
      false,

    canEditScore:
      false,

    canUndoBall:
      false,

    canManagePermissions:
      false,
  };
}

function ownerPermissions() {
  return {
    canViewDashboard:
      true,

    canViewManagement:
      true,

    canViewMatches:
      true,

    canViewScoring:
      true,

    canViewStats:
      true,

    canCreateLeague:
      true,

    canCreateTeam:
      true,

    canCreateMatch:
      true,

    canDeleteLeague:
      true,

    canDeleteTeam:
      true,

    canDeletePlayer:
      true,

    canDeleteMatch:
      true,

    canScoreMatch:
      true,

    canEditScore:
      true,

    canUndoBall:
      true,

    canManagePermissions:
      true,
  };
}

function memberPermissions(
  member
) {
  return {
    canViewDashboard:
      member
        ?.canViewDashboard ===
      true,

    canViewManagement:
      member
        ?.canViewManagement ===
      true,

    canViewMatches:
      member
        ?.canViewMatches ===
      true,

    canViewScoring:
      member
        ?.canViewScoring ===
      true,

    canViewStats:
      member
        ?.canViewStats ===
      true,

    canCreateLeague:
      false,

    canCreateTeam:
      member
        ?.canCreateTeam ===
      true,

    canCreateMatch:
      member
        ?.canCreateMatch ===
      true,

    canDeleteLeague:
      false,

    canDeleteTeam:
      member
        ?.canDeleteTeam ===
      true,

    canDeletePlayer:
      member
        ?.canDeletePlayer ===
      true,

    canDeleteMatch:
      member
        ?.canDeleteMatch ===
      true,

    canScoreMatch:
      member
        ?.canScoreMatch ===
      true,

    canEditScore:
      member
        ?.canEditScore ===
      true,

    canUndoBall:
      member
        ?.canUndoBall ===
      true,

    canManagePermissions:
      member
        ?.canManagePermissions ===
      true,
  };
}

export async function GET(
  request,
  {
    params,
  }
) {
  try {
    const session =
      await getServerSession(
        authOptions
      );

    if (
      !session?.user?.email
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const {
      id,
    } = await params;

    const leagueId =
      Number(id);

    if (
      !Number.isInteger(
        leagueId
      ) ||
      leagueId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid league ID",
        },
        {
          status: 400,
        }
      );
    }

    const normalizedEmail =
      String(
        session.user.email
      )
        .trim()
        .toLowerCase();

    const user =
      await prisma.user.findUnique({
        where: {
          email:
            normalizedEmail,
        },

        select: {
          id: true,
          email: true,
          name: true,
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "User not found",
        },
        {
          status: 404,
        }
      );
    }

    const league =
      await prisma.league.findUnique({
        where: {
          id:
            leagueId,
        },

        select: {
          id: true,
          name: true,
          ownerId: true,
        },
      });

    if (!league) {
      return NextResponse.json(
        {
          error:
            "League not found",
        },
        {
          status: 404,
        }
      );
    }

    const isOwner =
      league.ownerId ===
      user.id;

    if (isOwner) {
      return NextResponse.json({
        success:
          true,

        leagueId,

        leagueName:
          league.name,

        userId:
          user.id,

        role:
          "OWNER",

        isOwner:
          true,

        isMember:
          true,

        permissions:
          ownerPermissions(),
      });
    }

    const member =
      await prisma.leagueMember
        .findUnique({
          where: {
            userId_leagueId: {
              userId:
                user.id,

              leagueId,
            },
          },
        });

    if (!member) {
      return NextResponse.json(
        {
          success:
            false,

          leagueId,

          leagueName:
            league.name,

          userId:
            user.id,

          role:
            null,

          isOwner:
            false,

          isMember:
            false,

          permissions:
            emptyPermissions(),

          error:
            "You are not a member of this league.",
        },
        {
          status: 403,
        }
      );
    }

    return NextResponse.json({
      success:
        true,

      leagueId,

      leagueName:
        league.name,

      userId:
        user.id,

      role:
        member.role ||
        "MEMBER",

      isOwner:
        false,

      isMember:
        true,

      permissions:
        memberPermissions(
          member
        ),
    });
  } catch (error) {
    console.error(
      "[MY_LEAGUE_PERMISSIONS_FAILED]",
      {
        error:
          error instanceof Error
            ? error.message
            : String(
                error
              ),

        stack:
          error instanceof Error
            ? error.stack
            : null,
      }
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          "Unable to load league permissions.",

        details:
          error instanceof Error
            ? error.message
            : String(
                error
              ),
      },
      {
        status: 500,
      }
    );
  }
}