import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  getBattingTeamId,
  getBowlingTeamId,
  isLegalDelivery,
  validateBallInput
} from "@/lib/scoring";

export const runtime = "nodejs";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
/*
  const payload = {
    matchId: Number(body.matchId),
    inningsNo: Number(body.inningsNo),
    batterId: Number(body.batterId),
    bowlerId: Number(body.bowlerId),
    extraType: String(body.extraType || "NONE"),
    runsOffBat: Number(body.runsOffBat),
    extras: Number(body.extras),
    isWicket: Number(body.isWicket ? 1 : 0),
    wicketType: String(body.wicketType || "NONE"),
    dismissedPlayerId: body.dismissedPlayerId ? Number(body.dismissedPlayerId) : null,
    note: body.note ? String(body.note).trim() : null
  };
*/
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
    newBatterId: body.newBatterId
      ? Number(body.newBatterId)
      : null,
    note: body.note?.trim() || null,
  };

if (
  Number.isNaN(payload.matchId) ||
  payload.matchId <= 0
) {
  return NextResponse.json(
    { error: "Match is required" },
    { status: 400 }
  );
}
if (payload.extraType === "WIDE" && payload.extras < 1) {
  payload.extras = 1;
}

if (payload.extraType === "NOBALL" && payload.extras < 1) {
  payload.extras = 1;
}
  const validationErrors = validateBallInput(payload);
  if (validationErrors.length) {
    return NextResponse.json({ error: validationErrors[0] }, { status: 400 });
  }

  const match = await prisma.match.findUnique({
    where: { id: payload.matchId }
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const battingTeamId = getBattingTeamId(match, payload.inningsNo);
  const bowlingTeamId = getBowlingTeamId(match, payload.inningsNo);

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

  const playerMap = new Map(
    players.map((p) => [p.id, p])
  );

  // striker validation
  if (
    !playerMap.has(payload.strikerId) ||
    playerMap.get(payload.strikerId).teamId !== battingTeamId
  ) {
    return NextResponse.json(
      { error: "Striker must belong to batting team" },
      { status: 400 }
    );
  }

  // non-striker validation
  if (
    !playerMap.has(payload.nonStrikerId) ||
    playerMap.get(payload.nonStrikerId).teamId !== battingTeamId
  ) {
    return NextResponse.json(
      { error: "Non-striker must belong to batting team" },
      { status: 400 }
    );
  }

  // bowler validation
  if (
    !playerMap.has(payload.bowlerId) ||
    playerMap.get(payload.bowlerId).teamId !== bowlingTeamId
  ) {
    return NextResponse.json(
      { error: "Bowler must belong to bowling team" },
      { status: 400 }
    );
  }

  const dismissedPlayerId = payload.isWicket
    ? payload.dismissedPlayerId
    : null;

  if (dismissedPlayerId) {
    const dismissedPlayer = playerMap.get(dismissedPlayerId);

    if (
      !dismissedPlayer ||
      dismissedPlayer.teamId !== battingTeamId
    ) {
      return NextResponse.json(
        { error: "Dismissed player must belong to batting team" },
        { status: 400 }
      );
    }
  }

  if (payload.newBatterId) {
    const newBatter = playerMap.get(payload.newBatterId);

    if (
      !newBatter ||
      newBatter.teamId !== battingTeamId
    ) {
      return NextResponse.json(
        { error: "New batter must belong to batting team" },
        { status: 400 }
      );
    }
  }
    if (
    payload.isWicket &&
    ["BOWLED", "CAUGHT", "LBW", "STUMPED", "HIT_WICKET", "OTHER"]
      .includes(payload.wicketType) &&
    !payload.newBatterId
  ) {
    return NextResponse.json(
      { error: "New batter is required after wicket" },
      { status: 400 }
    );
  }
    if (
    payload.newBatterId &&
    [
      payload.strikerId,
      payload.nonStrikerId,
    ].includes(payload.newBatterId)
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
      legalDelivery: true
    }
  });

  const isNewOver =
  legalBallsCount > 0 &&
  legalBallsCount % 6 === 0;

  if (isNewOver) {
    const previousOverBowler = await prisma.ball.findFirst({
      where: {
        matchId: payload.matchId,
        inningsNo: payload.inningsNo,
        legalDelivery: true
      },
      orderBy: [
        { overNo: "desc" },
        { ballInOver: "desc" }
      ],
      select: {
        bowlerId: true
      }
    });

    if (
      previousOverBowler &&
      previousOverBowler.bowlerId === payload.bowlerId
    ) {
      return NextResponse.json(
        {
          error: "Bowler cannot bowl consecutive overs"
        },
        { status: 400 }
      );
    }
  }
  const totalBallsCount = await prisma.ball.count({
    where: {
      matchId: payload.matchId,
      inningsNo: payload.inningsNo
    }
  });

  const maxLegalBalls = match.oversPerInnings * 6;

  if (legalBallsCount >= maxLegalBalls) {
    return NextResponse.json(
      { error: "This innings has already completed its overs" },
      { status: 400 }
    );
  }

  const overNo = Math.floor(legalBallsCount / 6);
  const ballInOver = (legalBallsCount % 6) + 1;

  const isPowerPlay = overNo <= match.powerplayOversInnings;
  const totalRuns = payload.runsOffBat + payload.extras;

  const ball = await prisma.ball.create({
    data: {
      matchId: payload.matchId,
      inningsNo: payload.inningsNo,
      sequence: totalBallsCount + 1,
      overNo,
      ballInOver,
      legalDelivery,
      strikerId: payload.strikerId,
      nonStrikerId: payload.nonStrikerId,
      bowlerId: payload.bowlerId,
      dismissedPlayerId,
      newBatterId: payload.newBatterId,
      runsOffBat: payload.runsOffBat,
      extras: payload.extras,
      extraType: payload.extraType,
      totalRuns,
      isWicket: payload.isWicket,
      wicketType: payload.isWicket
        ? payload.wicketType
        : "NONE",
      isPowerPlay,
      note: payload.note,
    },
  });
  return NextResponse.json(ball, { status: 201 });
}