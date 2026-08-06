import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

function number(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

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

  if (
    !Number.isInteger(matchId) ||
    matchId <= 0
  ) {
    return NextResponse.json(
      { error: "Invalid match id 3" },
      { status: 400 }
    );
  }

  const match = await prisma.match.findUnique({
    where: {
      id: matchId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!match) {
    return NextResponse.json(
      { error: "Match not found" },
      { status: 404 }
    );
  }

  if (
    String(match.status || "")
      .trim()
      .toUpperCase() ===
    "COMPLETED & LOCKED"
  ) {
    return NextResponse.json(
      {
        error:
          "Match has been finalized and cannot be modified",
      },
      { status: 400 }
    );
  }

  const deletedBall =
    await prisma.ball.findFirst({
      where: {
        matchId,
      },
      orderBy: [
        {
          inningsNo: "desc",
        },
        {
          sequence: "desc",
        },
        {
          id: "desc",
        },
      ],
    });

  if (!deletedBall) {
    return NextResponse.json(
      { error: "No ball available to undo" },
      { status: 404 }
    );
  }

  /*
   * Every Ball row stores the striker, non-striker and bowler that were
   * active immediately BEFORE that delivery was applied.
   *
   * Therefore, undoing the delivery should restore these values directly.
   * Re-running applyBallOutcome() on the previous ball can lose:
   * - the selected bowler for the first ball of a new over,
   * - the exact batter state before a wicket,
   * - run-out / replacement-batter state.
   */
  const restoredState = {
    inningsNo:
      number(
        deletedBall.inningsNo
      ) || 1,

    strikerId:
      deletedBall.strikerId
        ? number(
            deletedBall.strikerId
          )
        : null,

    nonStrikerId:
      deletedBall.nonStrikerId
        ? number(
            deletedBall.nonStrikerId
          )
        : null,

    bowlerId:
      deletedBall.bowlerId
        ? number(
            deletedBall.bowlerId
          )
        : null,
  };

  const wasFirstLegalBallOfOver =
    Boolean(
      deletedBall.legalDelivery
    ) &&
    number(
      deletedBall.ballInOver
    ) === 1;

  await prisma.$transaction(
    async (tx) => {
      await tx.ball.delete({
        where: {
          id:
            deletedBall.id,
        },
      });

      await tx.matchState.upsert({
        where: {
          matchId,
        },

        update: {
          inningsNo:
            restoredState.inningsNo,

          strikerId:
            restoredState.strikerId,

          nonStrikerId:
            restoredState.nonStrikerId,

          /*
           * Important:
           * When 4.1 is undone, keep the bowler selected for over 4.
           * The scorer can immediately re-record 4.1 without another
           * Change Bowler dialog.
           */
          bowlerId:
            restoredState.bowlerId,
        },

        create: {
          matchId,

          inningsNo:
            restoredState.inningsNo,

          strikerId:
            restoredState.strikerId,

          nonStrikerId:
            restoredState.nonStrikerId,

          bowlerId:
            restoredState.bowlerId,
        },
      });

      const normalizedStatus =
        String(
          match.status ||
            ""
        )
          .trim()
          .replace(
            /[\s-]+/g,
            "_"
          )
          .toUpperCase();

      if (
        normalizedStatus ===
        "COMPLETED"
      ) {
        await tx.match.update({
          where: {
            id: matchId,
          },
          data: {
            status:
              "in_progress",
          },
        });
      }
    }
  );

  return NextResponse.json({
    success: true,

    deletedId:
      deletedBall.id,

    deletedBall: {
      id:
        deletedBall.id,

      inningsNo:
        number(
          deletedBall.inningsNo
        ),

      sequence:
        number(
          deletedBall.sequence
        ),

      overNo:
        number(
          deletedBall.overNo
        ),

      ballInOver:
        number(
          deletedBall.ballInOver
        ),

      legalDelivery:
        Boolean(
          deletedBall.legalDelivery
        ),

      strikerId:
        deletedBall.strikerId
          ? number(
              deletedBall.strikerId
            )
          : null,

      nonStrikerId:
        deletedBall.nonStrikerId
          ? number(
              deletedBall.nonStrikerId
            )
          : null,

      bowlerId:
        deletedBall.bowlerId
          ? number(
              deletedBall.bowlerId
            )
          : null,

      isWicket:
        Boolean(
          deletedBall.isWicket
        ),

      wicketType:
        deletedBall.wicketType ||
        "NONE",

      dismissedPlayerId:
        deletedBall.dismissedPlayerId
          ? number(
              deletedBall.dismissedPlayerId
            )
          : null,

      newBatterId:
        deletedBall.newBatterId
          ? number(
              deletedBall.newBatterId
            )
          : null,
    },

    restoredState,

    preserveBowlerSelection:
      wasFirstLegalBallOfOver,
  });
}
