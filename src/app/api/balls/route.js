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
    where: { id: payload.matchId },
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
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

  if (isNewOver) {
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

  if (match.maxOversPerBowler) {
    const maxBallsPerBowler = match.maxOversPerBowler * 6;

    if (legalBalls >= maxBallsPerBowler) {
      return NextResponse.json(
        {
          error: `Bowler exceeded max overs limit of ${match.maxOversPerBowler}`,
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

  const ball = await prisma.ball.create({
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
    },
  });

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

const rawOversPerInnings = Number(match.oversPerInnings || 0);
const maxLegalBalls =
  rawOversPerInnings > 0 ? rawOversPerInnings * 6 : Infinity;

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

const targetReached =
  payload.inningsNo === 2 &&
  Number(innings2Runs._sum.totalRuns || 0) >=
    Number(innings1Runs._sum.totalRuns || 0) + 1;

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
      statusText: "MATCH COMPLETED",
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

return NextResponse.json(
  {
    ...ball,
    inningsEnded,
    inningsEndedReason,
    nextInningsNo,
  },
  { status: 201 }
);
}