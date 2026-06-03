import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  request,
  { params }
) {
  const { token } = await params;

  const session =
    await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      {
        error: "Unauthorized"
      },
      {
        status: 401
      }
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email: session.user.email
      }
    });

  if (!user) {
    return NextResponse.json(
      {
        error: "User not found"
      },
      {
        status: 404
      }
    );
  }

  const invite =
    await prisma.leagueInvite.findUnique({
      where: {
        token
      }
    });

  if (!invite) {
    return NextResponse.json(
      {
        error: "Invalid invite"
      },
      {
        status: 404
      }
    );
  }

  const member =
    await prisma.leagueMember.upsert({
      where: {
        userId_leagueId: {
          userId: user.id,
          leagueId: invite.leagueId
        }
      },

      update: {},

      create: {
        userId: user.id,
        leagueId: invite.leagueId,
        role: invite.role || "VIEWER",

        canViewDashboard: true,
        canViewMatches: true,
        canViewStats: true
      }
    });

  console.log(
    "League member created",
    member
  );

  await prisma.user.update({
    where: {
      id: user.id
    },
    data: {
      activeLeagueId: invite.leagueId
    }
  });
await prisma.user.update({
  where: {
    id: user.id
  },
  data: {
    activeLeagueId: invite.leagueId
  }
});
  return NextResponse.json({
    success: true,
    leagueId: invite.leagueId
  });
}