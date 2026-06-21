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
  "RETIRED_HURT",
  "OTHER"
];

export function isLegalDelivery(
  extraType,
  wicketType = "NONE"
) {
  if (wicketType === "RETIRED_HURT") {
    return false;
  }

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
  if (
    payload.wicketType === "RETIRED_HURT" &&
    !payload.newBatterId
  ) {
    errors.push(
      "Replacement batter required for retired hurt"
    );
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

  if (ball.isWicket && ball.wicketType !== "RETIRED_HURT") {
    return `${label} W`;
  }

  switch (ball.extraType) {
case "WIDE": {
  const wideRuns = Math.max(0, Number(ball.extras || 0) - 1);
  return wideRuns > 0
    ? `${label} Wd+${wideRuns}`
    : `${label} Wd`;
}

case "NOBALL":
  return ball.runsOffBat > 0
    ? `${label} Nb+${ball.runsOffBat}`
    : `${label} Nb`;

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

export function getNextAvailableBatter(
  teamPlayers,
  currentStrikerId,
  currentNonStrikerId,
  balls
) {
  const unavailable = new Set([
    currentStrikerId,
    currentNonStrikerId
  ]);

  balls.forEach((ball) => {
    if (
      ball.dismissedPlayerId &&
      ball.wicketType !== "RETIRED_HURT"
    ) {
      unavailable.add(ball.dismissedPlayerId);
    }
  });

  return (
    teamPlayers.find(
      (p) => !unavailable.has(p.id)
    ) || null
  );
}
function runsCompleted(ball) {
  switch (ball.extraType) {
    case "WIDE":
      return Math.max(0, ball.extras - 1);

case "NOBALL":
  return (
    Number(ball.runsOffBat || 0) +
    Math.max(0, Number(ball.extras || 0) - 1)
  );

    case "BYE":
    case "LEGBYE":
      return ball.extras;

    default:
      return ball.runsOffBat;
  }
}
export function applyBallOutcome(ball) {
 
  
  let strikerId = ball.strikerId || null;
  let nonStrikerId = ball.nonStrikerId || null;  

    // RETIRED HURT
  if (ball.wicketType === "RETIRED_HURT") {

    if (
      Number(ball.dismissedPlayerId) ===
      Number(ball.strikerId)
    ) {
      strikerId = ball.newBatterId;
    }

    if (
      Number(ball.dismissedPlayerId) ===
      Number(ball.nonStrikerId)
    ) {
      nonStrikerId = ball.newBatterId;
    }

    return {
      strikerId,
      nonStrikerId
    };
  }

if (ball.isWicket) {
  if (!ball.newBatterId) {
    throw new Error("Replacement batter required");
  }

  if (
    !ball.dismissedPlayerId ||
    Number(ball.dismissedPlayerId) === Number(ball.strikerId)
  ) {
    strikerId = ball.newBatterId;
  } else if (
    Number(ball.dismissedPlayerId) === Number(ball.nonStrikerId)
  ) {
    nonStrikerId = ball.newBatterId;
  }
}
const completedRuns = runsCompleted(ball);

if (completedRuns % 2 === 1) {
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
  const wickets = sorted.reduce((sum, b) =>sum +(b.isWicket && b.wicketType !== "RETIRED_HURT" ? 1 : 0),0);
  const extrasTotal = sorted.reduce(
  (sum, b) => sum + Number(b.extras || 0),
  0
  );

  const wides = sorted.reduce(
    (sum, b) => sum + (b.extraType === "WIDE" ? Number(b.extras || 0) : 0),
    0
  );

  const noBalls = sorted.reduce(
    (sum, b) => sum + (b.extraType === "NOBALL" ? Number(b.extras || 0) : 0),
    0
  );

  const byes = sorted.reduce(
    (sum, b) => sum + (b.extraType === "BYE" ? Number(b.extras || 0) : 0),
    0
  );

  const legByes = sorted.reduce(
    (sum, b) => sum + (b.extraType === "LEGBYE" ? Number(b.extras || 0) : 0),
    0
  );

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

  const isRetiredHurt =
    ball.wicketType === "RETIRED_HURT";

  if (
    ball.legalDelivery &&
    !isRetiredHurt &&
    ball.extraType !== "WIDE" &&
    ball.extraType !== "NOBALL" &&
    ball.extraType !== "RETIRED_HURT"
  ) {
    cumulativeLegalBalls += 1;
    currentPartnershipBalls += 1;
  }
if (
  ball.wicketType === "RETIRED_HURT"
) {
  currentPair = {
    strikerId:
      ball.dismissedPlayerId ===
      currentPair?.strikerId
        ? ball.newBatterId
        : currentPair?.strikerId,

    nonStrikerId:
      ball.dismissedPlayerId ===
      currentPair?.nonStrikerId
        ? ball.newBatterId
        : currentPair?.nonStrikerId
  };

  continue;
}
  const nextPair = applyBallOutcome(ball);



  const countsAsWicket =
    Boolean(ball.isWicket) &&
    ball.wicketType !== "RETIRED_HURT";

  if (countsAsWicket) {
    cumulativeWickets += 1;

    fallOfWickets.push({
      wicketNumber: cumulativeWickets,
      score: `${cumulativeRuns}/${cumulativeWickets}`,
      playerOut: getPlayerName(
        playerMap,
        ball.dismissedPlayerId
      ),
      over: formatOversFromBalls(
        cumulativeLegalBalls
      )
    });

    partnerships.push({
      wicketNumber: cumulativeWickets,
      runs: currentPartnershipRuns,
      balls: currentPartnershipBalls,
      batter1: getPlayerName(
        playerMap,
        currentPair?.strikerId
      ),
      batter2: getPlayerName(
        playerMap,
        currentPair?.nonStrikerId
      ),
      ongoing: false
    });

    currentPartnershipRuns = 0;
    currentPartnershipBalls = 0;
  }

  currentPair = nextPair;

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

if (
  sorted.length > 0 &&
  legalBalls < maxLegalBalls
) {

  const latestBowlerId =
  sorted.length > 0
    ? sorted[sorted.length - 1].bowlerId
    : null;

function getBatterStats(playerId) {
  let runs = 0;
  let balls = 0;

  for (const ball of sorted) {
    if (ball.strikerId === playerId) {
      runs += ball.runsOffBat;

      if (
        ball.extraType !== "WIDE" &&
        ball.extraType !== "NOBALL" &&
        ball.wicketType !== "RETIRED_HURT"
      ) {
        balls += 1;
      }
    }
  }

  return { runs, balls };
}

function getBowlerStats(playerId) {
  let runs = 0;
  let balls = 0;
  let wickets = 0;

  for (const ball of sorted) {
    if (ball.bowlerId === playerId) {
      runs += runsChargedToBowler(ball);

      if (
        ball.legalDelivery &&
        ball.wicketType !== "RETIRED_HURT"
      ) {
        balls += 1;
      }

      wickets += wicketsForBowler(ball);
    }
  }

  return {
    runs,
    wickets,
    overs: formatOversFromBalls(balls)
  };
}


  currentState = {
    strikerId: currentPair?.strikerId || null,

    nonStrikerId:
      currentPair?.nonStrikerId || null,

    strikerName:
      currentPair?.strikerId
        ? getPlayerName(
            playerMap,
            currentPair.strikerId
          )
        : null,

    nonStrikerName:
      currentPair?.nonStrikerId
        ? getPlayerName(
            playerMap,
            currentPair.nonStrikerId
          )
        : null,
    bowlerId:
      sorted.length > 0
        ? sorted[sorted.length - 1].bowlerId
        : null,

    bowlerName:
      sorted.length > 0
        ? getPlayerName(
            playerMap,
            sorted[sorted.length - 1].bowlerId
          )
        : null,
    nextOverNo: Math.floor(legalBalls / 6),

    nextBallInOver:
      (legalBalls % 6) + 1,

        strikerStats:
          currentPair?.strikerId
            ? getBatterStats(currentPair.strikerId)
            : { runs: 0, balls: 0 },

        nonStrikerStats:
          currentPair?.nonStrikerId
            ? getBatterStats(currentPair.nonStrikerId)
            : { runs: 0, balls: 0 },

        bowlerStats:
          latestBowlerId
            ? getBowlerStats(latestBowlerId)
            : { runs: 0, wickets: 0, overs: "0.0"}
  };
  if (currentState) {

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
}
}

return {
  runs,
  wickets,
  balls: sorted.length,
  legalBalls,

  oversDisplay:
    formatOversFromBalls(legalBalls),

  runRate: legalBalls
    ? ((runs / legalBalls) * 6).toFixed(2)
    : "0.00",

  powerplay: {
    runs: powerplayRuns,
    wickets: powerplayWickets
  },
  extras: {
    total: extrasTotal,
    wides,
    noBalls,
    byes,
    legByes
  },
  partnerships,

  fallOfWickets,

  currentState
};
}

function wicketsForBowler(ball) {
  if (!ball.isWicket) return 0;
  if (
  ["RUN_OUT", "RETIRED_OUT", "RETIRED_HURT"].includes(ball.wicketType)) return 0;
  if (ball.extraType === "NOBALL") return 0;
  return 1;
}

function runsChargedToBowler(ball) {
  if (["BYE", "LEGBYE"].includes(ball.extraType)) return 0;
  return ball.runsOffBat + ball.extras;
}
function playerName(playerMap, id) {
  if (!id) return "";
  return playerMap.get(Number(id))?.name || "";
}

function formatDismissal(ball, playerMap) {
  const bowler = playerName(playerMap, ball.bowlerId);
  const fielder = playerName(playerMap, ball.fielderId);
  const assistant = playerName(playerMap, ball.assistantFielderId);

  switch (ball.wicketType) {
    case "BOWLED":
      return bowler ? `b ${bowler}` : "bowled";

    case "LBW":
      return bowler ? `lbw b ${bowler}` : "lbw";

    case "CAUGHT":
      return `c ${fielder || "fielder"}${bowler ? ` b ${bowler}` : ""}`;

    case "STUMPED":
      return `st ${fielder || "keeper"}${bowler ? ` b ${bowler}` : ""}`;

    case "RUN_OUT":
      if (fielder && assistant) {
        return `run out (${fielder} / ${assistant})`;
      }
      if (fielder) {
        return `run out (${fielder})`;
      }
      return "run out";

    case "HIT_WICKET":
      return bowler ? `hit wicket b ${bowler}` : "hit wicket";

    case "RETIRED_HURT":
      return "retired hurt";

    case "RETIRED_OUT":
      return "retired out";

    default:
      return ball.wicketNote || "out";
  }
}
export function buildMatchStats(match) {
  const players = [
    ...(match.teamA?.players || []),
    ...(match.teamB?.players || [])
  ];

  const playerMap = new Map(
    players.map((p) => [Number(p.id), p])
  );

const batting = new Map();
const bowling = new Map();
const currentlyRetiredHurt = new Set();

  function battingKey(inningsNo, playerId) {
    return `${inningsNo}-${playerId}`;
  }

  function bowlingKey(inningsNo, playerId) {
    return `${inningsNo}-${playerId}`;
  }

  function ensureBattingRow(inningsNo, player) {
    const key = battingKey(inningsNo, player.id);

    if (!batting.has(key)) {
      batting.set(key, {
        inningsNo,
        playerId: player.id,
        playerName: player.name,
        teamId: player.teamId,
        teamName: player.team?.name || "",
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        outs: 0,
        dismissal: "not out",
        isRetiredHurt: false,
        firstSequence: 999999
      });
    }

    return batting.get(key);
  }

  function ensureBowlingRow(inningsNo, player) {
    const key = bowlingKey(inningsNo, player.id);

    if (!bowling.has(key)) {
      bowling.set(key, {
        inningsNo,
        playerId: player.id,
        playerName: player.name,
        teamId: player.teamId,
        teamName: player.team?.name || "",
        balls: 0,
        dots: 0,
        runs: 0,
        wickets: 0,
        wides: 0,
        noBalls: 0,
        firstSequence: 999999
      });
    }

    return bowling.get(key);
  }

  for (const ball of match.balls || []) {
    const inningsNo = Number(ball.inningsNo || 1);
    const sequence = Number(ball.sequence || 0);
    const strikerId = Number(ball.strikerId);
const nonStrikerId = Number(ball.nonStrikerId);

if (strikerId) {
  currentlyRetiredHurt.delete(`${inningsNo}-${strikerId}`);
}

if (nonStrikerId) {
  currentlyRetiredHurt.delete(`${inningsNo}-${nonStrikerId}`);
}
    const isRetiredHurt =
      ball.wicketType === "RETIRED_HURT";

    const strikerPlayer =
      playerMap.get(Number(ball.strikerId));

    if (strikerPlayer) {
      const row = ensureBattingRow(
        inningsNo,
        strikerPlayer
      );

      row.firstSequence = Math.min(
        row.firstSequence,
        sequence
      );

      row.runs += Number(ball.runsOffBat || 0);

      if (
        !isRetiredHurt &&
        ball.extraType !== "WIDE" &&
        ball.extraType !== "NOBALL"
      ) {
        row.balls += 1;
      }

      if (Number(ball.runsOffBat || 0) === 4) {
        row.fours += 1;
      }

      if (Number(ball.runsOffBat || 0) === 6) {
        row.sixes += 1;
      }
    }

    const dismissedPlayer =
      playerMap.get(Number(ball.dismissedPlayerId));

    if (dismissedPlayer) {
      const row = ensureBattingRow(
        inningsNo,
        dismissedPlayer
      );

      row.firstSequence = Math.min(
        row.firstSequence,
        sequence
      );
const wicketType = String(ball.wicketType || "").toUpperCase();

const isDismissalEvent =
  Boolean(ball.isWicket) ||
  wicketType === "RETIRED_HURT";

if (isDismissalEvent && ball.dismissedPlayerId) {
 if (wicketType === "RETIRED_HURT") {
  currentlyRetiredHurt.add(`${inningsNo}-${Number(ball.dismissedPlayerId)}`);

  row.dismissal = "Retired hurt";
  row.isRetiredHurt = true;
  row.outs = 0;
} else {
    row.dismissal = formatDismissal(ball, playerMap);
    row.isRetiredHurt = false;
    row.outs += 1;
  }
}
    }

    const bowlerPlayer =
      playerMap.get(Number(ball.bowlerId));

    if (bowlerPlayer) {
      const row = ensureBowlingRow(
        inningsNo,
        bowlerPlayer
      );

      row.firstSequence = Math.min(
        row.firstSequence,
        sequence
      );

      if (
        ball.legalDelivery &&
        !isRetiredHurt &&
        ball.extraType !== "WIDE" &&
        ball.extraType !== "NOBALL"
      ) {
        row.balls += 1;

        if (Number(ball.totalRuns || 0) === 0) {
          row.dots += 1;
        }
      }

      row.runs += runsChargedToBowler(ball);
      row.wickets += wicketsForBowler(ball);
      if (ball.extraType === "WIDE") {
        row.wides += 1;
      }

      if (ball.extraType === "NOBALL") {
        row.noBalls += 1;
      }
    }
  }
for (const row of batting.values()) {
  const key = `${row.inningsNo}-${row.playerId}`;

  if (currentlyRetiredHurt.has(key)) {
    row.dismissal = "Retired hurt";
    row.isRetiredHurt = true;
    row.outs = 0;
  } else if (row.isRetiredHurt) {
    row.dismissal = "not out";
    row.isRetiredHurt = false;
    row.outs = 0;
  }
}
  const battingRows = [...batting.values()]
    .map((row) => ({
      ...row,
      strikeRate: row.balls
        ? ((row.runs / row.balls) * 100).toFixed(2)
        : "0.00"
    }))
    .filter(
      (row) =>
        row.runs > 0 ||
        row.balls > 0 ||
        row.outs > 0 ||
        row.isRetiredHurt ||
        row.dismissal !== "not out"
    )
    .sort(
      (a, b) =>
        Number(a.inningsNo) - Number(b.inningsNo) ||
        a.firstSequence - b.firstSequence
    );

  const bowlingRows = [...bowling.values()]
    .map((row) => ({
      ...row,
      overs: formatOversFromBalls(row.balls),
      economy: row.balls
        ? ((row.runs / row.balls) * 6).toFixed(2)
        : "0.00"
    }))
    .filter(
      (row) =>
        row.balls > 0 ||
        row.runs > 0 ||
        row.wickets > 0
    )
    .sort(
      (a, b) =>
        Number(a.inningsNo) - Number(b.inningsNo) ||
        a.firstSequence - b.firstSequence
    );
const getSafePlayerName = (playerId) =>
  playerMap.get(Number(playerId))?.name || `Player ${playerId}`;

let winningTeamId = null;

if (
  ["COMPLETED", "COMPLETED_LOCKED"].includes(
    String(match.status || "").toUpperCase()
  )
) {
  const innings1 = summarizeInningsDetailed(
    (match.balls || []).filter((b) => Number(b.inningsNo) === 1),
    playerMap,
    match.oversPerInnings
  );

  const innings2 = summarizeInningsDetailed(
    (match.balls || []).filter((b) => Number(b.inningsNo) === 2),
    playerMap,
    match.oversPerInnings
  );

  const innings1TeamId = getBattingTeamId(match, 1);
  const innings2TeamId = getBattingTeamId(match, 2);

  if (innings2.runs > innings1.runs) {
    winningTeamId = innings2TeamId;
  } else if (innings1.runs > innings2.runs) {
    winningTeamId = innings1TeamId;
  }
}

const captaincy = [
  {
    playerId: match.teamACaptainId,
    teamId: match.teamAId,
    teamName: match.teamA?.name || "",
  },
  {
    playerId: match.teamBCaptainId,
    teamId: match.teamBId,
    teamName: match.teamB?.name || "",
  },
]
  .filter((row) => row.playerId)
  .map((row) => ({
    playerId: Number(row.playerId),
    playerName: getSafePlayerName(row.playerId),
    teamId: row.teamId,
    teamName: row.teamName,
    played: 1,
    won: Number(row.teamId) === Number(winningTeamId) ? 1 : 0,
    lost:
      winningTeamId && Number(row.teamId) !== Number(winningTeamId)
        ? 1
        : 0,
  }));

const wicketkeepingMap = new Map();

[
  {
    playerId: match.teamAWicketKeeperId,
    teamId: match.teamAId,
    teamName: match.teamA?.name || "",
  },
  {
    playerId: match.teamBWicketKeeperId,
    teamId: match.teamBId,
    teamName: match.teamB?.name || "",
  },
]
  .filter((row) => row.playerId)
  .forEach((row) => {
    wicketkeepingMap.set(Number(row.playerId), {
      playerId: Number(row.playerId),
      playerName: getSafePlayerName(row.playerId),
      teamId: row.teamId,
      teamName: row.teamName,
      catches: 0,
      stumpings: 0,
      runOuts: 0,
      dismissals: 0,
    });
  });

for (const ball of match.balls || []) {
  const wicketType = String(ball.wicketType || "").toUpperCase();
  const fielderId = Number(ball.fielderId || 0);
  const assistantFielderId = Number(ball.assistantFielderId || 0);

  if (wicketkeepingMap.has(fielderId)) {
    const row = wicketkeepingMap.get(fielderId);

    if (wicketType === "CAUGHT") row.catches += 1;
    if (wicketType === "STUMPED") row.stumpings += 1;
    if (wicketType === "RUN_OUT") row.runOuts += 1;
  }

  if (wicketType === "RUN_OUT" && wicketkeepingMap.has(assistantFielderId)) {
    wicketkeepingMap.get(assistantFielderId).runOuts += 1;
  }
}

const wicketkeeping = [...wicketkeepingMap.values()].map((row) => ({
  ...row,
  dismissals: row.catches + row.stumpings + row.runOuts,
}));
/*
console.log("CAPTAIN WK DEBUG", {
  teamACaptainId: match.teamACaptainId,
  teamBCaptainId: match.teamBCaptainId,
  teamAWicketKeeperId: match.teamAWicketKeeperId,
  teamBWicketKeeperId: match.teamBWicketKeeperId,
  captaincy,
  wicketkeeping,
  balls: match.balls?.map((b) => ({
    wicketType: b.wicketType,
    fielderId: b.fielderId,
    assistantFielderId: b.assistantFielderId,
  })),
  });
  */
  return {
    batting: battingRows,
    bowling: bowlingRows,
    captaincy,
    wicketkeeping,

    // Added for professional scoreboard
    battingRows,
    bowlingRows
  };
}