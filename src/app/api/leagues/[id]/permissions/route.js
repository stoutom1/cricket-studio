import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const leagueId = Number(id);

    const { searchParams } = new URL(request.url);

    const memberId = Number(
      searchParams.get("memberId")
    );

    if (
      Number.isNaN(leagueId) ||
      leagueId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid league id" },
        { status: 400 }
      );
    }

    if (
      Number.isNaN(memberId) ||
      memberId <= 0
    ) {
      return NextResponse.json(
        { error: "Member id is required" },
        { status: 400 }
      );
    }

    const member =
      await prisma.leagueMember.findFirst({
        where: {
          id: memberId,
          leagueId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      member,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to load permissions",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const leagueId = Number(id);

    const body = await request.json();

    const memberId = Number(body.memberId);
    const role = body.role;

    if (
      Number.isNaN(memberId) ||
      memberId <= 0
    ) {
      return NextResponse.json(
        { error: "Member id is required" },
        { status: 400 }
      );
    }

    const updatedMember =
      await prisma.leagueMember.update({
        where: {
          id: memberId,
        },
        data: {
          role,

          canViewDashboard: body.canViewDashboard ?? false,
          canViewManagement: body.canViewManagement ?? false,
          canViewMatches: body.canViewMatches ?? false,
          canViewScoring: body.canViewScoring ?? false,
          canViewStats: body.canViewStats ?? false,

          canCreateLeague: body.canCreateLeague ?? false,
          canEditLeague: body.canEditLeague ?? false,
          canDeleteLeague: body.canDeleteLeague ?? false,

          canManageMembers: body.canManageMembers ?? false,
          canManagePermissions: body.canManagePermissions ?? false,

          canCreateTeam: body.canCreateTeam ?? false,
          canEditTeam: body.canEditTeam ?? false,
          canDeleteTeam: body.canDeleteTeam ?? false,

          canCreatePlayer: body.canCreatePlayer ?? false,
          canEditPlayer: body.canEditPlayer ?? false,
          canDeletePlayer: body.canDeletePlayer ?? false,

          canCreateMatch: body.canCreateMatch ?? false,
          canEditMatch: body.canEditMatch ?? false,
          canDeleteMatch: body.canDeleteMatch ?? false,

          canScoreMatch: body.canScoreMatch ?? false,
          canEditScore: body.canEditScore ?? false,
          canUndoBall: body.canUndoBall ?? false,
          canSwapStrike: body.canSwapStrike ?? false,
          canRetirePlayer: body.canRetirePlayer ?? false,

          canEndMatch: body.canEndMatch ?? false,
          canAbandonMatch: body.canAbandonMatch ?? false,
          canLockMatch: body.canLockMatch ?? false,

          canExportStats: body.canExportStats ?? false,
          canViewAuditLogs: body.canViewAuditLogs ?? false,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

    return NextResponse.json({
      success: true,
      member: updatedMember,
    });

  } catch (error) {
    console.error("Permission update error:", error);

    return NextResponse.json(
      { error: "Failed to update permissions" },
      { status: 500 }
    );
  }
}