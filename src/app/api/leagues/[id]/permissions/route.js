import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

function getRoleTemplate(role) {
  switch (role) {
    case "OWNER":
      return {
        role: "OWNER",

        canViewDashboard: true,
        canViewManagement: true,
        canViewMatches: true,
        canViewScoring: true,
        canViewStats: true,

        canCreateLeague: true,
        canCreateTeam: true,
        canCreateMatch: true,

        canDeleteLeague: true,
        canDeleteTeam: true,
        canDeletePlayer: true,
        canDeleteMatch: true,

        canScoreMatch: true,
        canEditScore: true,
        canUndoBall: true
      };

    case "ADMIN":
      return {
        role: "ADMIN",

        canViewDashboard: true,
        canViewManagement: true,
        canViewMatches: true,
        canViewScoring: true,
        canViewStats: true,

        canCreateLeague: true,
        canCreateTeam: true,
        canCreateMatch: true,

        canDeleteLeague: true,
        canDeleteTeam: true,
        canDeletePlayer: true,
        canDeleteMatch: true,

        canScoreMatch: true,
        canEditScore: true,
        canUndoBall: true
      };

    case "CAPTAIN":
      return {
        role: "CAPTAIN",

        canViewDashboard: true,
        canViewManagement: false,
        canViewMatches: true,
        canViewScoring: false,
        canViewStats: true,

        canCreateLeague: false,
        canCreateTeam: true,
        canCreateMatch: true,

        canDeleteLeague: false,
        canDeleteTeam: false,
        canDeletePlayer: false,
        canDeleteMatch: false,

        canScoreMatch: false,
        canEditScore: false,
        canUndoBall: false
      };

    case "SCORER":
      return {
        role: "SCORER",

        canViewDashboard: true,
        canViewManagement: false,
        canViewMatches: true,
        canViewScoring: true,
        canViewStats: true,

        canCreateLeague: false,
        canCreateTeam: false,
        canCreateMatch: false,

        canDeleteLeague: false,
        canDeleteTeam: false,
        canDeletePlayer: false,
        canDeleteMatch: false,

        canScoreMatch: true,
        canEditScore: true,
        canUndoBall: true
      };

    case "ANALYST":
      return {
        role: "ANALYST",

        canViewDashboard: true,
        canViewManagement: false,
        canViewMatches: true,
        canViewScoring: false,
        canViewStats: true,

        canCreateLeague: false,
        canCreateTeam: false,
        canCreateMatch: false,

        canDeleteLeague: false,
        canDeleteTeam: false,
        canDeletePlayer: false,
        canDeleteMatch: false,

        canScoreMatch: false,
        canEditScore: false,
        canUndoBall: false
      };

    default:
      return {
        role: "VIEWER",

        canViewDashboard: true,
        canViewManagement: false,
        canViewMatches: true,
        canViewScoring: false,
        canViewStats: true,

        canCreateLeague: false,
        canCreateTeam: false,
        canCreateMatch: false,

        canDeleteLeague: false,
        canDeleteTeam: false,
        canDeletePlayer: false,
        canDeleteMatch: false,

        canScoreMatch: false,
        canEditScore: false,
        canUndoBall: false
      };
  }
}

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const leagueId = Number(params.id);

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

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const leagueId = Number(params.id);

  const currentUser = await prisma.user.findUnique({
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

  const league = await prisma.league.findUnique({
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

  const isOwner =
    league.ownerId === currentUser.id;

  const canManage =
    isOwner ||
    currentMembership?.canManagePermissions;

  if (!canManage) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const body = await request.json();

  const targetUserId = body.userId;
  const role = body.role;

  const targetMembership =
    await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId: targetUserId,
          leagueId
        }
      }
    });

  if (!targetMembership) {
    return NextResponse.json(
      { error: "Member not found" },
      { status: 404 }
    );
  }

  if (targetUserId === league.ownerId) {
    return NextResponse.json(
      {
        error:
          "League owner permissions cannot be modified"
      },
      { status: 400 }
    );
  }

  const roleTemplate =
    getRoleTemplate(role);

  const updated =
    await prisma.leagueMember.update({
      where: {
        userId_leagueId: {
          userId: targetUserId,
          leagueId
        }
      },

      data: {
        ...roleTemplate,

        ...(body.customPermissions || {})
      }
    });

  return NextResponse.json(updated);
}