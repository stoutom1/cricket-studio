import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request, { params }) {
  const { id } = await params;
  const matchId = Number(id);

  const match = await prisma.match.findUnique({
    where: { id: matchId }
  });

  if (!match) {
    return NextResponse.json(
      { error: "Match not found" },
      { status: 404 }
    );
  }

  // Find the most recent ball in the match
  const latestBall = await prisma.ball.findFirst({
    where: { matchId },
    orderBy: [
      { inningsNo: "desc" },
      { sequence: "desc" }
    ]
  });

  const inningsNo = latestBall?.inningsNo ?? 1;

  const lastBall = await prisma.ball.findFirst({
    where: {
      matchId,
      inningsNo
    },
    orderBy: {
      sequence: "desc"
    }
  });

  if (!lastBall) {
    return NextResponse.json(
      { error: "No batting state found" },
      { status: 400 }
    );
  }

  const nextSequence = lastBall.sequence + 1;

await prisma.ball.create({
  data: {
    matchId,
    inningsNo,
    sequence: nextSequence,

    overNo: lastBall.overNo,
    ballInOver: lastBall.ballInOver,

    strikerId: lastBall.nonStrikerId,
    nonStrikerId: lastBall.strikerId,
    bowlerId: lastBall.bowlerId,

    legalDelivery: false,

    extraType: "SWAP_STRIKE",
    runsOffBat: 0,
    extras: 0,
    totalRuns: 0,

    isWicket: 0,
    wicketType: "NONE"
  }
});

  return NextResponse.json({
    success: true,
    inningsNo,
    strikerId: lastBall.nonStrikerId,
    nonStrikerId: lastBall.strikerId
  });
}