import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET(
  request,
  { params }
) {
  const session =
    await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const leagueId = Number(params.id);

  const members =
    await prisma.leagueMember.findMany({
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

export async function POST(
  request,
  { params }
) {
  const session =
    await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const leagueId = Number(params.id);

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

  const membership =
    await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId: currentUser.id,
          leagueId
        }
      }
    });

  const canManageMembers =
    league.ownerId === currentUser.id ||
    membership?.canManageMembers;

  if (!canManageMembers) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const body = await request.json();

  const email =
    body.email?.trim()?.toLowerCase();

  const role =
    body.role || "VIEWER";

  if (!email) {
    return NextResponse.json(
      { error: "Email required" },
      { status: 400 }
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email
      }
    });

  if (!user) {
    return NextResponse.json(
      {
        error:
          "User must register before being added"
      },
      { status: 404 }
    );
  }

  const existing =
    await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId: user.id,
          leagueId
        }
      }
    });

  if (existing) {
    return NextResponse.json(
      {
        error:
          "User is already a member"
      },
      { status: 400 }
    );
  }

  const member =
    await prisma.leagueMember.create({
      data: {
        userId: user.id,
        leagueId,
        role
      }
    });

  return NextResponse.json(member);
}

export async function DELETE(
  request,
  { params }
) {
  const session =
    await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const leagueId = Number(params.id);

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

  const membership =
    await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId: currentUser.id,
          leagueId
        }
      }
    });

  const canManageMembers =
    league.ownerId === currentUser.id ||
    membership?.canManageMembers;

  if (!canManageMembers) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const { searchParams } =
    new URL(request.url);

  const userId =
    searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId required" },
      { status: 400 }
    );
  }

  if (userId === league.ownerId) {
    return NextResponse.json(
      {
        error:
          "League owner cannot be removed"
      },
      { status: 400 }
    );
  }

  await prisma.leagueMember.delete({
    where: {
      userId_leagueId: {
        userId,
        leagueId
      }
    }
  });

  return NextResponse.json({
    success: true
  });
}