import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  summarizeInningsDetailed,
  buildMatchStats,
  ballShortText,
} from "@/lib/scoring";

export async function GET(request, { params }) {
  const { matchId: matchIdParam } = await params;
  const matchId = Number(matchIdParam);

  if (Number.isNaN(matchId)) {
    return NextResponse.json(
      { error: "Invalid match id 1" },
      { status: 400 }
    );
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: {
        include: {
          players: true,
        },
      },
      teamB: {
        include: {
          players: true,
        },
      },
      balls: {
        orderBy: {
          sequence: "asc",
        },
      },
    },
  });

  if (!match) {
    return NextResponse.json(
      { error: "Match not found" },
      { status: 404 }
    );
  }

  const playerMap = new Map();

  [
    ...(match.teamA.players || []),
    ...(match.teamB.players || []),
  ].forEach((player) => {
    playerMap.set(player.id, player);
  });

  const innings1Balls = match.balls.filter(
    (b) => b.inningsNo === 1
  );

  const innings2Balls = match.balls.filter(
    (b) => b.inningsNo === 2
  );

  const innings1 = summarizeInningsDetailed(
    innings1Balls,
    playerMap,
    match.oversPerInnings
  );

  const innings2 = summarizeInningsDetailed(
    innings2Balls,
    playerMap,
    match.oversPerInnings
  );

  const recentBalls = match.balls
    .slice(-12)
    .reverse()
    .map((ball) => ({
      id: ball.id,
      label: ballShortText(ball),
    }));

  return NextResponse.json({
    match: {
      id: match.id,
      teamAName: match.teamA.name,
      teamBName: match.teamB.name,
      battingFirstTeamId: match.battingFirstTeamId,
      oversPerInnings: match.oversPerInnings,
      powerplayOversInnings: match.powerplayOversInnings,
      status: match.status,
    },

    innings: [
      {
        number: 1,
        teamName:
          match.battingFirstTeamId === match.teamA.id
            ? match.teamA.name
            : match.teamB.name,
        ...innings1,
      },
      {
        number: 2,
        teamName:
          match.battingFirstTeamId === match.teamA.id
            ? match.teamB.name
            : match.teamA.name,
        ...innings2,
      },
    ],

    currentInnings:
      innings2.legalBalls > 0 || match.status === "COMPLETED"
        ? 2
        : 1,

    currentState:
      innings2.legalBalls > 0
        ? innings2.currentState
        : innings1.currentState,

    recentBalls,

    stats: buildMatchStats(match),
  });
}