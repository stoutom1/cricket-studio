import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { ROLES } from "@/lib/roles";

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
console.log("I am in register league route");
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

    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        {
          error: "Invite token is required"
        },
        {
          status: 400
        }
      );
    }

    const invite = await prisma.leagueInvite.findUnique({
      where: {
        token
      },
      include: {
        league: true
      }
    });

    if (!invite) {
      return NextResponse.json(
        {
          error: "Invalid invite link"
        },
        {
          status: 404
        }
      );
    }

    const user = await prisma.user.findUnique({
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

const existingMember =
  await prisma.leagueMember.findUnique({
    where: {
      userId_leagueId: {
        userId: user.id,
        leagueId: invite.leagueId
      }
    }
  });

 // const permissions = ROLES[role] || ROLES.VIEWER;
if (!existingMember) {
await prisma.leagueMember.create({
  data: {
    userId: user.id,
    leagueId: invite.leagueId,
    role: "VIEWER"
  }
});
}

    return NextResponse.json({
      success: true,
      leagueId: invite.league.id,
      leagueName: invite.league.name
    });
  } catch (error) {
    console.error("League registration error:", error);

    return NextResponse.json(
      {
        error: "Failed to register for league"
      },
      {
        status: 500
      }
    );
  }
}