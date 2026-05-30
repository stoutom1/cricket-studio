import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

import {
  ballShortText,
  getBattingTeamId,
  summarizeInningsDetailed
} from "@/lib/scoring";

export const runtime = "nodejs";

export function isMatchCompleted(
  inningsNo,
  legalBalls,
  oversPerInnings,
  wickets,
  target,
  runs
) {
  const maxBalls = oversPerInnings * 6;

  // Chase successful
  if (inningsNo === 2 && target && runs >= target) {
    return true;
  }

  // Overs completed
  if (legalBalls >= maxBalls) {
    return true;
  }

  // All out
  /*if (wickets >= 10) {
    return true;
  }*/

  return false;
}

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { matchId: matchIdParam } = await params;
  const matchId = Number(matchIdParam);

  if (Number.isNaN(matchId) || matchId <= 0) {
    return NextResponse.json(
      { error: "Invalid match id 4" },
      { status: 400 }
    );
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: { include: { players: true } },
      teamB: { include: { players: true } },
      battingFirstTeam: true,
      balls: {
        orderBy: [
          { inningsNo: "asc" },
          { sequence: "asc" }
        ]
      }
    }
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const playerMap = new Map(
    [...match.teamA.players, ...match.teamB.players].map((p) => [p.id, p])
  );

  const innings1Balls = match.balls.filter((b) => b.inningsNo === 1);
  const innings2Balls = match.balls.filter((b) => b.inningsNo === 2);

  const innings1TeamId = getBattingTeamId(match, 1);
  const innings2TeamId = getBattingTeamId(match, 2);

  const innings1TeamName = innings1TeamId === match.teamAId ? match.teamA.name : match.teamB.name;
  const innings2TeamName = innings2TeamId === match.teamAId ? match.teamA.name : match.teamB.name;

  const innings1 = summarizeInningsDetailed(innings1Balls, playerMap, match.oversPerInnings);
  const innings2 = summarizeInningsDetailed(innings2Balls, playerMap, match.oversPerInnings);

  const innings1Started = innings1Balls.length > 0;
  const maxLegalBalls = match.oversPerInnings * 6;
  //const innings2Started = innings2Balls.length > 0;
  //const innings2Started = innings2Balls.length > 0 || innings1.wickets >= match.maxWicketsPerInnings || innings1.legalBalls >= maxLegalBalls;
  const innings2Started =
  innings2Balls.length > 0 ||
  (
    match.maxWicketsPerInnings != null &&
    innings1.wickets >= match.maxWicketsPerInnings
  ) ||
  innings1.legalBalls >= maxLegalBalls;

  const innings1Complete = innings2Started;

  const target = innings1Complete ? innings1.runs + 1 : null;
  const remainingBalls = innings2Started
    ? Math.max(maxLegalBalls - innings2.legalBalls, 0)
    : null;

  let statusText = "Match in progress";

  if (!innings1Started && !innings2Started) {
    statusText = "No balls scored yet";
  } else if (!innings1Complete) {
    statusText = `${innings1TeamName} batting first`;
  } else if (target && innings2.runs >= target) {
    statusText = `${innings2TeamName} won by chasing the target`;
  } else if (target && innings2.legalBalls >= maxLegalBalls) {
    if (innings2.runs === innings1.runs) {
      statusText = "Match tied";
    } else {
      statusText = `${innings1TeamName} won by ${innings1.runs - innings2.runs} runs`;
    }
  } else if (target && innings2Started) {
    statusText = `${innings2TeamName} need ${Math.max(target - innings2.runs, 0)} runs from ${remainingBalls} balls`;
  } else if (target && !innings2Started) {
    statusText = `${innings2TeamName} need ${target} runs to win`;
  }

  const recentBalls = match.balls.slice(-12).reverse().map((ball) => ({
    id: ball.id,
    label: ballShortText(ball)
  }));

  const currentInnings = innings2Started ? 2 : 1;
  const currentState = currentInnings === 1 ? innings1.currentState : innings2.currentState;

  return NextResponse.json({
    match: {
      id: match.id,
      teamAName: match.teamA.name,
      teamBName: match.teamB.name,
      battingFirstTeamName: match.battingFirstTeam.name,
      oversPerInnings: match.oversPerInnings,
      powerplayOversInnings: match.powerplayOversInnings,
      status: match.status
    },
    innings: [
      { number: 1, teamName: innings1TeamName, ...innings1 },
      { number: 2, teamName: innings2TeamName, ...innings2 }
    ],
    currentInnings,
    currentState,
    summary: {
      target,
      remainingBalls,
      statusText
    },
    recentBalls
  });
}