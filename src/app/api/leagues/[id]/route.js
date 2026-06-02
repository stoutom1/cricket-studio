import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(
  request,
  { params }
) {
  const { id } = await params;
  const leagueId = Number(id);

  const session = await getServerSession(
    authOptions
  );

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
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

  // Protect Surprise Cricket League
  if (
    league.name === "Surprise Cricket League" &&
    session.user.email !==
      "surprisecricket11@gmail.com"
  ) {
    return NextResponse.json(
      {
        error:
          "Only Owner of this league can delete this league"
      },
      {
        status: 403
      }
    );
  }

  await prisma.league.delete({
    where: {
      id: leagueId
    }
  });

  return NextResponse.json({
    success: true
  });
}