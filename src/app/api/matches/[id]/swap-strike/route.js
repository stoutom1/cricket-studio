import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request, { params }) {
  const { id } = await params;
  const matchId = Number(id);

  const state = await prisma.matchState.findUnique({
    where: { matchId }
  });

  if (!state) {
    return NextResponse.json(
      { error: "Match state not found" },
      { status: 404 }
    );
  }


  await prisma.ball.update({
  where: {
    id: lastBall.id
  },
  data: {
    strikerId: lastBall.nonStrikerId,
    nonStrikerId: lastBall.strikerId
  }
});

  await prisma.matchState.update({
    where: { matchId },
    data: {
      strikerId: state.nonStrikerId,
      nonStrikerId: state.strikerId
    }
  });

  return NextResponse.json({
    success: true,
    strikerId: state.nonStrikerId,
    nonStrikerId: state.strikerId
  });
}