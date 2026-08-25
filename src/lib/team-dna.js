function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

const COMPLETED_STATUSES = new Set([
  "COMPLETED",
  "COMPLETED_LOCKED",
  "COMPLETED_CORRECTED",
]);

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function safePercent(numerator, denominator) {
  if (!denominator) return 0;
  return (safeNumber(numerator) / safeNumber(denominator)) * 100;
}

function safeRate(runs, legalBalls) {
  if (!legalBalls) return 0;
  return safeNumber(runs) / (safeNumber(legalBalls) / 6);
}

function sortBalls(balls = []) {
  return [...balls].sort(
    (a, b) =>
      safeNumber(a.inningsNo) - safeNumber(b.inningsNo) ||
      safeNumber(a.sequence) - safeNumber(b.sequence) ||
      safeNumber(a.id) - safeNumber(b.id)
  );
}

function matchTime(match) {
  const value =
    match?.endedAt ||
    match?.lockedAt ||
    match?.startedAt ||
    match?.scheduledAt ||
    match?.createdAt;

  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function buildRoster(teams = []) {
  const roster = new Map();

  for (const team of teams) {
    for (const player of team?.players || []) {
      roster.set(Number(player.id), {
        playerId: Number(player.id),
        teamId: Number(team.id),
        teamName: team.name || "",
      });
    }
  }

  return roster;
}

function getBallTeamId(ball, roster) {
  const strikerTeamId =
    Number(ball?.striker?.teamId) ||
    Number(ball?.striker?.team?.id) ||
    Number(roster.get(Number(ball?.strikerId))?.teamId);

  return strikerTeamId || null;
}

function getBowlerTeamId(ball, roster) {
  return (
    Number(ball?.bowler?.teamId) ||
    Number(ball?.bowler?.team?.id) ||
    Number(roster.get(Number(ball?.bowlerId))?.teamId) ||
    null
  );
}

function getWinnerTeamId(match) {
  const explicit =
    Number(match?.winnerTeamId) ||
    Number(match?.winnerId);

  if (explicit) return explicit;

  const statusText = String(match?.statusText || "").toLowerCase();
  const teamAName = String(match?.teamA?.name || "").toLowerCase();
  const teamBName = String(match?.teamB?.name || "").toLowerCase();

  const teamAId = Number(match?.teamAId || match?.teamA?.id);
  const teamBId = Number(match?.teamBId || match?.teamB?.id);

  if (
    teamAName &&
    statusText.includes(teamAName) &&
    !statusText.includes("tied")
  ) {
    return teamAId || null;
  }

  if (
    teamBName &&
    statusText.includes(teamBName) &&
    !statusText.includes("tied")
  ) {
    return teamBId || null;
  }

  return null;
}

function isTied(match) {
  return String(match?.statusText || "")
    .toLowerCase()
    .includes("tied");
}

function inningsMapForMatch(match, roster) {
  const innings = new Map();

  function ensure(inningsNo) {
    if (!innings.has(inningsNo)) {
      innings.set(inningsNo, {
        inningsNo,
        teamId: null,
        runs: 0,
        wickets: 0,
        legalBalls: 0,
        boundaryRuns: 0,
        boundaries: 0,
      });
    }

    return innings.get(inningsNo);
  }

  for (const ball of sortBalls(match?.balls || [])) {
    const inningsNo = Number(ball?.inningsNo || 1);
    const row = ensure(inningsNo);

    if (!row.teamId) {
      row.teamId = getBallTeamId(ball, roster);
    }

    row.runs += safeNumber(ball?.totalRuns);

    if (ball?.legalDelivery) {
      row.legalBalls += 1;
    }

    const wicketType = String(ball?.wicketType || "")
      .trim()
      .toUpperCase();

    if (ball?.isWicket && wicketType !== "RETIRED_HURT") {
      row.wickets += 1;
    }

    const runsOffBat = safeNumber(ball?.runsOffBat);

    if (runsOffBat === 4 || runsOffBat === 6) {
      row.boundaryRuns += runsOffBat;
      row.boundaries += 1;
    }
  }

  return innings;
}

function createTeamRow(team) {
  return {
    teamId: Number(team.id),
    teamName: team.name || `Team ${team.id}`,

    matches: 0,
    wins: 0,
    losses: 0,
    ties: 0,

    battingInnings: 0,
    battingRuns: 0,
    battingBalls: 0,
    wicketsLost: 0,
    boundaryRuns: 0,
    boundaries: 0,

    bowlingInnings: 0,
    runsConceded: 0,
    ballsBowled: 0,
    wicketsTaken: 0,
    dotsBowled: 0,

    chaseAttempts: 0,
    chaseWins: 0,
    defendAttempts: 0,
    defendWins: 0,

    recent: [],
  };
}

function average(rows, getter) {
  const values = rows
    .map(getter)
    .filter((value) => Number.isFinite(value));

  if (!values.length) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function makeTrait({
  icon,
  label,
  detail,
  tone = "positive",
}) {
  return {
    icon,
    label,
    detail,
    tone,
  };
}

function buildTraits(team, leagueAverages) {
  const strengths = [];
  const watch = [];

  if (
    team.battingRunRate >= leagueAverages.battingRunRate + 0.45 &&
    team.battingInnings >= 2
  ) {
    strengths.push(
      makeTrait({
        icon: "⚡",
        label: "Aggressive batting",
        detail: `${team.battingRunRate.toFixed(2)} runs/over vs ${leagueAverages.battingRunRate.toFixed(2)} league avg`,
      })
    );
  }

  if (
    team.boundaryRunPct >= leagueAverages.boundaryRunPct + 7 &&
    team.battingRuns >= 40
  ) {
    strengths.push(
      makeTrait({
        icon: "🚀",
        label: "Boundary power",
        detail: `${team.boundaryRunPct.toFixed(0)}% of runs from boundaries`,
      })
    );
  }

  if (
    team.dotBallPct >= leagueAverages.dotBallPct + 5 &&
    team.bowlingInnings >= 2
  ) {
    strengths.push(
      makeTrait({
        icon: "🔒",
        label: "Bowling pressure",
        detail: `${team.dotBallPct.toFixed(0)}% dot-ball rate`,
      })
    );
  }

  if (
    team.wicketsPerBowlingInnings >=
      leagueAverages.wicketsPerBowlingInnings + 0.6 &&
    team.bowlingInnings >= 2
  ) {
    strengths.push(
      makeTrait({
        icon: "🎯",
        label: "Wicket threat",
        detail: `${team.wicketsPerBowlingInnings.toFixed(1)} wickets per bowling innings`,
      })
    );
  }

  if (team.chaseAttempts >= 2 && team.chaseWinPct >= 60) {
    strengths.push(
      makeTrait({
        icon: "🏃",
        label: "Chase specialists",
        detail: `${team.chaseWins}/${team.chaseAttempts} successful chases`,
      })
    );
  }

  if (team.defendAttempts >= 2 && team.defendWinPct >= 60) {
    strengths.push(
      makeTrait({
        icon: "🛡️",
        label: "Strong defenders",
        detail: `${team.defendWins}/${team.defendAttempts} totals defended`,
      })
    );
  }

  if (
    team.battingRunRate <= leagueAverages.battingRunRate - 0.45 &&
    team.battingInnings >= 2
  ) {
    watch.push(
      makeTrait({
        icon: "⏱️",
        label: "Watch: scoring tempo",
        detail: `${team.battingRunRate.toFixed(2)} runs/over is below the league average`,
        tone: "watch",
      })
    );
  }

  if (
    team.bowlingEconomy >= leagueAverages.bowlingEconomy + 0.55 &&
    team.bowlingInnings >= 2
  ) {
    watch.push(
      makeTrait({
        icon: "📉",
        label: "Watch: run control",
        detail: `${team.bowlingEconomy.toFixed(2)} bowling economy`,
        tone: "watch",
      })
    );
  }

  if (
    team.wicketsPerBowlingInnings <=
      leagueAverages.wicketsPerBowlingInnings - 0.6 &&
    team.bowlingInnings >= 2
  ) {
    watch.push(
      makeTrait({
        icon: "🧩",
        label: "Watch: wicket pressure",
        detail: `${team.wicketsPerBowlingInnings.toFixed(1)} wickets per bowling innings`,
        tone: "watch",
      })
    );
  }

  if (!strengths.length) {
    strengths.push(
      makeTrait({
        icon: "⚖️",
        label: "Balanced profile",
        detail: "No single metric is far enough from the league average to define this team yet.",
        tone: "neutral",
      })
    );
  }

  return {
    strengths: strengths.slice(0, 3),
    watch: watch.slice(0, 2),
  };
}

export function buildTeamDNA({
  matches = [],
  teams = [],
}) {
  const roster = buildRoster(teams);
  const rows = new Map();

  for (const team of teams) {
    rows.set(Number(team.id), createTeamRow(team));
  }

  const eligibleMatches = [...matches]
    .filter((match) =>
      COMPLETED_STATUSES.has(normalizeStatus(match?.status))
    )
    .sort((a, b) => matchTime(a) - matchTime(b));

  for (const match of eligibleMatches) {
    const teamAId = Number(match?.teamAId || match?.teamA?.id);
    const teamBId = Number(match?.teamBId || match?.teamB?.id);

    const teamA = rows.get(teamAId);
    const teamB = rows.get(teamBId);

    if (!teamA || !teamB) continue;

    teamA.matches += 1;
    teamB.matches += 1;

    const winnerTeamId = getWinnerTeamId(match);
    const tied = isTied(match);

    if (tied) {
      teamA.ties += 1;
      teamB.ties += 1;
      teamA.recent.push("T");
      teamB.recent.push("T");
    } else if (winnerTeamId === teamAId) {
      teamA.wins += 1;
      teamB.losses += 1;
      teamA.recent.push("W");
      teamB.recent.push("L");
    } else if (winnerTeamId === teamBId) {
      teamB.wins += 1;
      teamA.losses += 1;
      teamB.recent.push("W");
      teamA.recent.push("L");
    } else {
      teamA.recent.push("—");
      teamB.recent.push("—");
    }

    const innings = inningsMapForMatch(match, roster);

    for (const inningsRow of innings.values()) {
      const battingTeam = rows.get(Number(inningsRow.teamId));

      if (!battingTeam) continue;

      battingTeam.battingInnings += 1;
      battingTeam.battingRuns += inningsRow.runs;
      battingTeam.battingBalls += inningsRow.legalBalls;
      battingTeam.wicketsLost += inningsRow.wickets;
      battingTeam.boundaryRuns += inningsRow.boundaryRuns;
      battingTeam.boundaries += inningsRow.boundaries;

      const bowlingTeamId =
        Number(inningsRow.teamId) === teamAId ? teamBId : teamAId;
      const bowlingTeam = rows.get(bowlingTeamId);

      if (bowlingTeam) {
        bowlingTeam.bowlingInnings += 1;
        bowlingTeam.runsConceded += inningsRow.runs;
        bowlingTeam.ballsBowled += inningsRow.legalBalls;
        bowlingTeam.wicketsTaken += inningsRow.wickets;
      }
    }

    for (const ball of match?.balls || []) {
      if (!ball?.legalDelivery) continue;

      const bowlingTeamId = getBowlerTeamId(ball, roster);
      const bowlingTeam = rows.get(Number(bowlingTeamId));

      if (bowlingTeam && safeNumber(ball?.totalRuns) === 0) {
        bowlingTeam.dotsBowled += 1;
      }
    }

    const first = innings.get(1);
    const second = innings.get(2);

    if (first?.teamId && second?.teamId) {
      const defendingTeam = rows.get(Number(first.teamId));
      const chasingTeam = rows.get(Number(second.teamId));

      if (defendingTeam) defendingTeam.defendAttempts += 1;
      if (chasingTeam) chasingTeam.chaseAttempts += 1;

      if (winnerTeamId === Number(first.teamId) && defendingTeam) {
        defendingTeam.defendWins += 1;
      }

      if (winnerTeamId === Number(second.teamId) && chasingTeam) {
        chasingTeam.chaseWins += 1;
      }
    }
  }

  const teamRows = [...rows.values()].map((team) => ({
    ...team,
    winPct: safePercent(team.wins, team.matches),
    battingRunRate: safeRate(team.battingRuns, team.battingBalls),
    avgScore:
      team.battingInnings > 0
        ? team.battingRuns / team.battingInnings
        : 0,
    boundaryRunPct: safePercent(team.boundaryRuns, team.battingRuns),
    bowlingEconomy: safeRate(team.runsConceded, team.ballsBowled),
    dotBallPct: safePercent(team.dotsBowled, team.ballsBowled),
    wicketsPerBowlingInnings:
      team.bowlingInnings > 0
        ? team.wicketsTaken / team.bowlingInnings
        : 0,
    chaseWinPct: safePercent(team.chaseWins, team.chaseAttempts),
    defendWinPct: safePercent(team.defendWins, team.defendAttempts),
    recent: team.recent.slice(-5).reverse(),
  }));

  const activeRows = teamRows.filter((team) => team.matches > 0);

  const leagueAverages = {
    battingRunRate: average(activeRows, (team) => team.battingRunRate),
    avgScore: average(activeRows, (team) => team.avgScore),
    boundaryRunPct: average(activeRows, (team) => team.boundaryRunPct),
    bowlingEconomy: average(activeRows, (team) => team.bowlingEconomy),
    dotBallPct: average(activeRows, (team) => team.dotBallPct),
    wicketsPerBowlingInnings: average(
      activeRows,
      (team) => team.wicketsPerBowlingInnings
    ),
  };

  const enriched = teamRows
    .map((team) => {
      const traits = buildTraits(team, leagueAverages);

      return {
        ...team,
        ...traits,
      };
    })
    .sort(
      (a, b) =>
        b.winPct - a.winPct ||
        b.wins - a.wins ||
        b.battingRunRate - a.battingRunRate ||
        a.teamName.localeCompare(b.teamName)
    );

  return {
    teams: enriched,
    leagueAverages,
    completedMatches: eligibleMatches.length,
    activeTeamCount: activeRows.length,
  };
}
