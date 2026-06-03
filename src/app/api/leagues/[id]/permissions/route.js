import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const leagueId = Number(id);

  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: {
      joinedAt: "asc"
    }
  });

  return NextResponse.json(members);
}

export async function PATCH(request, { params }) {
  try {
    const session =
      await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const leagueId = Number(id);

    const currentUser =
      await prisma.user.findUnique({
        where: {
          email: session.user.email
        }
      });

    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const league =
      await prisma.league.findUnique({
        where: {
          id: leagueId
        }
      });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    const currentMembership =
      await prisma.leagueMember.findUnique({
        where: {
          userId_leagueId: {
            userId: currentUser.id,
            leagueId
          }
        }
      });

    const canManage =
      league.ownerId === currentUser.id ||
      currentMembership?.canManagePermissions;

    if (!canManage) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.memberId) {
      return NextResponse.json(
        {
          error: "memberId is required"
        },
        {
          status: 400
        }
      );
    }

    const member =
      await prisma.leagueMember.findUnique({
        where: {
          id: Number(body.memberId)
        }
      });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (
      member.userId === league.ownerId
    ) {
      return NextResponse.json(
        {
          error:
            "Cannot modify owner permissions"
        },
        {
          status: 400
        }
      );
    }

    const updatedMember =
      await prisma.leagueMember.update({
        where: {
          id: member.id
        },

        data: {
          canViewDashboard:
            body.canViewDashboard ?? false,

          canViewManagement:
            body.canViewManagement ?? false,

          canViewMatches:
            body.canViewMatches ?? false,

          canViewScoring:
            body.canViewScoring ?? false,

          canViewStats:
            body.canViewStats ?? false,

          canCreateTeam:
            body.canCreateTeam ?? false,

          canCreatePlayer:
            body.canCreatePlayer ?? false,

          canCreateMatch:
            body.canCreateMatch ?? false,

          canDeleteTeam:
            body.canDeleteTeam ?? false,

          canDeletePlayer:
            body.canDeletePlayer ?? false,

          canDeleteMatch:
            body.canDeleteMatch ?? false,

          canScoreMatch:
            body.canScoreMatch ?? false,

          canEditScore:
            body.canEditScore ?? false,

          canUndoBall:
            body.canUndoBall ?? false,

          canManageMembers:
            body.canManageMembers ?? false,

          canManagePermissions:
            body.canManagePermissions ??
            false,

          canEditLeague:
            body.canEditLeague ?? false,

          canEditTeam:
            body.canEditTeam ?? false,

          canEditPlayer:
            body.canEditPlayer ?? false,

          canEditMatch:
            body.canEditMatch ?? false,

          canSwapStrike:
            body.canSwapStrike ?? false,

          canRetirePlayer:
            body.canRetirePlayer ?? false,

          canExportStats:
            body.canExportStats ?? false,

          canViewAuditLogs:
            body.canViewAuditLogs ?? false
        }
      });

    return NextResponse.json({
      success: true,
      member: updatedMember
    });
  } catch (error) {
    console.error(
      "Permission update error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update permissions"
      },
      {
        status: 500
      }
    );
  }
}