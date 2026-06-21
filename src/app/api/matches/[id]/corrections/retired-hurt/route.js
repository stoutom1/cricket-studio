import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { applyBallOutcome } from "@/lib/scoring";

export const runtime = "nodejs";

function correctedDismissedPlayerId(originalBall, currentPair) {
  const originalDismissedId = Number(originalBall.dismissedPlayerId || 0);

  if (!originalDismissedId) return null;

  if (originalDismissedId === Number(originalBall.strikerId)) {
    return currentPair.strikerId;
  }

  if (originalDismissedId === Number(originalBall.nonStrikerId)) {
    return currentPair.nonStrikerId;
  }

  return originalBall.dismissedPlayerId;
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const matchId = Number(id);
    const body = await request.json();

    const inningsNo = Number(body.inningsNo);
    const afterBallId = Number(body.afterBallId);
    const retiredPlayerId = Number(body.retiredPlayerId);
    const replacementPlayerId = Number(body.replacementPlayerId);

    const replacementOutBallId = Number(body.replacementOutBallId || 0);
    const newBatterAfterReplacementId = Number(
      body.newBatterAfterReplacementId || 0
    );

    if (
      !matchId ||
      !inningsNo ||
      !afterBallId ||
      !retiredPlayerId ||
      !replacementPlayerId
    ) {
      return NextResponse.json(
        { error: "Missing correction details" },
        { status: 400 }
      );
    }

    if (retiredPlayerId === replacementPlayerId) {
      return NextResponse.json(
        { error: "Replacement batter cannot be the retired hurt player." },
        { status: 400 }
      );
    }

    if (replacementOutBallId && !newBatterAfterReplacementId) {
      return NextResponse.json(
        {
          error:
            "Please select the new batter who came after the replacement batter got out.",
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const selectedBall = await tx.ball.findFirst({
          where: {
            id: afterBallId,
            matchId,
            inningsNo,
          },
        });

        if (!selectedBall) {
          throw new Error("Selected retired-hurt ball was not found.");
        }

        const afterSequence = Number(selectedBall.sequence);

        const futureBalls = await tx.ball.findMany({
          where: {
            matchId,
            inningsNo,
            sequence: { gt: afterSequence },
          },
          orderBy: { sequence: "asc" },
        });

        const pairAfterSelectedBall = applyBallOutcome(selectedBall);

        const retiredWasCurrentBatter =
          Number(pairAfterSelectedBall.strikerId) === retiredPlayerId ||
          Number(pairAfterSelectedBall.nonStrikerId) === retiredPlayerId;

        if (!retiredWasCurrentBatter) {
          throw new Error(
            "Selected retired player was not striker or non-striker after this ball. Select the actual ball where retired hurt happened."
          );
        }

        for (const ball of [...futureBalls].reverse()) {
          await tx.ball.update({
            where: { id: ball.id },
            data: {
              sequence: Number(ball.sequence) + 1,
            },
          });
        }

        const correctionBall = await tx.ball.create({
          data: {
            matchId,
            inningsNo,
            sequence: afterSequence + 1,

            strikerId: pairAfterSelectedBall.strikerId,
            nonStrikerId: pairAfterSelectedBall.nonStrikerId,
            bowlerId: selectedBall.bowlerId,

            overNo: selectedBall.overNo,
            ballInOver: selectedBall.ballInOver,

            extraType: "NONE",
            runsOffBat: 0,
            extras: 0,
            totalRuns: 0,

            legalDelivery: false,
            isWicket: 1,
            wicketType: "RETIRED_HURT",
            dismissedPlayerId: retiredPlayerId,
            newBatterId: replacementPlayerId,

            note:
              "[CORRECTION_RETIRED_HURT_REPLAY] Retired hurt correction inserted",
          },
        });

        let currentPair = applyBallOutcome(correctionBall);
        let updatedBalls = 0;
        let replacementHasBeenDismissed = false;

        for (const originalBall of futureBalls) {
          const isReplacementOutBall =
            replacementOutBallId &&
            Number(originalBall.id) === Number(replacementOutBallId);

          let nextIsWicket = Number(originalBall.isWicket || 0);
          let nextWicketType = originalBall.wicketType || "NONE";
          let nextDismissedPlayerId = correctedDismissedPlayerId(
            originalBall,
            currentPair
          );
          let nextNewBatterId = originalBall.newBatterId || null;

          const isEarlyWrongReplacementWicket =
            replacementOutBallId &&
            !replacementHasBeenDismissed &&
            !isReplacementOutBall &&
            Number(nextDismissedPlayerId) === Number(replacementPlayerId);

          if (isEarlyWrongReplacementWicket) {
            nextIsWicket = 0;
            nextWicketType = "NONE";
            nextDismissedPlayerId = null;
            nextNewBatterId = null;
          }

          if (isReplacementOutBall) {
            nextIsWicket = 1;
            nextDismissedPlayerId = replacementPlayerId;
            nextNewBatterId = newBatterAfterReplacementId;

            if (!nextWicketType || nextWicketType === "NONE") {
              nextWicketType = "OTHER";
            }

            replacementHasBeenDismissed = true;
          }

          if (
            nextDismissedPlayerId &&
            Number(nextDismissedPlayerId) === Number(nextNewBatterId)
          ) {
            throw new Error(
              "Replay stopped because dismissed player and new batter are the same. Select the correct replacement-out ball and next batter."
            );
          }

          const patchedBall = {
            ...originalBall,
            sequence: Number(originalBall.sequence) + 1,
            strikerId: currentPair.strikerId,
            nonStrikerId: currentPair.nonStrikerId,
            isWicket: nextIsWicket,
            wicketType: nextWicketType,
            dismissedPlayerId: nextDismissedPlayerId,
            newBatterId: nextNewBatterId,
          };

          await tx.ball.update({
            where: { id: originalBall.id },
            data: {
              strikerId: patchedBall.strikerId,
              nonStrikerId: patchedBall.nonStrikerId,
              isWicket: patchedBall.isWicket,
              wicketType: patchedBall.wicketType,
              dismissedPlayerId: patchedBall.dismissedPlayerId,
              newBatterId: patchedBall.newBatterId,
            },
          });

          currentPair = applyBallOutcome(patchedBall);
          updatedBalls += 1;
        }

        const log = await tx.correctionLog.create({
          data: {
            matchId,
            type: "RETIRED_HURT_FULL_REPLAY",
            correctionBallId: correctionBall.id,
            payload: {
              ...body,
              afterSequence,
              updatedBalls,
            },
            beforeBalls: futureBalls,
          },
        });

        return {
          log,
          updatedBalls,
        };
      },
      { timeout: 30000 }
    );

    return NextResponse.json({
      success: true,
      correctionId: result.log.id,
      updatedBalls: result.updatedBalls,
      message:
        "Retired hurt correction completed. Batting order replayed from the selected ball.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Correction failed" },
      { status: 400 }
    );
  }
}