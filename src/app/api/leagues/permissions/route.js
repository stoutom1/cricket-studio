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

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email
    }
  });

  if (!user) {
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

  const permission = await prisma.leaguePermission.findFirst({
    where: {
      leagueId,
      userId: user.id
    }
  });

  return NextResponse.json({
    permission
  });
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const leagueId = Number(id);

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

  // Only owner can modify permissions
  if (league.ownerId !== currentUser.id) {
    return NextResponse.json(
      {
        error:
          "Only league owner can manage permissions"
      },
      {
        status: 403
      }
    );
  }

  const body = await request.json();

  const targetUser = await prisma.user.findUnique({
    where: {
      email: body.email
    }
  });

  if (!targetUser) {
    return NextResponse.json(
      { error: "Target user not found" },
      { status: 404 }
    );
  }

  const permission =
    await prisma.leaguePermission.upsert({
      where: {
        leagueId_userId: {
          leagueId,
          userId: targetUser.id
        }
      },
      update: {
        role: body.role,

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

        canCreateTeams:
          body.canCreateTeams ?? false,

        canDeleteTeams:
          body.canDeleteTeams ?? false,

        canCreatePlayers:
          body.canCreatePlayers ?? false,

        canDeletePlayers:
          body.canDeletePlayers ?? false,

        canCreateMatches:
          body.canCreateMatches ?? false,

        canDeleteMatches:
          body.canDeleteMatches ?? false,

        canScoreMatches:
          body.canScoreMatches ?? false,

        canEditScore:
          body.canEditScore ?? false,

        canDeleteBalls:
          body.canDeleteBalls ?? false,

        canManageRoles:
          body.canManageRoles ?? false
      },
      create: {
        leagueId,
        userId: targetUser.id,

        role: body.role || "SCORER",

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

        canCreateTeams:
          body.canCreateTeams ?? false,

        canDeleteTeams:
          body.canDeleteTeams ?? false,

        canCreatePlayers:
          body.canCreatePlayers ?? false,

        canDeletePlayers:
          body.canDeletePlayers ?? false,

        canCreateMatches:
          body.canCreateMatches ?? false,

        canDeleteMatches:
          body.canDeleteMatches ?? false,

        canScoreMatches:
          body.canScoreMatches ?? false,

        canEditScore:
          body.canEditScore ?? false,

        canDeleteBalls:
          body.canDeleteBalls ?? false,

        canManageRoles:
          body.canManageRoles ?? false
      }
    });

  return NextResponse.json({
    success: true,
    permission
  });
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const leagueId = Number(id);

  const currentUser = await prisma.user.findUnique({
    where: {
      email: session.user.email
    }
  });

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

  if (league.ownerId !== currentUser.id) {
    return NextResponse.json(
      {
        error:
          "Only league owner can remove permissions"
      },
      {
        status: 403
      }
    );
  }

  const body = await request.json();

  const targetUser = await prisma.user.findUnique({
    where: {
      email: body.email
    }
  });

  if (!targetUser) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  await prisma.leaguePermission.deleteMany({
    where: {
      leagueId,
      userId: targetUser.id
    }
  });

  return NextResponse.json({
    success: true
  });
}