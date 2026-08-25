import {
  shouldExcludePlayerFromLeagueAnalytics,
} from "@/lib/player-analytics-exclusions";
import {
  getLeagueAnalyticsPlayerKey,
} from "@/lib/surprise-player-identity";

const COMPLETED_STATUSES = new Set([
  "COMPLETED",
  "COMPLETED_LOCKED",
  "COMPLETED_CORRECTED",
]);

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchDate(match) {
  return (
    safeDate(match?.endedAt) ||
    safeDate(match?.lockedAt) ||
    safeDate(match?.startedAt) ||
    safeDate(match?.scheduledAt) ||
    safeDate(match?.createdAt) ||
    new Date(0)
  );
}

function sortMatches(matches = []) {
  return [...matches]
    .filter((match) =>
      COMPLETED_STATUSES.has(normalizeStatus(match?.status))
    )
    .sort(
      (a, b) =>
        matchDate(a).getTime() - matchDate(b).getTime() ||
        Number(a?.id || 0) - Number(b?.id || 0)
    );
}

function sortBalls(balls = []) {
  return [...balls].sort(
    (a, b) =>
      Number(a?.inningsNo || 0) - Number(b?.inningsNo || 0) ||
      Number(a?.sequence || 0) - Number(b?.sequence || 0) ||
      Number(a?.id || 0) - Number(b?.id || 0)
  );
}

function buildRoster(league) {
  const roster = new Map();

  for (const team of league?.teams || []) {
    for (const player of team?.players || []) {
      roster.set(Number(player.id), {
        playerId: Number(player.id),
        playerName: player.name || `Player ${player.id}`,
        teamId: Number(team.id),
        teamName: team.name || "",
      });
    }
  }

  return roster;
}

function getPlayer(roster, playerId, fallback = {}) {
  const id = Number(playerId);

  return (
    roster.get(id) || {
      playerId: id || null,
      playerName:
        fallback.playerName ||
        (id ? `Player ${id}` : "Player"),
      teamId: Number(fallback.teamId) || null,
      teamName: fallback.teamName || "",
    }
  );
}

function isBowlerWicket(ball) {
  if (!ball?.isWicket) return false;

  const wicketType = String(ball?.wicketType || "")
    .trim()
    .toUpperCase();

  if (["RUN_OUT", "RETIRED_OUT", "RETIRED_HURT"].includes(wicketType)) {
    return false;
  }

  return String(ball?.extraType || "").trim().toUpperCase() !== "NOBALL";
}

function bowlerRuns(ball) {
  const extraType = String(ball?.extraType || "")
    .trim()
    .toUpperCase();

  return ["BYE", "LEGBYE"].includes(extraType)
    ? 0
    : Number(ball?.totalRuns || 0);
}

function fieldingEvent(ball, playerId) {
  const id = Number(playerId);
  if (!id) return null;

  const wicketType = String(ball?.wicketType || "")
    .trim()
    .toUpperCase();

  if (Number(ball?.fielderId) === id) {
    if (wicketType === "CAUGHT") return "catch";
    if (wicketType === "RUN_OUT") return "runOut";
    if (wicketType === "STUMPED") return "stumping";
  }

  if (
    wicketType === "RUN_OUT" &&
    Number(ball?.assistantFielderId) === id
  ) {
    return "assist";
  }

  return null;
}

function emptyPerformance(player, match) {
  return {
    key: player.key,
    playerId: player.playerId,
    playerName: player.playerName,
    teamId: player.teamId,
    teamName: player.teamName || "",
    matchId: Number(match?.id),
    matchLabel: `${match?.teamA?.name || "Team A"} vs ${match?.teamB?.name || "Team B"}`,
    date: matchDate(match).getTime(),
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    wickets: 0,
    bowlingBalls: 0,
    bowlingRuns: 0,
    catches: 0,
    runOuts: 0,
    stumpings: 0,
    assists: 0,
    batted: false,
    bowled: false,
    fielded: false,
    participated: false,
    dismissedForDuck: false,
  };
}

function buildMatchPerformances(match, league, roster) {
  const rows = new Map();

  function ensure(playerId, fallback = {}) {
    const player = getPlayer(roster, playerId, fallback);

    if (
      !player.playerId ||
      shouldExcludePlayerFromLeagueAnalytics(league, player.playerName)
    ) {
      return null;
    }

    const key = getLeagueAnalyticsPlayerKey({
      league,
      playerId: player.playerId,
      playerName: player.playerName,
    });

    if (!rows.has(key)) {
      rows.set(
        key,
        emptyPerformance(
          {
            ...player,
            key,
          },
          match
        )
      );
    }

    const row = rows.get(key);

    if (!row.teamName && player.teamName) {
      row.teamName = player.teamName;
      row.teamId = player.teamId;
    }

    return row;
  }

  for (const ball of sortBalls(match?.balls || [])) {
    const striker = ensure(ball?.strikerId, {
      playerName: ball?.striker?.name,
      teamId: ball?.striker?.teamId || ball?.striker?.team?.id,
      teamName: ball?.striker?.team?.name,
    });

    if (striker) {
      striker.runs += Number(ball?.runsOffBat || 0);
      striker.batted = true;
      striker.participated = true;

      const extraType = String(ball?.extraType || "").trim().toUpperCase();
      const wicketType = String(ball?.wicketType || "").trim().toUpperCase();

      if (
        extraType !== "WIDE" &&
        extraType !== "NOBALL" &&
        wicketType !== "RETIRED_HURT"
      ) {
        striker.balls += 1;
      }

      if (Number(ball?.runsOffBat || 0) === 4) striker.fours += 1;
      if (Number(ball?.runsOffBat || 0) === 6) striker.sixes += 1;
    }

    const nonStriker = ensure(ball?.nonStrikerId);
    if (nonStriker) nonStriker.participated = true;

    const bowler = ensure(ball?.bowlerId, {
      playerName: ball?.bowler?.name,
      teamId: ball?.bowler?.teamId || ball?.bowler?.team?.id,
      teamName: ball?.bowler?.team?.name,
    });

    if (bowler) {
      bowler.bowled = true;
      bowler.participated = true;
      bowler.bowlingRuns += bowlerRuns(ball);

      if (ball?.legalDelivery) bowler.bowlingBalls += 1;
      if (isBowlerWicket(ball)) bowler.wickets += 1;
    }

    for (const candidateId of [ball?.fielderId, ball?.assistantFielderId]) {
      const fielder = ensure(candidateId);
      if (!fielder) continue;

      const event = fieldingEvent(ball, candidateId);
      if (!event) continue;

      fielder.fielded = true;
      fielder.participated = true;

      if (event === "catch") fielder.catches += 1;
      if (event === "runOut") fielder.runOuts += 1;
      if (event === "stumping") fielder.stumpings += 1;
      if (event === "assist") fielder.assists += 1;
    }

    /*
     * Duck-Free Streak is based on dismissal for zero, not merely whether
     * a player happened to score. A batter finishing 0 not out therefore
     * does NOT break the streak.
     */
    if (ball?.isWicket) {
      const wicketType = String(ball?.wicketType || "")
        .trim()
        .toUpperCase();
      const dismissedPlayerId = Number(ball?.dismissedPlayerId);

      if (
        dismissedPlayerId &&
        wicketType !== "RETIRED_HURT"
      ) {
        const dismissed = ensure(dismissedPlayerId);

        if (dismissed) {
          dismissed.batted = true;
          dismissed.participated = true;

          if (Number(dismissed.runs || 0) === 0) {
            dismissed.dismissedForDuck = true;
          }
        }
      }
    }
  }

  return [...rows.values()]
    .filter((row) => row.participated)
    .map((row) => ({
      ...row,
      fieldingTotal:
        row.catches + row.runOuts + row.stumpings + row.assists,
      strikeRate: row.balls > 0 ? (row.runs / row.balls) * 100 : 0,
      economy:
        row.bowlingBalls > 0
          ? row.bowlingRuns / (row.bowlingBalls / 6)
          : 0,
      impact:
        row.runs +
        row.wickets * 25 +
        row.catches * 10 +
        row.runOuts * 10 +
        row.stumpings * 10 +
        row.assists * 5,
    }));
}

function aggregate(performanceRows) {
  const career = new Map();

  for (const row of performanceRows) {
    if (!career.has(row.key)) {
      career.set(row.key, {
        key: row.key,
        playerId: row.playerId,
        playerName: row.playerName,
        teamId: row.teamId,
        teamName: row.teamName || "",
        matches: 0,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        fifties: 0,
        hundreds: 0,
        wickets: 0,
        bowlingBalls: 0,
        bowlingRuns: 0,
        catches: 0,
        runOuts: 0,
        stumpings: 0,
        assists: 0,
        fieldingTotal: 0,
      });
    }

    const target = career.get(row.key);

    if (!target.teamName && row.teamName) {
      target.teamName = row.teamName;
      target.teamId = row.teamId;
    }

    target.matches += 1;
    target.runs += row.runs;
    target.balls += row.balls;
    target.fours += row.fours;
    target.sixes += row.sixes;
    target.fifties += row.runs >= 50 && row.runs < 100 ? 1 : 0;
    target.hundreds += row.runs >= 100 ? 1 : 0;
    target.wickets += row.wickets;
    target.bowlingBalls += row.bowlingBalls;
    target.bowlingRuns += row.bowlingRuns;
    target.catches += row.catches;
    target.runOuts += row.runOuts;
    target.stumpings += row.stumpings;
    target.assists += row.assists;
    target.fieldingTotal += row.fieldingTotal;
  }

  return [...career.values()].map((row) => {
    const strikeRate = row.balls > 0 ? (row.runs / row.balls) * 100 : 0;
    const economy =
      row.bowlingBalls > 0
        ? row.bowlingRuns / (row.bowlingBalls / 6)
        : 0;

    const battingPoints =
      row.runs +
      row.fifties * 10 +
      row.hundreds * 25 +
      Math.max(0, strikeRate - 100) * (row.balls >= 20 ? 0.12 : 0);

    const bowlingPoints =
      row.wickets * 25 +
      (row.bowlingBalls >= 12
        ? Math.max(0, 8 - economy) * 3
        : 0);

    const fieldingPoints =
      row.catches * 10 +
      row.runOuts * 10 +
      row.stumpings * 10 +
      row.assists * 5;

    return {
      ...row,
      strikeRate,
      economy,
      battingPoints,
      bowlingPoints,
      fieldingPoints,
      overallPoints: battingPoints + bowlingPoints + fieldingPoints,
    };
  });
}

function rankRows(rows, category) {
  const key = `${category}Points`;

  return [...rows]
    .filter((row) => Number(row[key] || 0) > 0)
    .sort(
      (a, b) =>
        Number(b[key] || 0) - Number(a[key] || 0) ||
        Number(b.overallPoints || 0) - Number(a.overallPoints || 0) ||
        a.playerName.localeCompare(b.playerName)
    )
    .map((row, index) => ({
      ...row,
      rank: index + 1,
      rankingPoints: Number(row[key] || 0),
    }));
}

function rankMap(rows) {
  return new Map(rows.map((row) => [row.key, row.rank]));
}

function rankingSnapshots(matches, league, roster, category) {
  const snapshots = [];
  const allRows = [];

  for (const match of matches) {
    allRows.push(...buildMatchPerformances(match, league, roster));
    snapshots.push(rankRows(aggregate(allRows), category));
  }

  return snapshots;
}

function attachRankMovement(current, previous, snapshots) {
  const previousMap = rankMap(previous);

  return current.map((row) => {
    const oldRank = previousMap.get(row.key) || null;
    let bestRank = row.rank;

    for (const snapshot of snapshots) {
      const found = snapshot.find((candidate) => candidate.key === row.key);
      if (found) bestRank = Math.min(bestRank, found.rank);
    }

    return {
      ...row,
      previousRank: oldRank,
      movement: oldRank ? oldRank - row.rank : null,
      careerBestRank: bestRank,
    };
  });
}

function formTrend(lastFive) {
  if (!lastFive.length) return "Building";

  const latest = lastFive.slice(0, 2);
  const earlier = lastFive.slice(2, 5);
  const avg = (rows) =>
    rows.length
      ? rows.reduce((sum, row) => sum + row.impact, 0) / rows.length
      : 0;

  const recentAverage = avg(latest);
  const earlierAverage = avg(earlier);

  if (!earlier.length) return "Building";
  if (recentAverage >= earlierAverage * 1.18) return "Improving";
  if (recentAverage <= earlierAverage * 0.82) return "Cooling";
  return "Stable";
}

function buildForm(performanceRows) {
  const byPlayer = new Map();

  for (const row of performanceRows) {
    if (!byPlayer.has(row.key)) byPlayer.set(row.key, []);
    byPlayer.get(row.key).push(row);
  }

  return [...byPlayer.entries()]
    .map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => b.date - a.date);
      const lastFive = sorted.slice(0, 5);
      const weighted = lastFive.reduce(
        (sum, row, index) => sum + row.impact * (5 - index),
        0
      );
      const divisor = lastFive.reduce((sum, _, index) => sum + (5 - index), 0) || 1;
      const best = [...lastFive].sort((a, b) => b.impact - a.impact)[0] || null;
      const first = sorted[0];

      return {
        key,
        playerId: first.playerId,
        playerName: first.playerName,
        teamName: first.teamName || "",
        formScore: weighted / divisor,
        trend: formTrend(lastFive),
        lastFive,
        best,
        lastFiveRuns: lastFive.reduce((sum, row) => sum + row.runs, 0),
        lastFiveWickets: lastFive.reduce((sum, row) => sum + row.wickets, 0),
      };
    })
    .sort((a, b) => b.formScore - a.formScore || a.playerName.localeCompare(b.playerName));
}

function streakMetric(rows, qualifies, eligible = () => true) {
  let current = 0;
  let best = 0;

  for (const row of rows) {
    if (!eligible(row)) continue;

    if (qualifies(row)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }

  return { current, best };
}

function buildStreaks(performanceRows) {
  const byPlayer = new Map();

  for (const row of performanceRows) {
    if (!byPlayer.has(row.key)) byPlayer.set(row.key, []);
    byPlayer.get(row.key).push(row);
  }

  const streaks = [];

  for (const [key, unsorted] of byPlayer.entries()) {
    const rows = [...unsorted].sort((a, b) => a.date - b.date);
    const last = rows[rows.length - 1];

    const metrics = [
      {
        type: "30+ Score Streak",
        description: "30+ runs in consecutive batting innings",
        icon: "🔥",
        ...streakMetric(rows, (row) => row.runs >= 30, (row) => row.batted),
      },
      {
        type: "50+ Score Streak",
        description: "50+ runs in consecutive batting innings",
        icon: "💥",
        ...streakMetric(rows, (row) => row.runs >= 50, (row) => row.batted),
      },
      {
        type: "Wicket-Taking Streak",
        description: "1+ bowler-credited wicket in consecutive matches",
        icon: "🎯",
        ...streakMetric(rows, (row) => row.wickets >= 1, (row) => row.bowled),
      },
      {
        type: "Duck-Free Streak",
        description: "Consecutive batting innings without being dismissed for 0",
        icon: "🛡️",
        ...streakMetric(
          rows,
          (row) => !row.dismissedForDuck,
          (row) => row.batted
        ),
      },
    ];

    for (const metric of metrics) {
      if (metric.current <= 0 && metric.best <= 1) continue;

      streaks.push({
        id: `${key}:${metric.type}`,
        playerId: last.playerId,
        playerName: last.playerName,
        teamName: last.teamName || "",
        type: metric.type,
        description: metric.description || "",
        icon: metric.icon,
        current: metric.current,
        best: metric.best,
      });
    }
  }

  return streaks.sort(
    (a, b) =>
      b.current - a.current ||
      b.best - a.best ||
      a.playerName.localeCompare(b.playerName)
  );
}

const PROGRESS_TARGETS = {
  runs: [50, 100, 250, 500, 1000, 1500, 2000, 3000, 5000],
  wickets: [5, 10, 25, 50, 100, 150, 200, 300],
  fielding: [5, 10, 25, 50, 100, 150, 200],
  matches: [5, 10, 25, 50, 100, 150, 200, 300],
};

function nextProgressTarget(metric, value) {
  const targets = PROGRESS_TARGETS[metric] || [];

  return (
    targets.find((target) => Number(value || 0) < target) ||
    null
  );
}

function previousProgressTarget(metric, target) {
  const targets = PROGRESS_TARGETS[metric] || [];
  const index = targets.indexOf(target);

  return index > 0 ? targets[index - 1] : 0;
}

function progressMetric(metric, current) {
  const target = nextProgressTarget(metric, current);

  if (!target) {
    return {
      metric,
      current,
      target: current,
      remaining: 0,
      progress: 100,
      complete: true,
    };
  }

  const previous = previousProgressTarget(metric, target);
  const span = Math.max(target - previous, 1);
  const progressed = Math.max(Number(current || 0) - previous, 0);

  return {
    metric,
    current: Number(current || 0),
    target,
    remaining: Math.max(target - Number(current || 0), 0),
    progress: Math.min(
      100,
      Math.max(0, (progressed / span) * 100)
    ),
    complete: false,
  };
}

function badge({
  id,
  icon,
  title,
  description,
  category,
  tier = "standard",
}) {
  return {
    id,
    icon,
    title,
    description,
    category,
    tier,
  };
}

function buildAchievements(performanceRows, careerRows) {
  const rowsByPlayer = new Map();

  for (const row of performanceRows) {
    if (!rowsByPlayer.has(row.key)) {
      rowsByPlayer.set(row.key, []);
    }

    rowsByPlayer.get(row.key).push(row);
  }

  return careerRows
    .map((career) => {
      const rows = rowsByPlayer.get(career.key) || [];
      const earned = [];

      const highestScore = rows.reduce(
        (best, row) => Math.max(best, Number(row.runs || 0)),
        0
      );

      const bestWickets = rows.reduce(
        (best, row) => Math.max(best, Number(row.wickets || 0)),
        0
      );

      const bestSixes = rows.reduce(
        (best, row) => Math.max(best, Number(row.sixes || 0)),
        0
      );

      const bestFielding = rows.reduce(
        (best, row) => Math.max(best, Number(row.fieldingTotal || 0)),
        0
      );

      if (highestScore >= 50) {
        earned.push(
          badge({
            id: "fifty-club",
            icon: "⚡",
            title: "Fifty Club",
            description: `Highest score ${highestScore}`,
            category: "Batting",
          })
        );
      }

      if (highestScore >= 100) {
        earned.push(
          badge({
            id: "centurion",
            icon: "💯",
            title: "Centurion",
            description: `${career.hundreds} career hundred${career.hundreds === 1 ? "" : "s"}`,
            category: "Batting",
            tier: "elite",
          })
        );
      }

      if (Number(career.sixes || 0) >= 10) {
        earned.push(
          badge({
            id: "six-machine",
            icon: "🚀",
            title: "Six Machine",
            description: `${career.sixes} career sixes`,
            category: "Batting",
          })
        );
      }

      if (Number(career.runs || 0) >= 500) {
        earned.push(
          badge({
            id: "500-run-club",
            icon: "🏏",
            title: "500 Run Club",
            description: `${career.runs} career runs`,
            category: "Career",
            tier: "elite",
          })
        );
      } else if (Number(career.runs || 0) >= 250) {
        earned.push(
          badge({
            id: "250-run-club",
            icon: "🏏",
            title: "250 Run Club",
            description: `${career.runs} career runs`,
            category: "Career",
          })
        );
      } else if (Number(career.runs || 0) >= 100) {
        earned.push(
          badge({
            id: "100-run-club",
            icon: "🏏",
            title: "100 Run Club",
            description: `${career.runs} career runs`,
            category: "Career",
          })
        );
      }

      if (bestWickets >= 3) {
        earned.push(
          badge({
            id: "three-wicket-club",
            icon: "🎯",
            title: "3-Wicket Club",
            description: `Best spell ${bestWickets} wickets`,
            category: "Bowling",
          })
        );
      }

      if (bestWickets >= 5) {
        earned.push(
          badge({
            id: "five-for",
            icon: "🔥",
            title: "Five-for",
            description: `Best spell ${bestWickets} wickets`,
            category: "Bowling",
            tier: "elite",
          })
        );
      }

      if (Number(career.wickets || 0) >= 25) {
        earned.push(
          badge({
            id: "25-wicket-club",
            icon: "🎳",
            title: "25 Wicket Club",
            description: `${career.wickets} career wickets`,
            category: "Career",
            tier: "elite",
          })
        );
      } else if (Number(career.wickets || 0) >= 10) {
        earned.push(
          badge({
            id: "10-wicket-club",
            icon: "🎳",
            title: "10 Wicket Club",
            description: `${career.wickets} career wickets`,
            category: "Career",
          })
        );
      }

      if (bestFielding >= 2 || Number(career.fieldingTotal || 0) >= 10) {
        earned.push(
          badge({
            id: "safe-hands",
            icon: "🧤",
            title: "Safe Hands",
            description: `${career.fieldingTotal} career fielding contributions`,
            category: "Fielding",
          })
        );
      }

      if (
        Number(career.runOuts || 0) +
          Number(career.assists || 0) >=
        5
      ) {
        earned.push(
          badge({
            id: "run-out-specialist",
            icon: "🎯",
            title: "Run-out Specialist",
            description: `${Number(career.runOuts || 0) + Number(career.assists || 0)} run-out contributions`,
            category: "Fielding",
          })
        );
      }

      if (
        Number(career.runs || 0) >= 100 &&
        Number(career.wickets || 0) >= 5
      ) {
        earned.push(
          badge({
            id: "all-round-force",
            icon: "🌟",
            title: "All-Round Force",
            description: `${career.runs} runs · ${career.wickets} wickets`,
            category: "All-Round",
            tier: "elite",
          })
        );
      }

      if (Number(career.matches || 0) >= 25) {
        earned.push(
          badge({
            id: "iron-presence",
            icon: "🎽",
            title: "Iron Presence",
            description: `${career.matches} qualifying appearances`,
            category: "Career",
            tier: "elite",
          })
        );
      } else if (Number(career.matches || 0) >= 10) {
        earned.push(
          badge({
            id: "regular",
            icon: "🎽",
            title: "League Regular",
            description: `${career.matches} qualifying appearances`,
            category: "Career",
          })
        );
      }

      return {
        key: career.key,
        playerId: career.playerId,
        playerName: career.playerName,
        teamName: career.teamName || "",
        badgeCount: earned.length,
        eliteCount: earned.filter((item) => item.tier === "elite").length,
        badges: earned,
        headline:
          earned.find((item) => item.tier === "elite") ||
          earned[0] ||
          null,
      };
    })
    .filter((row) => row.badgeCount > 0)
    .sort(
      (a, b) =>
        b.eliteCount - a.eliteCount ||
        b.badgeCount - a.badgeCount ||
        a.playerName.localeCompare(b.playerName)
    );
}

function buildProgress(careerRows) {
  return careerRows
    .map((career) => {
      const metrics = [
        {
          ...progressMetric("runs", career.runs),
          icon: "🏏",
          label: "Runs",
        },
        {
          ...progressMetric("wickets", career.wickets),
          icon: "🎯",
          label: "Wickets",
        },
        {
          ...progressMetric("fielding", career.fieldingTotal),
          icon: "🧤",
          label: "Fielding",
        },
        {
          ...progressMetric("matches", career.matches),
          icon: "🎽",
          label: "Appearances",
        },
      ];

      const nearest = [...metrics]
        .filter((metric) => !metric.complete)
        .sort(
          (a, b) =>
            b.progress - a.progress ||
            a.remaining - b.remaining
        )[0] || null;

      return {
        key: career.key,
        playerId: career.playerId,
        playerName: career.playerName,
        teamName: career.teamName || "",
        runs: career.runs,
        wickets: career.wickets,
        fielding: career.fieldingTotal,
        matches: career.matches,
        strikeRate: career.strikeRate,
        economy: career.economy,
        metrics,
        nearest,
      };
    })
    .sort(
      (a, b) =>
        Number(b.nearest?.progress || 0) -
          Number(a.nearest?.progress || 0) ||
        a.playerName.localeCompare(b.playerName)
    );
}

function teamOfWeek(performanceRows, matches) {
  if (!matches.length) {
    return { windowLabel: "No completed matches", lineup: [] };
  }

  const latestDate = matchDate(matches[matches.length - 1]);
  const windowEnd = latestDate.getTime();
  const windowStart = windowEnd - 6 * 24 * 60 * 60 * 1000;
  const weekly = performanceRows.filter(
    (row) => row.date >= windowStart && row.date <= windowEnd
  );
  const aggregated = aggregate(weekly)
    .map((row) => ({
      ...row,
      selectionScore: row.overallPoints,
      role:
        row.stumpings > 0
          ? "WK"
          : row.runs >= 20 && row.wickets >= 2
            ? "AR"
            : row.wickets >= 2 && row.bowlingPoints > row.battingPoints
              ? "BOWL"
              : "BAT",
    }))
    .sort(
      (a, b) =>
        b.selectionScore - a.selectionScore ||
        b.runs - a.runs ||
        b.wickets - a.wickets
    );

  let lineup = aggregated.slice(0, 11);
  const keeper = aggregated.find((row) => row.stumpings > 0);

  if (keeper && !lineup.some((row) => row.key === keeper.key) && lineup.length) {
    lineup = [...lineup.slice(0, -1), keeper].sort(
      (a, b) => b.selectionScore - a.selectionScore
    );
  }

  lineup = lineup.map((row, index) => ({
    ...row,
    captain: index === 0,
    wicketkeeper: keeper?.key === row.key,
  }));

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  return {
    windowLabel: `${formatter.format(new Date(windowStart))} – ${formatter.format(latestDate)}`,
    lineup,
  };
}

export function buildPlayerPerformanceCenter(matches = [], league) {
  const eligibleMatches = sortMatches(matches);
  const roster = buildRoster(league);
  const performanceRows = eligibleMatches.flatMap((match) =>
    buildMatchPerformances(match, league, roster)
  );
  const career = aggregate(performanceRows);

  const categories = ["batting", "bowling", "fielding", "overall"];
  const rankings = {};

  for (const category of categories) {
    const snapshots = rankingSnapshots(eligibleMatches, league, roster, category);
    const current = snapshots[snapshots.length - 1] || [];
    const previous = snapshots[snapshots.length - 2] || [];

    rankings[category] = attachRankMovement(
      current,
      previous,
      snapshots
    ).slice(0, 25);
  }

  return {
    completedMatches: eligibleMatches.length,
    playerCount: career.length,
    rankings,
    form: buildForm(performanceRows),
    streaks: buildStreaks(performanceRows),
    achievements: buildAchievements(performanceRows, career),
    progress: buildProgress(career),
    teamOfWeek: teamOfWeek(performanceRows, eligibleMatches),
  };
}
