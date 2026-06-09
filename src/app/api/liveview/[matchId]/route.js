import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  ballShortText,
  getBattingTeamId,
  summarizeInningsDetailed,
  buildMatchStats
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
      },events: {
      orderBy: {
        id: "asc"
      }
    }
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

const innings1Summary =
  summarizeInningsDetailed(
    innings1Balls,
    playerMap,
    match.oversPerInnings
  );

const innings2Summary =
  summarizeInningsDetailed(
    innings2Balls,
    playerMap,
    match.oversPerInnings
  );

const innings1MatchStats = buildMatchStats({
  ...match,
  balls: innings1Balls
});

const innings2MatchStats = buildMatchStats({
  ...match,
  balls: innings2Balls
});
const innings1TeamId = getBattingTeamId(match, 1);
const innings2TeamId = getBattingTeamId(match, 2);

const innings1TeamName =
  innings1TeamId === match.teamAId
    ? match.teamA.name
    : match.teamB.name;

const innings2TeamName =
  innings2TeamId === match.teamAId
    ? match.teamA.name
    : match.teamB.name;

const inningsData = [
  {
    number: 1,
    teamName: innings1TeamName,
    ...innings1Summary,
    battingStats: innings1MatchStats.batting,
    bowlingStats: innings1MatchStats.bowling
  },
  {
    number: 2,
    teamName: innings2TeamName,
    ...innings2Summary,
    battingStats: innings2MatchStats.batting,
    bowlingStats: innings2MatchStats.bowling
  }
];
 const currentInningsNo =
  innings2Summary.legalBalls > 0 ||
  match.status === "COMPLETED"
    ? 2
    : 1;

const currentInningsBalls = match.balls.filter(
  (b) => b.inningsNo === currentInningsNo
);

  const recentBalls = currentInningsBalls
    .slice(-12)
    .reverse()
    .map((ball) => ({
      id: ball.id,
      label: ballShortText(ball)
  }));

  const maxLegalBalls = match.oversPerInnings * 6;

  const innings1Complete =
    innings1Summary.legalBalls >= maxLegalBalls ||
    innings2Balls.length > 0;

  const target = innings1Complete
    ? innings1Summary.runs + 1
    : null;

  const remainingBalls =
  innings1Complete
    ? Math.max(
        maxLegalBalls - innings2Summary.legalBalls,
        0
      )
    : null;

      const innings2Complete =
        innings2Summary.legalBalls >= maxLegalBalls;

      const chaseCompleted =
        target &&
        innings2Summary.runs >= target;

      const maxWickets =
        match.maxWicketsPerInnings ??
        ((innings2TeamId.battingTeam?.players?.length) -1);


      const allOut =
        innings2Summary.wickets >= maxWickets;

      //const matchStatus = match.stats;  
      const isCompleted =
        innings1Complete &&
        (
          innings2Complete ||
          chaseCompleted
          // ||
          //allOut
        );

      let statusText = "Match in progress";
/*
      console.log("isCompleted", isCompleted);
      console.log("innings1Complete", innings1Complete);
      console.log("innings2Complete", innings2Complete);
      console.log("match.status", match.status);
      console.log("chaseCompleted", chaseCompleted);
      console.log("innings2Summary.runs", innings2Summary.runs);
      console.log("target", target);
      console.log("innings2TeamName", innings2TeamName);
      console.log("innings1Summary.runs", innings1Summary.runs);
*/
      if (isCompleted) {
        if (innings2Summary.runs >= target) {
          //const wicketsRemaining = maxWicketsPerInnings;
            //10 - innings2Summary.wickets;

          statusText = `${innings2TeamName} won by chasing the target`;
          //by ${wicketsRemaining} wickets`;
        } else if (
          innings2Summary.runs === innings1Summary.runs
        ) {
          statusText = "Match tied";
        } else {
          const margin =
            innings1Summary.runs -
            innings2Summary.runs;

          statusText = `${innings1TeamName} won by ${margin} runs`;
        }

 /*       // UPDATE MATCH STATUS
        await prisma.match.update({
          where: { id: match.id },
          data: {
            status: "COMPLETED",
            statusText
          }
        });
*/
        match.status = "COMPLETED";
      }else {
        match.status = "LIVE";
      }

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

  summary: {
    target,
    remainingBalls,
    statusText
  },

  innings: inningsData,

  currentInnings: currentInningsNo,

  currentState:
    innings2Summary.legalBalls > 0
      ? innings2Summary.currentState
      : innings1Summary.currentState,

  recentBalls,

  stats: buildMatchStats(match),
});
}