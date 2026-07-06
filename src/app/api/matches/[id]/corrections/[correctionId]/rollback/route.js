import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const { id, correctionId } = await params;

  const matchId = Number(id);
  const logId = Number(correctionId);

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const correctionType = log.correctionType || "RETIRED_HURT";

  await prisma.$transaction(async (tx) => {
    if (correctionType === "RETIRED_HURT") {
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
    }

    if (correctionType === "TRANSFER_BATTER_RUNS") {
      const changed = log.beforeJson?.changed || [];

      for (const item of changed) {
        await tx.ball.update({
          where: { id: Number(item.id) },
          data: {
            strikerId: item.strikerId,
            runsOffBat: item.runsOffBat,
            note: item.note,
          },
        });
      }
    }

    if (correctionType === "REASSIGN_OVER_BOWLER") {
      const balls = log.beforeJson?.balls || [];

      for (const item of balls) {
        await tx.ball.update({
          where: { id: Number(item.id) },
          data: {
            bowlerId: item.bowlerId,
            note: item.note,
          },
        });
      }
    }

    if (correctionType === "CHANGE_FIELDER") {
      const before = log.beforeJson;

      if (!before?.id) {
        throw new Error("Rollback data missing for fielder correction.");
      }

      await tx.ball.update({
        where: { id: Number(before.id) },
        data: {
          fielderId: before.fielderId,
          assistantFielderId: before.assistantFielderId,
          wicketNote: before.wicketNote,
          note: before.note,
        },
      });
    }

    await tx.correctionLog.update({
      where: { id: log.id },
      data: { revertedAt: new Date() },
    });
  });

  await logAudit({
    action: "SCORE_CORRECTION_ROLLED_BACK",
    entityType: "MATCH",
    entityId: matchId,
    matchId,
    actor: session.user,
    description: `Rolled back ${correctionType} correction.`,
    beforeData: log.afterJson || null,
    afterData: log.beforeJson || null,
    request,
  });

  return NextResponse.json({
    success: true,
    correctionType,
  });
}