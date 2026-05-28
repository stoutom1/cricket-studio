import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const matchId = Number(id);

  if (Number.isNaN(matchId) || matchId <= 0) {
    return NextResponse.json(
      { error: "Invalid match id 3" },
      { status: 400 }
    );
  }

  const lastBall = await prisma.ball.findFirst({
    where: { matchId },
    orderBy: [
      { inningsNo: "desc" },
      { sequence: "desc" },
      { id: "desc" },
    ],
  });

  if (!lastBall) {
    return NextResponse.json(
      { error: "No ball available to undo" },
      { status: 404 }
    );
  }

  await prisma.ball.delete({
    where: { id: lastBall.id },
  });

  return NextResponse.json({
    success: true,
    deletedId: lastBall.id,
  });
}