export const EXTRA_TYPES = ["NONE", "WIDE", "NOBALL", "BYE", "LEGBYE"];

export const WICKET_TYPES = [
  "NONE",
  "BOWLED",
  "CAUGHT",
  "LBW",
  "RUN_OUT",
  "STUMPED",
  "HIT_WICKET",
  "RETIRED_OUT",
  "OTHER"
];

export function isLegalDelivery(extraType) {
  return !["WIDE", "NOBALL"].includes(extraType);
}

export function formatOversFromBalls(legalBalls) {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

export function getBattingTeamId(match, inningsNo) {
  if (inningsNo === 1) return match.battingFirstTeamId;
  return match.teamAId === match.battingFirstTeamId ? match.teamBId : match.teamAId;
}

export function getBowlingTeamId(match, inningsNo) {
  const battingTeamId = getBattingTeamId(match, inningsNo);
  return battingTeamId === match.teamAId ? match.teamBId : match.teamAId;
}

export function validateBallInput(payload) {
  const errors = [];

  if (![1, 2].includes(Number(payload.inningsNo))) {
    errors.push("Innings must be 1 or 2");
  }

  if (!Number.isInteger(Number(payload.strikerId)) || Number(payload.strikerId) < 1) {
    errors.push("Valid striker is required");
  }

  if (!Number.isInteger(Number(payload.nonStrikerId)) || Number(payload.nonStrikerId) < 1) {
    errors.push("Valid non-striker is required");
  }

  if (Number(payload.strikerId) === Number(payload.nonStrikerId)) {
    errors.push("Striker and non-striker must be different");
  }

  if (!Number.isInteger(Number(payload.bowlerId)) || Number(payload.bowlerId) < 1) {
    errors.push("Valid bowler is required");
  }

  if (!EXTRA_TYPES.includes(String(payload.extraType))) {
    errors.push("Invalid extra type");
  }

  if (!Number.isInteger(Number(payload.runsOffBat)) || Number(payload.runsOffBat) < 0) {
    errors.push("Runs off bat must be 0 or more");
  }

  if (!Number.isInteger(Number(payload.extras)) || Number(payload.extras) < 0) {
    errors.push("Extras must be 0 or more");
  }

  if (payload.extraType === "NONE" && Number(payload.extras) !== 0) {
    errors.push("Extras must be 0 when extra type is NONE");
  }

  if (payload.extraType === "WIDE") {
    if (Number(payload.runsOffBat) !== 0) {
      errors.push("Runs off bat must be 0 for wides");
    }
    if (Number(payload.extras) < 1) {
      errors.push("Wide must have at least 1 extra");
    }
  }

  if (payload.extraType === "NOBALL" && Number(payload.extras) < 1) {
    errors.push("No-ball must have at least 1 extra");
  }

  if (["BYE", "LEGBYE"].includes(payload.extraType)) {
    if (Number(payload.runsOffBat) !== 0) {
      errors.push("Runs off bat must be 0 for byes/leg-byes");
    }
    if (Number(payload.extras) < 1) {
      errors.push("Bye/leg-bye must have at least 1 run");
    }
  }

  if (!WICKET_TYPES.includes(String(payload.wicketType || "NONE"))) {
    errors.push("Invalid wicket type");
  }

  if (Number(payload.isWicket)) {
    if (!payload.wicketType || payload.wicketType === "NONE") {
      errors.push("Wicket type is required when wicket is selected");
    }
    if (!payload.dismissedPlayerId) {
      errors.push("Dismissed player is required when wicket is selected");
    }
  }

  if (!Number(payload.isWicket) && payload.wicketType && payload.wicketType !== "NONE") {
    errors.push("Wicket type must be NONE when no wicket is selected");
  }

  if (payload.extraType === "NOBALL" && Number(payload.isWicket) && payload.wicketType !== "RUN_OUT") {
    errors.push("Only run out wicket is allowed on a no-ball");
  }

  if (
    payload.extraType === "WIDE" &&
    Number(payload.isWicket) &&
    !["RUN_OUT", "STUMPED"].includes(payload.wicketType)
  ) {
    errors.push("Only run out or stumped wicket is allowed on a wide");
  }

  return errors;
}

export function ballShortText(ball) {
  const label = `${ball.overNo}.${ball.ballInOver}`;

  if (ball.isWicket) {
    return `${label} W`;
  }

  switch (ball.extraType) {
    case "WIDE":
      return `${label} Wd${ball.extras === 0 ? "" : " (" +ball.extras+")"}`;

    case "NOBALL":
      return `${label} Nb${ball.extras === 0 ? "" : " (" +ball.extras+")"}`;

    case "BYE":
      return `${label} B${ball.extras}`;

    case "LEGBYE":
      return `${label} LB${ball.extras}`;

    default:
      return `${label} ${ball.runsOffBat === 0 ? "(0)" : "("+ball.runsOffBat+")"}`;
  }
}

export function getPlayerName(playerMap, id) {
  if (!id) return "-";
  return playerMap.get(id)?.name || "-";
}

export function applyBallOutcome(ball) {
  let strikerId = ball.strikerId || null;
  let nonStrikerId = ball.nonStrikerId || null;

  if (ball.isWicket) {
    if (!ball.dismissedPlayerId || ball.dismissedPlayerId === ball.strikerId) {
      strikerId = ball.newBatterId || null;
    } else if (ball.dismissedPlayerId === ball.nonStrikerId) {
      nonStrikerId = ball.newBatterId || null;
    }
  }

  if (ball.totalRuns % 2 === 1) {
    [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
  }

  if (ball.legalDelivery && ball.ballInOver === 6) {
    [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
  }

  return { strikerId, nonStrikerId };
}

export function summarizeInningsDetailed(balls, playerMap, oversPerInnings) {
  const sorted = [...balls].sort((a, b) => a.sequence - b.sequence);

  const legalBalls = sorted.filter((b) => b.legalDelivery).length;
  const runs = sorted.reduce((sum, b) => sum + b.totalRuns, 0);
  const wickets = sorted.reduce((sum, b) => sum + (b.isWicket ? 1 : 0),0);

  const powerplayBalls = sorted.filter((b) => b.isPowerPlay);
  const powerplayRuns = powerplayBalls.reduce((sum, b) => sum + b.totalRuns, 0);
  const powerplayWickets = powerplayBalls.reduce((sum, b) => sum + (b.isWicket ? 1 : 0),0);

  const partnerships = [];
  const fallOfWickets = [];

  let currentPartnershipRuns = 0;
  let currentPartnershipBalls = 0;
  let currentPair = null;

  let cumulativeRuns = 0;
  let cumulativeWickets = 0;
  let cumulativeLegalBalls = 0;

  for (const ball of sorted) {
    if (!currentPair && ball.strikerId && ball.nonStrikerId) {
      currentPair = {
        strikerId: ball.strikerId,
        nonStrikerId: ball.nonStrikerId
      };
    }

    cumulativeRuns += ball.totalRuns;
    currentPartnershipRuns += ball.totalRuns;

    if (ball.legalDelivery) {
      cumulativeLegalBalls += 1;
      currentPartnershipBalls += 1;
    }
    currentPair = applyBallOutcome(ball);
    if (ball.isWicket) {
      cumulativeWickets += 1;

      fallOfWickets.push({
        wicketNumber: cumulativeWickets,
        score: `${cumulativeRuns}/${cumulativeWickets}`,
        playerOut: getPlayerName(playerMap, ball.dismissedPlayerId),
        over: formatOversFromBalls(cumulativeLegalBalls)
      });

      partnerships.push({
        wicketNumber: cumulativeWickets,
        runs: currentPartnershipRuns,
        balls: currentPartnershipBalls,
        batter1: getPlayerName(playerMap, currentPair?.strikerId),
        batter2: getPlayerName(playerMap, currentPair?.nonStrikerId),
        ongoing: false
      });

      currentPartnershipRuns = 0;
      currentPartnershipBalls = 0;
      currentPair = applyBallOutcome(ball);
    }
  }

  if (sorted.length > 0 && currentPair && (currentPartnershipRuns > 0 || currentPartnershipBalls > 0)) {
    partnerships.push({
      wicketNumber: null,
      runs: currentPartnershipRuns,
      balls: currentPartnershipBalls,
      batter1: getPlayerName(playerMap, currentPair.strikerId),
      batter2: getPlayerName(playerMap, currentPair.nonStrikerId),
      ongoing: true
    });
  }

  let currentState = null;
  const maxLegalBalls = oversPerInnings * 6;

  if (sorted.length > 0 && legalBalls < maxLegalBalls) {
    const lastBall = sorted[sorted.length - 1];
    const nextPair = applyBallOutcome(lastBall);

    currentState = {
      strikerId: nextPair.strikerId,
      nonStrikerId: nextPair.nonStrikerId,
      strikerName: nextPair.strikerId? getPlayerName(playerMap, nextPair.strikerId): "Yet to bat",
      nonStrikerName: nextPair.nonStrikerId? getPlayerName(playerMap, nextPair.nonStrikerId): "Yet to bat",
      //nonStrikerName: getPlayerName(playerMap, nextPair.nonStrikerId),
      nextOverNo: Math.floor(legalBalls / 6),
      nextBallInOver: (legalBalls % 6) + 1
    };
  }

  return {
    runs,
    wickets,
    balls: sorted.length,
    legalBalls,
    oversDisplay: formatOversFromBalls(legalBalls),
    runRate: legalBalls ? ((runs / legalBalls) * 6).toFixed(2) : "0.00",
    powerplay: {
      runs: powerplayRuns,
      wickets: powerplayWickets
    },
    partnerships,
    fallOfWickets,
    currentState
  };
}

function wicketsForBowler(ball) {
  if (!ball.isWicket) return 0;
  if (["RUN_OUT", "RETIRED_OUT"].includes(ball.wicketType)) return 0;
  if (ball.extraType === "NOBALL") return 0;
  return 1;
}

function runsChargedToBowler(ball) {
  if (["BYE", "LEGBYE"].includes(ball.extraType)) return 0;
  return ball.runsOffBat + ball.extras;
}

export function buildMatchStats(match) {
  const players = [
    ...(match.teamA?.players || []),
    ...(match.teamB?.players || [])
  ];

  const batting = new Map();
  const bowling = new Map();

  players.forEach((player) => {
    batting.set(player.id, {
      playerId: player.id,
      playerName: player.name,
      teamName: player.team?.name || "",
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      outs: 0,
      dismissal: "not out"
    });

    bowling.set(player.id, {
      playerId: player.id,
      playerName: player.name,
      teamName: player.team?.name || "",
      balls: 0,
      dots: 0,
      runs: 0,
      wickets: 0
    });
  });

  for (const ball of match.balls) {
    if (ball.strikerId && batting.has(ball.strikerId)) {
      const row = batting.get(ball.strikerId);
      row.runs += ball.runsOffBat;

      if (ball.extraType !== "WIDE") {
        row.balls += 1;
      }

      if (ball.runsOffBat === 4) row.fours += 1;
      if (ball.runsOffBat === 6) row.sixes += 1;
    }

    if (ball.dismissedPlayerId && batting.has(ball.dismissedPlayerId)) {
      const row = batting.get(ball.dismissedPlayerId);
      row.outs += 1;
      row.dismissal = (ball.wicketType || "OUT").replace(/_/g, " ").toLowerCase();
    }

    if (ball.bowlerId && bowling.has(ball.bowlerId)) {
      const row = bowling.get(ball.bowlerId);

      if (ball.legalDelivery) row.balls += 1;
      if (ball.legalDelivery && ball.totalRuns === 0) row.dots += 1;

      row.runs += runsChargedToBowler(ball);
      row.wickets += wicketsForBowler(ball);
    }
  }

  const battingRows = [...batting.values()]
    .map((row) => ({
      ...row,
      strikeRate: row.balls ? ((row.runs / row.balls) * 100).toFixed(2) : "0.00"
    }))
    .filter((row) => row.runs > 0 || row.balls > 0 || row.outs > 0)
    .sort((a, b) => b.runs - a.runs || a.balls - b.balls);

  const bowlingRows = [...bowling.values()]
    .map((row) => ({
      ...row,
      overs: formatOversFromBalls(row.balls),
      economy: row.balls ? ((row.runs / row.balls) * 6).toFixed(2) : "0.00"
    }))
    .filter((row) => row.balls > 0 || row.runs > 0 || row.wickets > 0)
    .sort((a, b) => b.wickets - a.wickets || Number(a.economy) - Number(b.economy));

  return {
    batting: battingRows,
    bowling: bowlingRows
  };
}