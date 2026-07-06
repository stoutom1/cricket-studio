import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

import {
  ballShortText,
  getBattingTeamId,
  summarizeInningsDetailed,
  buildMatchStats,
  getPlayerName
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
    },

    events: {
      orderBy: {
        id: "asc"
      }
    }
  }
});

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

function formatBallOver(legalBallsBeforeThisBall, isLegalDelivery) {
  const overNo = Math.floor(legalBallsBeforeThisBall / 6);
  const ballNo = (legalBallsBeforeThisBall % 6) + 1;

  if (!isLegalDelivery) {
    return `${overNo}.${ballNo}`;
  }

  return `${overNo}.${ballNo}`;
}

function formatOversFromBalls(balls) {
  const overs = Math.floor(Number(balls || 0) / 6);
  const rem = Number(balls || 0) % 6;
  return `${overs}.${rem}`;
}

function runsChargedToBowler(ball) {
  if (
    ball.extraType === "BYE" ||
    ball.extraType === "LEGBYE"
  ) {
    return 0;
  }

  return (
    Number(ball.runsOffBat || 0) +
    Number(ball.extras || 0)
  );
}

function wicketsForBowler(ball) {
  if (!ball.isWicket) {
    return 0;
  }

  if (
    ball.wicketType === "RUN_OUT" ||
    ball.wicketType === "RETIRED_OUT" ||
    ball.wicketType === "RETIRED_HURT"
  ) {
    return 0;
  }

  if (ball.extraType === "NOBALL") {
    return 0;
  }

  return 1;
}

function buildCommentary(match) {
  const playerMap = new Map(
    [
      ...(match.teamA?.players || []),
      ...(match.teamB?.players || [])
    ].map((p) => [Number(p.id), p.name])
  );

  const batterStats = new Map();
  const bowlerStats = new Map();
function getBadgeForBall(ball, overLabel) {
  if (ball.wicketType === "RETIRED_HURT") {
    return {
      badge: "RH",
      badgeClass: "retired-pill"
    };
  }

  if (ball.isWicket && ball.wicketType !== "NONE") {
    return {
      badge: "W",
      badgeClass: "wicket-pill"
    };
  }

  if (ball.extraType === "WIDE") {
    return {
      badge: "WD",
      badgeClass: "wide-pill"
    };
  }

  if (ball.extraType === "NOBALL") {
    return {
      badge: "NB",
      badgeClass: "noball-pill"
    };
  }

  if (ball.extraType === "BYE") {
    return {
      badge: "B",
      badgeClass: "bye-pill"
    };
  }

  if (ball.extraType === "LEGBYE") {
    return {
      badge: "LB",
      badgeClass: "legbye-pill"
    };
  }

  if (Number(ball.runsOffBat || 0) === 4) {
    return {
      badge: "4",
      badgeClass: "four-pill"
    };
  }

  if (Number(ball.runsOffBat || 0) === 6) {
    return {
      badge: "6",
      badgeClass: "six-pill"
    };
  }

  return {
    badge: overLabel,
    badgeClass: ""
  };
}

function formatWicketText(ball, playerMap, strikerName, bowlerName) {
  const dismissed =
    playerMap.get(Number(ball.dismissedPlayerId)) ||
    strikerName;

  const fielder =
    playerMap.get(Number(ball.fielderId)) ||
    "fielder";

  const assistant =
    playerMap.get(Number(ball.assistantFielderId));

  switch (ball.wicketType) {
    case "BOWLED":
      return `BOWLED! ${dismissed} b ${bowlerName}.`;

    case "LBW":
      return `LBW! ${dismissed} lbw b ${bowlerName}.`;

    case "CAUGHT":
      return `CAUGHT! ${dismissed} c ${fielder} b ${bowlerName}.`;

    case "STUMPED":
      return `STUMPED! ${dismissed} st ${fielder} b ${bowlerName}.`;

    case "RUN_OUT":
      return assistant
        ? `RUN OUT! ${dismissed} run out (${fielder} / ${assistant}).`
        : `RUN OUT! ${dismissed} run out (${fielder}).`;

    case "HIT_WICKET":
      return `HIT WICKET! ${dismissed} hit wicket b ${bowlerName}.`;

    case "RETIRED_HURT":
      return `${dismissed} retired hurt.`;

    case "RETIRED_OUT":
      return `RETIRED OUT! ${dismissed} retired out.`;

    case "OTHER":
      return ball.wicketNote || `WICKET! ${dismissed} is out.`;

    default:
      return `WICKET! ${dismissed} is out.`;
  }
}
  function getBatter(id) {
    const key = Number(id);
    if (!batterStats.has(key)) {
      batterStats.set(key, {
        runs: 0,
        balls: 0
      });
    }
    return batterStats.get(key);
  }

  function getBowler(id) {
    const key = Number(id);
    if (!bowlerStats.has(key)) {
      bowlerStats.set(key, {
        balls: 0,
        runs: 0,
        wickets: 0
      });
    }
    return bowlerStats.get(key);
  }

  const inningsState = {
    1: { runs: 0, wickets: 0, legalBalls: 0, items: [] },
    2: { runs: 0, wickets: 0, legalBalls: 0, items: [] }
  };

  const ballsAsc = [...(match.balls || [])].sort(
    (a, b) =>
      Number(a.inningsNo) - Number(b.inningsNo) ||
      Number(a.sequence) - Number(b.sequence)
  );

  for (const ball of ballsAsc) {
    const inningsNo = Number(ball.inningsNo || 1);
    const inn = inningsState[inningsNo];

    const overNo = Math.floor(inn.legalBalls / 6);
    const ballNo = (inn.legalBalls % 6) + 1;
    const overLabel = `${overNo}.${ballNo}`;

    const strikerName =
      playerMap.get(Number(ball.strikerId)) || "Batter";

    const nonStrikerName =
      playerMap.get(Number(ball.nonStrikerId)) || "Non-striker";

    const bowlerName =
      playerMap.get(Number(ball.bowlerId)) || "Bowler";

    const striker = getBatter(ball.strikerId);
    const nonStriker = getBatter(ball.nonStrikerId);
    const bowler = getBowler(ball.bowlerId);

    const runsOffBat = Number(ball.runsOffBat || 0);
    const totalRuns = Number(ball.totalRuns || 0);

    inn.runs += totalRuns;

    striker.runs += runsOffBat;

    if (
      ball.extraType !== "WIDE" &&
      ball.extraType !== "NOBALL" &&
      ball.wicketType !== "RETIRED_HURT"
    ) {
      striker.balls += 1;
    }

    bowler.runs += runsChargedToBowler(ball);

    if (
      ball.legalDelivery &&
      ball.wicketType !== "RETIRED_HURT"
    ) {
      bowler.balls += 1;
    }

    if (wicketsForBowler(ball)) {
      bowler.wickets += 1;
    }

    if (
      ball.isWicket &&
      ball.wicketType !== "RETIRED_HURT"
    ) {
      inn.wickets += 1;
    }

let eventText = "";

if (ball.isWicket && ball.wicketType !== "NONE") {
  eventText = formatWicketText(
    ball,
    playerMap,
    strikerName,
    bowlerName
  );
} else if (ball.extraType === "WIDE") {
  eventText =
    totalRuns > 1
      ? `${bowlerName} to ${strikerName}, wide + ${totalRuns - 1} run(s).`
      : `${bowlerName} to ${strikerName}, wide.`;
} else if (ball.extraType === "NOBALL") {
  eventText =
    runsOffBat > 0
      ? `${bowlerName} to ${strikerName}, no-ball + ${runsOffBat} run(s) off the bat.`
      : `${bowlerName} to ${strikerName}, no-ball.`;
} else if (ball.extraType === "BYE") {
  eventText = `${bowlerName} to ${strikerName}, ${totalRuns} bye(s).`;
} else if (ball.extraType === "LEGBYE") {
  eventText = `${bowlerName} to ${strikerName}, ${totalRuns} leg-bye(s).`;
} else if (runsOffBat === 4) {
  eventText = `${bowlerName} to ${strikerName}, FOUR!`;
} else if (runsOffBat === 6) {
  eventText = `${bowlerName} to ${strikerName}, SIX!`;
} else {
  eventText = `${bowlerName} to ${strikerName}, ${runsOffBat} run(s).`;
}

const badgeInfo = getBadgeForBall(ball, overLabel);

inn.items.push({
  id: ball.id,
  type: "BALL",
  inningsNo,
  over: overLabel,
  badge: badgeInfo.badge,
  badgeClass: badgeInfo.badgeClass,
  text: eventText,
  score: `Innings ${inningsNo}: ${inn.runs}/${inn.wickets}`,
  strikerSummary: `${strikerName}: ${striker.runs} (${striker.balls})`,
  nonStrikerSummary: `${nonStrikerName}: ${nonStriker.runs} (${nonStriker.balls})`,
  bowlerSummary: `${bowlerName}: ${bowler.wickets}/${bowler.runs} in ${formatOversFromBalls(
    bowler.balls
  )}`
});
    if (ball.legalDelivery) {
      inn.legalBalls += 1;

      const isEndOfOver = inn.legalBalls % 6 === 0;

      if (isEndOfOver) {
        inn.items.push({
          id: `over-${inningsNo}-${inn.legalBalls}`,
          type: "OVER_SUMMARY",
          inningsNo,
          over: formatOversFromBalls(inn.legalBalls),
          text: `End of over ${formatOversFromBalls(
            inn.legalBalls
          )}: ${inn.runs}/${inn.wickets}`,
          score: `${strikerName}: ${striker.runs} (${striker.balls}) • ${nonStrikerName}: ${nonStriker.runs} (${nonStriker.balls})`,
          bowlerSummary: `${bowlerName}: ${bowler.wickets}/${bowler.runs} in ${formatOversFromBalls(
            bowler.balls
          )}`
        });
      }
    }
  }

  return [
    {
      inningsNo: 2,
      title: "Innings 2",
      items: inningsState[2].items.reverse()
    },
    {
      inningsNo: 1,
      title: "Innings 1",
      items: inningsState[1].items.reverse()
    }
  ].filter((section) => section.items.length > 0);
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
  const matchStats = buildMatchStats(match);
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
function getBatterStats(playerId, balls) {
  let runs = 0;
  let ballsFaced = 0;

  for (const ball of balls) {
    if (ball.strikerId === playerId) {
      runs += ball.runsOffBat;

      if (
        ball.extraType !== "WIDE"
      ) {
        ballsFaced++;
      }
    }
  }

  return {
    runs,
    balls: ballsFaced
  };
}
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
    if (match.status === "COMPLETED" || match.status === "COMPLETED_LOCKED" || match.status === "COMPLETED_CORRECTED") {
       statusText = `${innings1TeamName} won by ${innings1.runs - innings2.runs} runs`;
    } else if (match.status === "ABANDONED") {
      statusText = "Match is abandoned";
    }
    else {
    statusText = `${innings2TeamName} need ${Math.max(target - innings2.runs, 0)} runs from ${remainingBalls} balls`;
    }
  } else if (target && !innings2Started) {
    statusText = `${innings2TeamName} need ${target} runs to win`;
  }

  const recentBalls = match.balls
  .filter(
    b => b.wicketType !== "RETIRED_HURT"
  )
  .slice(-12)
  .reverse()
  .map((ball) => ({
    id: ball.id,
    label: ballShortText(ball)
  }));

  const currentInnings = innings2Started ? 2 : 1;


  const matchState =
  await prisma.matchState.findUnique({
    where: {
      matchId
    }
  });
const inningsBalls =
  currentInnings === 1
    ? innings1Balls
    : innings2Balls;

const baseState =
  currentInnings === 1
    ? innings1.currentState
    : innings2.currentState;    

const currentState = {
  ...baseState,

  strikerId:
    matchState?.strikerId ??
    null,

  nonStrikerId:
    matchState?.nonStrikerId ??
    null,

  bowlerId:
    matchState?.bowlerId ??
    baseState?.bowlerId
};

currentState.strikerName =
  getPlayerName(
    playerMap,
    currentState.strikerId
  );

currentState.nonStrikerName =
  getPlayerName(
    playerMap,
    currentState.nonStrikerId
  );

currentState.strikerStats =
  getBatterStats(
    currentState.strikerId,
    inningsBalls
  );

currentState.nonStrikerStats =
  getBatterStats(
    currentState.nonStrikerId,
    inningsBalls
  );

const normalizedStatus = String(match.status || "")
  .trim()
  .replace(/[\s-]+/g, "_")
  .toUpperCase();

const shouldComplete =
  innings1Complete &&
  (
    (target && innings2.runs >= target) ||
    innings2.legalBalls >= maxLegalBalls ||
    (
      match.maxWicketsPerInnings != null &&
      innings2.wickets >= match.maxWicketsPerInnings
    )
  );

const canAutoComplete = ![
  "COMPLETED",
  "COMPLETED_LOCKED",
  "COMPLETED_CORRECTED",
  "ABANDONED"
].includes(normalizedStatus);
/*
if (canAutoComplete && shouldComplete) {
  await prisma.match.update({
    where: { id: match.id },
    data: {
      status: "COMPLETED",
      statusText: "MATCH COMPLETED"
    }
  });

  match.status = "COMPLETED";
  match.statusText = "MATCH COMPLETED";
}  
*/

const response = {
  match: {
    id: match.id,
    teamAName: match.teamA.name,
    teamBName: match.teamB.name,
    battingFirstTeamName: match.battingFirstTeam?.name || "Not decided yet",
    oversPerInnings: match.oversPerInnings,
    powerplayOversInnings: match.powerplayOversInnings,
    status: match.status,
    maxWicketsPerInnings: match.maxWicketsPerInnings,
    maxOversPerBowler: match.maxOversPerBowler,
    shareCode: match.shareCode,
  },
innings: [
  {
    ...innings1,
    teamName:
    innings1.teamName ||
    innings1.battingTeamName ||
    match.battingFirstTeam?.name ||
    "Team",
    battingRows:
      matchStats.battingRows?.filter(
        (row) => Number(row.inningsNo) === 1
      ) || [],
    bowlingRows:
      matchStats.bowlingRows?.filter(
        (row) => Number(row.inningsNo) === 1
      ) || []
  },
  {
    ...innings2,
    teamName:
    innings2.teamName ||
    innings2.battingTeamName ||
    (
      match.battingFirstTeamId === match.teamAId
        ? match.teamB.name
        : match.teamA.name
    ),
    battingRows:
      matchStats.battingRows?.filter(
        (row) => Number(row.inningsNo) === 2
      ) || [],
    bowlingRows:
      matchStats.bowlingRows?.filter(
        (row) => Number(row.inningsNo) === 2
      ) || []
  }
],
  currentInnings,
  currentState,
  summary: {
    target,
    remainingBalls,
    statusText
  },
  recentBalls,
  commentary: buildCommentary(match)
};

return NextResponse.json(response);

}