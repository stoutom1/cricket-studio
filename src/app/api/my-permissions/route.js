import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session =
    await getServerSession(
      authOptions
    );

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
        email:
          session.user.email
      }
    });

  if (!user?.activeLeagueId) {
    return NextResponse.json(
      {}
    );
  }

  const permission =
    await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId: user.id,
          leagueId:
            user.activeLeagueId
        }
      }
    });

  return NextResponse.json(
    permission
  );
}