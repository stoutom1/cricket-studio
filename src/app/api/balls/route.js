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

  if (!payload.matchId) {
    return NextResponse.json({ error: "Match is required" }, { status: 400 });
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
    payload.batterId,
    payload.bowlerId,
    payload.dismissedPlayerId
  ].filter(Boolean);

  const players = await prisma.player.findMany({
    where: {
      id: { in: playerIds }
    }
  });

  const playerMap = new Map(players.map((p) => [p.id, p]));

  if (!playerMap.has(payload.batterId) || playerMap.get(payload.batterId).teamId !== battingTeamId) {
    return NextResponse.json({ error: "Batter must belong to batting team" }, { status: 400 });
  }

  if (!playerMap.has(payload.bowlerId) || playerMap.get(payload.bowlerId).teamId !== bowlingTeamId) {
    return NextResponse.json({ error: "Bowler must belong to bowling team" }, { status: 400 });
  }

  const dismissedPlayerId = payload.isWicket
    ? payload.dismissedPlayerId || payload.batterId
    : null;

  if (dismissedPlayerId) {
    const dismissedPlayer = await prisma.player.findUnique({
      where: { id: dismissedPlayerId }
    });

    if (!dismissedPlayer || dismissedPlayer.teamId !== battingTeamId) {
      return NextResponse.json({ error: "Dismissed player must belong to batting team" }, { status: 400 });
    }
  }

  const legalDelivery = isLegalDelivery(payload.extraType);

  const legalBallsCount = await prisma.ball.count({
    where: {
      matchId: payload.matchId,
      inningsNo: payload.inningsNo,
      legalDelivery: true
    }
  });

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

  const overNo = Math.floor(legalBallsCount / 6) + 1;
  const ballInOver = legalDelivery
    ? (legalBallsCount % 6) + 1
    : legalBallsCount % 6;

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
      batterId: payload.batterId,
      bowlerId: payload.bowlerId,
      dismissedPlayerId,
      runsOffBat: payload.runsOffBat,
      extras: payload.extras,
      extraType: payload.extraType,
      totalRuns,
      isWicket: payload.isWicket,
      wicketType: payload.isWicket ? payload.wicketType : "NONE",
      isPowerPlay,
      note: payload.note || null
    }
  });

  return NextResponse.json(ball, { status: 201 });
}