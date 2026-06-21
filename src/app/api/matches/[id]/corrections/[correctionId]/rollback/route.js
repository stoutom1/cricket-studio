import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const { id, correctionId } = await params;

  const matchId = Number(id);
  const logId = Number(correctionId);

  const log = await prisma.correctionLog.findFirst({
    where: {
      id: logId,
      matchId,
      revertedAt: null,
    },
  });

  if (!log) {
    return NextResponse.json(
      { error: "Correction not found or already rolled back" },
      { status: 404 }
    );
  }

  await prisma.$transaction(async (tx) => {
    if (log.correctionBallId) {
      await tx.ball.deleteMany({
        where: {
          id: log.correctionBallId,
          matchId,
        },
      });
    }

    const beforeBalls = Array.isArray(log.beforeBalls)
      ? log.beforeBalls
      : [];

    for (const ball of beforeBalls) {
      await tx.ball.update({
        where: { id: ball.id },
        data: {
          sequence: ball.sequence,
          strikerId: ball.strikerId,
          nonStrikerId: ball.nonStrikerId,
          bowlerId: ball.bowlerId,
          overNo: ball.overNo,
          ballInOver: ball.ballInOver,
          extraType: ball.extraType,
          runsOffBat: ball.runsOffBat,
          extras: ball.extras,
          totalRuns: ball.totalRuns,
          legalDelivery: ball.legalDelivery,
          isWicket: ball.isWicket,
          wicketType: ball.wicketType,
          dismissedPlayerId: ball.dismissedPlayerId,
          newBatterId: ball.newBatterId,
          note: ball.note,
        },
      });
    }

    await tx.correctionLog.update({
      where: { id: log.id },
      data: { revertedAt: new Date() },
    });
  });

  return NextResponse.json({ success: true });
}