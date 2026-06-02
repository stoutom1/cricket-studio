import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function POST(req) {
  const session = await getServerSession(
    authOptions
  );

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();

const activeLeagueId =
  body.activeLeagueId === "" ||
  body.activeLeagueId == null
    ? null
    : Number(body.activeLeagueId);

const activeMatchId =
  body.activeMatchId === "" ||
  body.activeMatchId == null
    ? null
    : Number(body.activeMatchId);

const user = await prisma.user.update({
  where: {
    email: session.user.email
  },
  data: {
    activeLeagueId,
    activeMatchId
  }
});

  return NextResponse.json({
    success: true,
    activeLeagueId: user.activeLeagueId,
    activeMatchId: user.activeMatchId
  });
}