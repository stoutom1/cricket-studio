import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  getBattingTeamId,
  getBowlingTeamId,
  isLegalDelivery,
  validateBallInput,
  applyBallOutcome,
} from "@/lib/scoring";
import {
  detectLiveMilestonesForBall,
} from "@/lib/player-milestones";
import {
  currentAllocation,
  latestDlsState,
} from "@/lib/dls-standard";

export const runtime = "nodejs";

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const payload = {
    matchId: Number(body.matchId),
    inningsNo: Number(body.inningsNo),
    strikerId: Number(body.strikerId),
    nonStrikerId: Number(body.nonStrikerId),
    bowlerId: Number(body.bowlerId),
    extraType: String(body.extraType || "NONE"),
    runsOffBat: Number(body.runsOffBat || 0),
    extras: Number(body.extras || 0),
    isWicket: body.isWicket ? 1 : 0,
    wicketType: String(body.wicketType || "NONE"),
    dismissedPlayerId: body.dismissedPlayerId
      ? Number(body.dismissedPlayerId)
      : null,
    newBatterId: body.newBatterId ? Number(body.newBatterId) : null,
    endInningsAfterWicket: Boolean (body.endInningsAfterWicket),
    note: body.note?.trim() || null,
    matchStatus: String(body.matchStatus || ""),
    fielderId: body.fielderId ? Number(body.fielderId) : null,
    assistantFielderId: body.assistantFielderId
      ? Number(body.assistantFielderId)
      : null,
    wicketNote: body.wicketNote || null,

    // Offline scoring metadata. These are optional for normal online scoring.
    clientEventId: String(body.clientEventId || "").trim() || null,
    clientDeviceId: String(body.clientDeviceId || "").trim() || null,
    clientCreatedAt: body.clientCreatedAt ? new Date(body.clientCreatedAt) : null,
    expectedPreviousSequence:
      Number.isInteger(Number(body.expectedPreviousSequence))
        ? Number(body.expectedPreviousSequence)
        : null,
  };

  if (!Number.isInteger(payload.matchId) || payload.matchId <= 0) {
    return NextResponse.json({ error: "Match is required" }, { status: 400 });
  }

  if (payload.extraType === "WIDE" && payload.extras < 1) {
    payload.extras = 1;
  }

  if (payload.extraType === "NOBALL" && payload.extras < 1) {
    payload.extras = 1;
  }
const endInningsAfterWicket = Boolean(payload.endInningsAfterWicket);

  const validationErrors = validateBallInput(payload);

  if (validationErrors.length) {
    return NextResponse.json({ error: validationErrors[0] }, { status: 400 });
  }

  const match = await prisma.match.findUnique({
    where: {
      id: payload.matchId,
    },
    include: {
      /*
       * DLS revisions are persisted as MatchEvent rows. Ball scoring must
       * read them so the server—not just the browser—knows the active revised
       * innings allocation and target.
       */
      events: {
        where: {
          eventType: {
            in: [
              "DLS_INTERRUPTION",
              "DLS_OFFICIAL_OVERRIDE",
              "DLS_RESULT",
            ],
          },
        },
        orderBy: {
          id: "asc",
        },
      },

      /*
       * Team names are needed only to persist an accurate authoritative
       * DLS-aware result in match.statusText when the revised chase finishes.
       */
      teamA: {
        select: {
          id: true,
          name: true,
        },
      },

      teamB: {
        select: {
          id: true,
          name: true,
        },
      },

      battingFirstTeam: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  /*
   * IDEMPOTENCY FIRST.
   * If the server saved an offline event but the client lost the HTTP response,
   * retrying the same clientEventId must return the existing ball instead of
   * inserting a duplicate delivery.
   */
  if (payload.clientEventId) {
    const existingOfflineBall = await prisma.ball.findUnique({
      where: { clientEventId: payload.clientEventId },
    });

    if (existingOfflineBall) {
      return NextResponse.json(
        {
          ...existingOfflineBall,
          idempotentReplay: true,
        },
        { status: 200 }
      );
    }
  }

  /*
   * OFFLINE CONFLICT GUARD.
   * The first queued event remembers which server sequence it was based on.
   * If another scorer added/removed a delivery while this device was offline,
   * stop before applying the queued event.
   */
  if (payload.expectedPreviousSequence !== null) {
    const latestServerBall = await prisma.ball.findFirst({
      where: {
        matchId: payload.matchId,
        inningsNo: payload.inningsNo,
      },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });

    const serverSequence = Number(latestServerBall?.sequence || 0);

    if (serverSequence !== payload.expectedPreviousSequence) {
      return NextResponse.json(
        {
          error: "OFFLINE_SYNC_CONFLICT",
          code: "OFFLINE_SYNC_CONFLICT",
          message:
            "The match changed on the server while this device was offline. Review the server score before continuing sync.",
          expectedPreviousSequence: payload.expectedPreviousSequence,
          serverSequence,
          matchId: payload.matchId,
          inningsNo: payload.inningsNo,
        },
        { status: 409 }
      );
    }
  }

  const currentState = await prisma.matchState.findUnique({
    where: { matchId: payload.matchId },
  });

  const ballsInInnings = await prisma.ball.count({
    where: {
      matchId: payload.matchId,
      inningsNo: payload.inningsNo,
    },
  });

  if (ballsInInnings > 0 && currentState) {
    payload.strikerId = currentState.strikerId;
    payload.nonStrikerId = currentState.nonStrikerId;
  }

  const battingTeamId = getBattingTeamId(match, payload.inningsNo);
  const bowlingTeamId = getBowlingTeamId(match, payload.inningsNo);

  const battingTeamPlayers = await prisma.player.findMany({
    where: { teamId: battingTeamId },
    select: { id: true, name: true },
  });

  const balls = await prisma.ball.findMany({
    where: { matchId: payload.matchId },
  });

  const inningsBalls = balls.filter(
    (b) => Number(b.inningsNo) === Number(payload.inningsNo)
  );

  const wicketCount = inningsBalls.filter(
    (b) => b.isWicket && b.wicketType !== "RETIRED_HURT"
  ).length;

const rawMaxWickets = Number(match.maxWicketsPerInnings || 0);

const maxWickets =
  rawMaxWickets > 0 ? rawMaxWickets : Infinity;

  if (
    maxWickets !== null &&
    maxWickets !== undefined &&
    wicketCount >= Number(maxWickets)
  ) {
    return NextResponse.json(
      { error: "Maximum wickets reached for this innings" },
      { status: 400 }
    );
  }

  const isRetiredHurt = payload.wicketType === "RETIRED_HURT";

  const isCountingWicket =
    payload.isWicket && payload.wicketType !== "RETIRED_HURT";

  const unavailableBatterIds = new Set();

inningsBalls.forEach((b) => {
  if (
    b.dismissedPlayerId &&
    b.wicketType !== "RETIRED_HURT"
  ) {
    unavailableBatterIds.add(Number(b.dismissedPlayerId));
  }
});

  const dismissedThisBallId = payload.dismissedPlayerId
    ? Number(payload.dismissedPlayerId)
    : null;

  const unavailableAfterThisBall = new Set(unavailableBatterIds);

if (isCountingWicket && dismissedThisBallId) {
  unavailableAfterThisBall.add(dismissedThisBallId);
}

  const availableNewBatters = battingTeamPlayers.filter((p) => {
    const id = Number(p.id);

    return (
      id !== Number(payload.strikerId) &&
      id !== Number(payload.nonStrikerId) &&
      !unavailableAfterThisBall.has(id)
    );
  });

  const noMoreBattersAvailable =
    isCountingWicket && availableNewBatters.length === 0;

  const isFinalAllowedWicket =
    isCountingWicket &&
    maxWickets !== null &&
    maxWickets !== undefined &&
    wicketCount + 1 >= Number(maxWickets);

  const playerIds = [
    payload.strikerId,
    payload.nonStrikerId,
    payload.bowlerId,
    payload.dismissedPlayerId,
    payload.newBatterId,
  ].filter(Boolean);

  const players = await prisma.player.findMany({
    where: {
      id: { in: playerIds },
    },
  });

  const playerMap = new Map(players.map((p) => [p.id, p]));

  if (
    !playerMap.has(payload.strikerId) ||
    playerMap.get(payload.strikerId).teamId !== battingTeamId
  ) {
    return NextResponse.json(
      { error: "Striker must belong to batting team" },
      { status: 400 }
    );
  }

  if (
    !playerMap.has(payload.nonStrikerId) ||
    playerMap.get(payload.nonStrikerId).teamId !== battingTeamId
  ) {
    return NextResponse.json(
      { error: "Non-striker must belong to batting team" },
      { status: 400 }
    );
  }

  if (
    !playerMap.has(payload.bowlerId) ||
    playerMap.get(payload.bowlerId).teamId !== bowlingTeamId
  ) {
    return NextResponse.json(
      { error: "Bowler must belong to bowling team" },
      { status: 400 }
    );
  }

  const dismissedPlayerId =
    payload.isWicket || payload.wicketType === "RETIRED_HURT"
      ? payload.dismissedPlayerId
      : null;

  if (dismissedPlayerId) {
    const dismissedPlayer = playerMap.get(dismissedPlayerId);

    if (!dismissedPlayer || dismissedPlayer.teamId !== battingTeamId) {
      return NextResponse.json(
        { error: "Dismissed player must belong to batting team" },
        { status: 400 }
      );
    }
  }

  if (payload.newBatterId) {
    const newBatter = playerMap.get(payload.newBatterId);

    if (!newBatter || newBatter.teamId !== battingTeamId) {
      return NextResponse.json(
        { error: "New batter must belong to batting team" },
        { status: 400 }
      );
    }
  }

  if (
    payload.isWicket &&
    ["BOWLED", "CAUGHT", "LBW", "STUMPED", "HIT_WICKET", "OTHER"].includes(
      payload.wicketType
    ) &&
    !payload.newBatterId &&
    !noMoreBattersAvailable &&
    !endInningsAfterWicket &&
    !isFinalAllowedWicket
  ) {
    return NextResponse.json(
      { error: "New batter is required after wicket" },
      { status: 400 }
    );
  }

  if (
    payload.newBatterId &&
    [payload.strikerId, payload.nonStrikerId].includes(payload.newBatterId)
  ) {
    return NextResponse.json(
      { error: "New batter must not already be at the crease" },
      { status: 400 }
    );
  }

  const legalDelivery = isLegalDelivery(payload.extraType);

  const legalBallsCount = await prisma.ball.count({
    where: {
      matchId: payload.matchId,
      inningsNo: payload.inningsNo,
      legalDelivery: true,
    },
  });

  const isNewOver = legalBallsCount > 0 && legalBallsCount % 6 === 0;

  /*
   * Retired Hurt is a non-delivery event. It must not be blocked by
   * consecutive-over bowler validation at an over boundary.
   */
  if (
    isNewOver &&
    !isRetiredHurt
  ) {
    const previousOverBowler = await prisma.ball.findFirst({
      where: {
        matchId: payload.matchId,
        inningsNo: payload.inningsNo,
        legalDelivery: true,
      },
      orderBy: [{ overNo: "desc" }, { ballInOver: "desc" }],
      select: { bowlerId: true },
    });

    if (previousOverBowler?.bowlerId === payload.bowlerId) {
      return NextResponse.json(
        {
          error: "BOWLER_CONSECUTIVE_OVER",
          message: "Bowler cannot bowl consecutive overs",
        },
        { status: 400 }
      );
    }
  }

  const bowlerBalls = inningsBalls.filter(
    (b) =>
      b.bowlerId === Number(payload.bowlerId) &&
      b.extraType !== "WIDE" &&
      b.extraType !== "NOBALL" &&
      b.extraType !== "RETIRED_HURT"
  );

  const legalBalls = bowlerBalls.length;

  /*
   * Retired Hurt does not consume a delivery and therefore must not be
   * rejected because the selected bowler has completed their quota.
   */
  if (
    match.maxOversPerBowler &&
    !isRetiredHurt
  ) {
    const maxBallsPerBowler =
      match.maxOversPerBowler *
      6;

    if (
      legalBalls >=
      maxBallsPerBowler
    ) {
      return NextResponse.json(
        {
          error:
            `Bowler exceeded max overs limit of ${match.maxOversPerBowler}`,
        },
        { status: 400 }
      );
    }
  }

  const lastBall = await prisma.ball.findFirst({
    where: {
      matchId: payload.matchId,
      inningsNo: payload.inningsNo,
    },
    orderBy: { sequence: "desc" },
    select: {
      sequence: true,
      overNo: true,
      ballInOver: true,
    },
  });

  const overNo = isRetiredHurt
    ? lastBall?.overNo ?? 0
    : Math.floor(legalBallsCount / 6);

  const ballInOver = isRetiredHurt
    ? lastBall?.ballInOver ?? 1
    : (legalBallsCount % 6) + 1;

  const nextSequence = (lastBall?.sequence ?? 0) + 1;

  const isPowerPlay = overNo < match.powerplayOversInnings;
  const totalRuns = payload.runsOffBat + payload.extras;

  const existingBallCount = await prisma.ball.count({
    where: { matchId: payload.matchId },
  });

  if (existingBallCount === 0) {
    await prisma.match.update({
      where: { id: payload.matchId },
      data: {
        startedAt: new Date(),
        status: "IN_PROGRESS",
      },
    });
  }

  let ball;

  try {
    ball = await prisma.ball.create({
    data: {
      matchId: payload.matchId,
      inningsNo: payload.inningsNo,
      sequence: nextSequence,
      overNo,
      ballInOver,
      legalDelivery: isRetiredHurt ? false : legalDelivery,
      strikerId: payload.strikerId,
      nonStrikerId: payload.nonStrikerId,
      bowlerId: payload.bowlerId,
      dismissedPlayerId,
      newBatterId: noMoreBattersAvailable ? null : payload.newBatterId,
      runsOffBat: isRetiredHurt ? 0 : payload.runsOffBat,
      extras: isRetiredHurt ? 0 : payload.extras,
      extraType: isRetiredHurt ? "RETIRED_HURT" : payload.extraType,
      totalRuns: isRetiredHurt ? 0 : totalRuns,
      isWicket: isRetiredHurt ? 0 : payload.isWicket,
      wicketType: payload.wicketType || "NONE",
      isPowerPlay,
      note: payload.note,
      fielderId: payload.fielderId,
      assistantFielderId: payload.assistantFielderId,
      wicketNote: payload.wicketNote,
      clientEventId: payload.clientEventId,
      clientDeviceId: payload.clientDeviceId,
      clientCreatedAt:
        payload.clientCreatedAt && !Number.isNaN(payload.clientCreatedAt.getTime())
          ? payload.clientCreatedAt
          : null,
    },
  });
  } catch (createError) {
    /*
     * A concurrent retry can race the idempotency lookup. If clientEventId
     * won the unique race, return the already-created delivery.
     */
    if (createError?.code === "P2002" && payload.clientEventId) {
      const existingOfflineBall = await prisma.ball.findUnique({
        where: { clientEventId: payload.clientEventId },
      });

      if (existingOfflineBall) {
        return NextResponse.json(
          { ...existingOfflineBall, idempotentReplay: true },
          { status: 200 }
        );
      }
    }

    if (createError?.code === "P2002") {
      return NextResponse.json(
        {
          error: "OFFLINE_SYNC_CONFLICT",
          code: "OFFLINE_SYNC_CONFLICT",
          message: "Another delivery was saved at the same sequence. Refresh the server score before continuing.",
          matchId: payload.matchId,
          inningsNo: payload.inningsNo,
        },
        { status: 409 }
      );
    }

    throw createError;
  }

 const inningsAllOut =
  noMoreBattersAvailable || isFinalAllowedWicket;

const nextState = inningsAllOut
  ? {
      strikerId: payload.strikerId,
      nonStrikerId: payload.nonStrikerId,
    }
  : applyBallOutcome(ball);

await prisma.matchState.upsert({
  where: { matchId: payload.matchId },
  update: {
    inningsNo: payload.inningsNo,
    strikerId: nextState.strikerId,
    nonStrikerId: nextState.nonStrikerId,
    bowlerId: payload.bowlerId,
  },
  create: {
    matchId: payload.matchId,
    inningsNo: payload.inningsNo,
    strikerId: nextState.strikerId,
    nonStrikerId: nextState.nonStrikerId,
    bowlerId: payload.bowlerId,
  },
});

/*
 * ACTIVE INNINGS ALLOCATION
 * =========================
 * Normally this is match.oversPerInnings.
 *
 * After a rain/DLS revision, currentAllocation() returns the latest revised
 * allocation stored in MatchEvent. This is critical: an 8-over DLS chase
 * must finish at 8.0, not continue toward the original 20.0.
 */
const activeOversPerInnings =
  Number(
    currentAllocation(
      match,
      payload.inningsNo
    ) ||
    match.oversPerInnings ||
    0
  );

const maxLegalBalls =
  activeOversPerInnings > 0
    ? Math.round(
        activeOversPerInnings *
          6
      )
    : Infinity;

const updatedLegalBallsCount =
  !isRetiredHurt && legalDelivery
    ? legalBallsCount + 1
    : legalBallsCount;

const updatedWicketCount =
  isCountingWicket ? wicketCount + 1 : wicketCount;

const inningsEndedByOvers =
  Number.isFinite(maxLegalBalls) &&
  updatedLegalBallsCount >= maxLegalBalls;

const inningsEndedByWickets =
  Number.isFinite(maxWickets) &&
  updatedWicketCount >= maxWickets;

let inningsEnded =
  inningsEndedByOvers ||
  endInningsAfterWicket ||
  inningsEndedByWickets ||
  noMoreBattersAvailable;

let nextInningsNo = payload.inningsNo;

const innings1Runs = await prisma.ball.aggregate({
  where: {
    matchId: payload.matchId,
    inningsNo: 1,
  },
  _sum: { totalRuns: true },
});

const innings2Runs = await prisma.ball.aggregate({
  where: {
    matchId: payload.matchId,
    inningsNo: 2,
  },
  _sum: { totalRuns: true },
});

/*
 * ACTIVE CHASE TARGET
 * ===================
 * The old code always used:
 *
 *   first innings runs + 1
 *
 * That is wrong once DLS has revised the chase.
 *
 * latestDlsState(match) reads the MatchEvent history. If the latest active
 * DLS state supplies a positive target for innings 2, that target becomes the
 * authoritative server target. Otherwise preserve normal cricket behavior.
 */
const latestDls =
  latestDlsState(
    match
  );

const normalTarget =
  Number(
    innings1Runs
      ._sum
      .totalRuns ||
    0
  ) +
  1;

const dlsTarget =
  Number(
    latestDls
      ?.inningsNo === 2
      ? latestDls
          ?.target
      : 0
  );

const activeTarget =
  dlsTarget > 0
    ? dlsTarget
    : normalTarget;

const innings2Total =
  Number(
    innings2Runs
      ._sum
      .totalRuns ||
    0
  );

const targetReached =
  payload.inningsNo === 2 &&
  activeTarget > 0 &&
  innings2Total >=
    activeTarget;

/*
 * AUTHORITATIVE DLS RESULT
 * ========================
 * Reaching a revised DLS target must not fall back to the normal/original
 * first-innings result calculation elsewhere in the application.
 *
 * Persist a DLS-labelled result directly on Match.statusText so Scorer Mode,
 * Scoreboard, Completed history, live/spectator views and later reloads all
 * have one authoritative result string available.
 */
const dlsActiveForInnings2 =
  payload.inningsNo === 2 &&
  dlsTarget > 0;

const dlsMethodLabel =
  String(
    latestDls
      ?.mode ||
    ""
  )
    .trim()
    .toUpperCase() ===
  "OFFICIAL_OVERRIDE"
    ? "DLS"
    : "D/L Standard";

const firstBattingTeam =
  Number(
    match
      ?.battingFirstTeamId
  ) ===
  Number(
    match
      ?.teamAId
  )
    ? match.teamA
    : match.teamB;

const secondBattingTeam =
  Number(
    firstBattingTeam
      ?.id
  ) ===
  Number(
    match
      ?.teamAId
  )
    ? match.teamB
    : match.teamA;

const firstBattingTeamName =
  firstBattingTeam
    ?.name ||
  "Team 1";

const secondBattingTeamName =
  secondBattingTeam
    ?.name ||
  "Team 2";

let completedStatusText =
  "MATCH COMPLETED";

if (
  dlsActiveForInnings2
) {
  if (
    targetReached
  ) {
    /*
     * A successful chase is a wickets result when the competition configured
     * a finite wicket limit. For unlimited-wicket formats, avoid inventing an
     * arbitrary wickets-remaining margin.
     */
    if (
      rawMaxWickets > 0
    ) {
      const wicketsRemaining =
        Math.max(
          rawMaxWickets -
            updatedWicketCount,
          0
        );

      completedStatusText =
        wicketsRemaining > 0
          ? `${secondBattingTeamName} won by ${wicketsRemaining} wicket${
              wicketsRemaining === 1
                ? ""
                : "s"
            } (${dlsMethodLabel})`
          : `${secondBattingTeamName} won by chasing the target (${dlsMethodLabel})`;
    } else {
      completedStatusText =
        `${secondBattingTeamName} won by chasing the target (${dlsMethodLabel})`;
    }
  } else if (
    inningsEnded
  ) {
    /*
     * If the revised allocation/all-out ends before the winning target is
     * reached, the tie position for the FINAL revised chase is target - 1.
     * When Standard DLS supplied an explicit par, prefer that persisted value.
     */
    const explicitPar =
      latestDls?.par != null &&
      latestDls?.par !== "" &&
      Number.isFinite(
        Number(
          latestDls.par
        )
      )
        ? Number(
            latestDls.par
          )
        : null;

    const finalPar =
      explicitPar != null
        ? explicitPar
        : Math.max(
            activeTarget - 1,
            0
          );

    if (
      innings2Total >
      finalPar
    ) {
      const difference =
        innings2Total -
        finalPar;

      completedStatusText =
        `${secondBattingTeamName} won by ${difference} run${
          difference === 1
            ? ""
            : "s"
        } (${dlsMethodLabel})`;
    } else if (
      innings2Total ===
      finalPar
    ) {
      completedStatusText =
        `Match tied (${dlsMethodLabel})`;
    } else {
      const difference =
        finalPar -
        innings2Total;

      completedStatusText =
        `${firstBattingTeamName} won by ${difference} run${
          difference === 1
            ? ""
            : "s"
        } (${dlsMethodLabel})`;
    }
  }
}

if (payload.inningsNo === 1 && inningsEnded) {
  nextInningsNo = 2;

  await prisma.match.update({
    where: { id: payload.matchId },
    data: {
      status: "IN_PROGRESS",
      statusText: "1st innings completed",
    },
  });

  await prisma.matchState.deleteMany({
    where: { matchId: payload.matchId },
  });
}

if (
  payload.inningsNo === 2 &&
  (inningsEnded || targetReached || endInningsAfterWicket)
) {
  inningsEnded = true;

  await prisma.match.update({
    where: { id: payload.matchId },
    data: {
      status: "COMPLETED",
      endedAt: match.endedAt || new Date(),
      statusText:
        completedStatusText,
    },
  });
}
let inningsEndedReason = null;

if (inningsEndedByOvers) {
  inningsEndedReason = "OVERS_COMPLETED";
}

if (inningsEndedByWickets || noMoreBattersAvailable) {
  inningsEndedReason = "ALL_OUT";
}
/*
console.log("BALL SAVE RESULT", {
  inningsNo: payload.inningsNo,
  updatedLegalBallsCount,
  maxLegalBalls,
  updatedWicketCount,
  maxWickets,
  inningsEnded,
  inningsEndedReason,
  nextInningsNo,
});
*/

let milestoneResult = {
  newMilestones: [],
};

if (match.leagueId) {
  try {
    milestoneResult =
      await detectLiveMilestonesForBall({
        leagueId:
          match.leagueId,

        ball: {
          ...ball,

          matchLabel:
            `Match #${payload.matchId}`,
        },
      });
  } catch (milestoneError) {
    /*
     * Milestones are noncritical to saving the delivery. A milestone failure
     * is logged, but the scoring response still returns successfully.
     */
    console.error(
      "[LIVE_MILESTONE_DETECTION_FAILED]",
      milestoneError
    );
  }
}

return NextResponse.json(
  {
    ...ball,
    inningsEnded,
    inningsEndedReason,
    nextInningsNo,

    /*
     * These values are additive response metadata only. Existing clients can
     * ignore them, while the scorer/debugger can verify which server target
     * and allocation actually governed this delivery.
     */
    activeTarget:
      payload.inningsNo === 2
        ? activeTarget
        : null,

    activeOversPerInnings,

    dlsActive:
      Boolean(
        latestDls &&
        (
          Number(
            latestDls
              ?.target ||
            0
          ) > 0 ||
          Number(
            latestDls
              ?.revisedOvers ||
            0
          ) > 0
        )
      ),

    dlsMethodLabel:
      dlsActiveForInnings2
        ? dlsMethodLabel
        : null,

    completedStatusText:
      inningsEnded ||
      targetReached
        ? completedStatusText
        : null,

    milestones:
      milestoneResult.newMilestones.map(
        (milestone) => ({
          id:
            milestone.id,

          playerId:
            milestone.representativePlayerId,

          playerName:
            milestone.playerName,

          title:
            milestone.title,

          description:
            milestone.description,

          icon:
            milestone.icon,

          matchId:
            milestone.matchId,

          achievedAt:
            milestone.achievedAt,
        })
      ),
  },
  { status: 201 }
);
}