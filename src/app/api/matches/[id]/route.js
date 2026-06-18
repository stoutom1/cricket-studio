import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const matchId = Number(id);
    if (!matchId || Number.isNaN(matchId)) {
    return NextResponse.json(
      { error: "Invalid match id" },
      { status: 400 }
    );
  }
  if (!id) {
    return NextResponse.json({ error: "Invalid match id" }, { status: 400 });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
 include: {
  teamA: {
    include: {
      league: true,
      players: {
        orderBy: { name: "asc" }
      }
    }
  },

  teamB: {
    include: {
      league: true,
      players: {
        orderBy: { name: "asc" }
      }
    }
  },

  battingFirstTeam: true,

  balls: {
    orderBy: [
      { inningsNo: "asc" },
      { sequence: "asc" },
      { id: "asc" }
    ],
  },
}
  });

 
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json(match);
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

  const { id } = await params;
  const matchId = Number(id);

  const match =
    await prisma.match.findUnique({
      where: {
        id: matchId
      }
    });

  if (!match) {
    return NextResponse.json(
      { error: "Match not found" },
      { status: 404 }
    );
  }

  const permissions =
    await getPermissions(
      session.user.email,
      match.leagueId
    );

  if (!permissions?.canDeleteMatch) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }
  await prisma.matchState.deleteMany({
    where: {
      matchId: matchId
    }
  });

  await prisma.match.delete({
    where: {
      id: matchId
    }
  });

  return NextResponse.json({
    success: true
  });
}