function getInningsNo(innings, index) {
  return Number(
    innings?.number ??
      innings?.inningsNo ??
      innings?.innings ??
      index + 1
  );
}

function parseChaseText(text) {
  const value = String(text || "");
  const match = value.match(/need\s+(\d+)\s+runs?\s+from\s+(\d+)\s+balls?/i);

  if (!match) return null;

  return {
    runsNeeded: Number(match[1]),
    ballsLeft: Number(match[2]),
  };
}

export function buildMatchInsights(scoreboard) {
  if (!scoreboard) {
    return {
      resultText: "",
      potm: null,
      winProbability: null,
    };
  }

  const innings = scoreboard.innings || [];

  const first =
    innings.find((i, index) => getInningsNo(i, index) === 1) ||
    innings[0];

  const second =
    innings.find((i, index) => getInningsNo(i, index) === 2) ||
    innings[1];

  const status = String(scoreboard?.match?.status || "").toUpperCase();

  const teamA = scoreboard?.match?.teamAName || "Team A";
  const teamB = scoreboard?.match?.teamBName || "Team B";

  const firstTeam = first?.teamName || first?.battingTeamName || teamA;
  const secondTeam = second?.teamName || second?.battingTeamName || teamB;

  let resultText = "";

  if (status === "ABANDONED") {
    resultText = "Match abandoned";
  } else if (
    ["COMPLETED", "COMPLETED_LOCKED"].includes(status) &&
    first &&
    second
  ) {
    const firstRuns = Number(first.runs || 0);
    const secondRuns = Number(second.runs || 0);
    const secondWickets = Number(second.wickets || 0);
    const maxWickets = Number(scoreboard?.match?.maxWicketsPerInnings || 10);

    if (secondRuns > firstRuns) {
      const wicketsLeft = Math.max(maxWickets - secondWickets, 0);
      resultText = `${secondTeam} won by ${wicketsLeft} wicket${
        wicketsLeft === 1 ? "" : "s"
      }`;
    } else if (firstRuns > secondRuns) {
      const margin = firstRuns - secondRuns;
      resultText = `${firstTeam} won by ${margin} run${
        margin === 1 ? "" : "s"
      }`;
    } else {
      resultText = "Match tied";
    }
  } else if (scoreboard?.summary?.statusText) {
    resultText = scoreboard.summary.statusText;
  }

  const allBatters = innings.flatMap((i) =>
    (i.battingStats || i.battingRows || []).map((p) => ({
      ...p,
      type: "batting",
      inningsTeam: i.teamName,
    }))
  );

  const allBowlers = innings.flatMap((i) =>
    (i.bowlingStats || i.bowlingRows || []).map((p) => ({
      ...p,
      type: "bowling",
      inningsTeam: i.teamName,
    }))
  );

  const playerScores = new Map();

  allBatters.forEach((p) => {
    const playerName = p.playerName || p.name || "Player";
    const existing = playerScores.get(playerName) || {
      playerName,
      runs: 0,
      balls: 0,
      wickets: 0,
      bowlingRuns: 0,
      score: 0,
      summary: [],
    };

    const runs = Number(p.runs || 0);
    const fours = Number(p.fours || 0);
    const sixes = Number(p.sixes || 0);

    existing.runs += runs;
    existing.balls += Number(p.balls || 0);
    existing.score += runs + fours * 2 + sixes * 3;

    if (runs >= 30) {
      existing.summary.push(`${runs} (${p.balls})`);
    }

    playerScores.set(playerName, existing);
  });

  allBowlers.forEach((p) => {
    const playerName = p.playerName || p.name || "Player";
    const existing = playerScores.get(playerName) || {
      playerName,
      runs: 0,
      balls: 0,
      wickets: 0,
      bowlingRuns: 0,
      score: 0,
      summary: [],
    };

    const wickets = Number(p.wickets || 0);
    const runs = Number(p.runs || 0);

    existing.wickets += wickets;
    existing.bowlingRuns += runs;
    existing.score += wickets * 25;

    if (wickets > 0) {
      existing.summary.push(`${wickets}/${runs}`);
    }

    playerScores.set(playerName, existing);
  });

  const potm =
    Array.from(playerScores.values())
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)[0] || null;

  let winProbability = null;

  const isFinished = ["COMPLETED", "COMPLETED_LOCKED", "ABANDONED"].includes(
    status
  );

  const chaseFromText = parseChaseText(
    scoreboard?.summary?.statusText || resultText
  );

  if (first && second && !isFinished) {
    const target = Number(
      scoreboard?.summary?.target || Number(first.runs || 0) + 1
    );

    const secondRuns = Number(second.runs || 0);

    const runsNeeded = Number(
      scoreboard?.summary?.runsRequired ??
        scoreboard?.summary?.runsNeeded ??
        chaseFromText?.runsNeeded ??
        Math.max(target - secondRuns, 0)
    );

    const ballsLeft = Number(
      scoreboard?.summary?.remainingBalls ??
        scoreboard?.summary?.ballsRemaining ??
        second.remainingBalls ??
        second.ballsRemaining ??
        chaseFromText?.ballsLeft ??
        0
    );

    if (target > 0 && ballsLeft > 0 && runsNeeded > 0) {
      const rrr = (runsNeeded / ballsLeft) * 6;
      const crr = Number(second.runRate || second.crr || 0);

      let chasingChance = 50 + (crr - rrr) * 8;
      chasingChance -= Math.min(Number(second.wickets || 0) * 3, 24);
      chasingChance = Math.max(5, Math.min(95, chasingChance));

      winProbability = {
        battingTeam: secondTeam,
        bowlingTeam: firstTeam,
        battingChance: Math.round(chasingChance),
        bowlingChance: Math.round(100 - chasingChance),
        runsNeeded,
        ballsLeft,
        crr: crr.toFixed(2),
        rrr: rrr.toFixed(2),
      };
    }
  }

  return {
    resultText,
    potm,
    winProbability,
  };
}