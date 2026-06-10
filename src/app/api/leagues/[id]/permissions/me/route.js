import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
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
      email: session.user.email,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId: user.id,
    },
  });

  if (!member) {
    return NextResponse.json({
      permissions: {
        canViewDashboard: true,
        canViewManagement: true,
        canViewMatches: true,
        canViewScoring: true,
        canViewStats: true,
      },
    });
  }

  return NextResponse.json({
    permissions: member,
  });
}