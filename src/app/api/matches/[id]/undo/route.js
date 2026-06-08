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
const matchEnded = await prisma.match.findUnique({
  where: {
    id: matchId
  }
});

if (matchEnded.status === "COMPLETED_LOCKED") {
  return NextResponse.json(
    {
      error:
        "Match has been finalized and cannot be modified"
    },
    { status: 400 }
  );
}
  if (Number.isNaN(matchId) || matchId <= 0) {
    return NextResponse.json(
      { error: "Invalid match id 3" },
      { status: 400 }
    );
  }

const lastBall = await prisma.ball.findFirst({
  where: {
    matchId,
  },
  orderBy: [
    { inningsNo: "desc" },
    { sequence: "desc" },
  ],
});

const nextSequence = (lastBall?.sequence ?? 0) + 1;

  if (!lastBall) {
    return NextResponse.json(
      { error: "No ball available to undo" },
      { status: 404 }
    );
  }

  await prisma.ball.delete({
    where: { id: lastBall.id },
  });

  const match = await prisma.match.findUnique({
  where: {
    id: matchId
  },
  select: {
    id: true,
    status: true
  }
});

if (!match) {
  return NextResponse.json(
    { error: "Match not found" },
    { status: 404 }
  );
}

if (match.status === "COMPLETED") {
  await prisma.match.update({
    where: {
      id: matchId
    },
    data: {
      status: "in_progress"
    }
  });
}

  return NextResponse.json({
    success: true,
    deletedId: lastBall.id,
  });
}