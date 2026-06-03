import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({
    email: session?.user?.email,
    isSuperAdmin:
      isSuperAdmin(session)
  });
  }

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email
    },
    select: {
      id: true,
      email: true,
      name: true,
      activeLeagueId: true,
      activeMatchId: true
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

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    activeLeagueId: user.activeLeagueId,
    activeMatchId: user.activeMatchId
  });
}