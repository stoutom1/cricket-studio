import {
  shouldExcludePlayerFromLeagueAnalytics,
} from "@/lib/player-analytics-exclusions";

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

function playerKey(playerId, playerName) {
  const numericId = Number(playerId);

  if (Number.isInteger(numericId) && numericId > 0) {
    return `id:${numericId}`;
  }

  return `name:${String(playerName || "")
    .trim()
    .toLowerCase()}`;
}

function oversFromBalls(balls) {
  const legalBalls = Number(balls || 0);
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

function sortBalls(balls = []) {
  return [...balls].sort(
    (a, b) =>
      Number(a.inningsNo || 0) - Number(b.inningsNo || 0) ||
      Number(a.sequence || 0) - Number(b.sequence || 0) ||
      Number(a.id || 0) - Number(b.id || 0)
  );
}

function isBowlerWicket(ball) {
  if (!ball?.isWicket) return false;

  const wicketType = String(ball.wicketType || "")
    .trim()
    .toUpperCase();

  if (["RUN_OUT", "RETIRED_OUT", "RETIRED_HURT"].includes(wicketType)) {
    return false;
  }

  return String(ball.extraType || "").trim().toUpperCase() !== "NOBALL";
}

function bowlerRuns(ball) {
  const extraType = String(ball?.extraType || "")
    .trim()
    .toUpperCase();

  if (["BYE", "LEGBYE"].includes(extraType)) return 0;
  return Number(ball?.totalRuns || 0);
}

function getRoster(league) {
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
  const numericId = Number(playerId);
  return (
    roster.get(numericId) || {
      playerId: numericId || null,
      playerName: fallback.playerName || `Player ${numericId || ""}`.trim(),
      teamId: Number(fallback.teamId) || null,
      teamName: fallback.teamName || "",
    }
  );
}

function recordLink(match, league) {
  if (!match?.id || !league?.slug) return "";
  return `/leagues/${league.slug}/matches/${match.id}`;
}

function matchLabel(match) {
  return `${match?.teamA?.name || "Team A"} vs ${match?.teamB?.name || "Team B"}`;
}

function compareHighest(a, b, valueKey, tieKey = null) {
  if (!a) return b;
  if (!b) return a;

  const aValue = Number(a[valueKey] || 0);
  const bValue = Number(b[valueKey] || 0);

  if (bValue !== aValue) {
    return bValue > aValue ? b : a;
  }

  if (tieKey) {
    const aTie = Number(a[tieKey] || 0);
    const bTie = Number(b[tieKey] || 0);
    if (bTie !== aTie) return bTie > aTie ? b : a;
  }

  return a;
}

function compareBestBowling(a, b) {
  if (!a) return b;
  if (!b) return a;

  if (Number(b.wickets || 0) !== Number(a.wickets || 0)) {
    return Number(b.wickets || 0) > Number(a.wickets || 0) ? b : a;
  }

  if (Number(b.runs || 0) !== Number(a.runs || 0)) {
    return Number(b.runs || 0) < Number(a.runs || 0) ? b : a;
  }

  return Number(b.balls || 0) < Number(a.balls || 0) ? b : a;
}

function buildPartnerships({ balls, roster, league, match }) {
  const completed = [];
  const currentByInnings = new Map();

  function finish(inningsNo) {
    const current = currentByInnings.get(inningsNo);

    if (current && current.runs > 0 && current.playerNames.length === 2) {
      completed.push(current);
    }

    currentByInnings.delete(inningsNo);
  }

  for (const ball of balls) {
    const inningsNo = Number(ball.inningsNo || 1);
    const striker = getPlayer(roster, ball.strikerId, {
      playerName: ball.striker?.name,
      teamName: ball.striker?.team?.name,
      teamId: ball.striker?.team?.id,
    });
    const nonStriker = getPlayer(roster, ball.nonStrikerId);

    const pair = [striker, nonStriker].filter(
      (player) =>
        player?.playerId &&
        !shouldExcludePlayerFromLeagueAnalytics(league, player.playerName)
    );

    if (pair.length !== 2) continue;

    const pairKey = pair
      .map((player) => Number(player.playerId))
      .sort((a, b) => a - b)
      .join(":");

    let current = currentByInnings.get(inningsNo);

    if (!current || current.pairKey !== pairKey) {
      finish(inningsNo);

      current = {
        inningsNo,
        pairKey,
        playerNames: pair.map((player) => player.playerName),
        teamName: striker.teamName || nonStriker.teamName || "",
        runs: 0,
        balls: 0,
        match,
      };

      currentByInnings.set(inningsNo, current);
    }

    current.runs += Number(ball.totalRuns || 0);
    if (ball.legalDelivery) current.balls += 1;

    if (
      ball.isWicket &&
      String(ball.wicketType || "").trim().toUpperCase() !== "RETIRED_HURT"
    ) {
      finish(inningsNo);
    }
  }

  for (const inningsNo of [...currentByInnings.keys()]) {
    finish(inningsNo);
  }

  return completed;
}

function makeRecord({
  id,
  icon,
  category,
  title,
  value,
  holder,
  teamName,
  detail,
  match,
  league,
  accent,
}) {
  return {
    id,
    icon,
    category,
    title,
    value,
    holder: holder || "",
    teamName: teamName || "",
    detail: detail || "",
    matchLabel: match ? matchLabel(match) : "",
    href: match ? recordLink(match, league) : "",
    accent: accent || category.toLowerCase(),
  };
}

export function buildLeagueRecords(matches = [], league) {
  const eligibleMatches = (matches || []).filter((match) =>
    COMPLETED_STATUSES.has(normalizeStatus(match?.status))
  );

  if (!eligibleMatches.length) {
    return {
      records: [],
      completedMatches: 0,
      recordCount: 0,
    };
  }

  const roster = getRoster(league);

  let highestScore = null;
  let mostSixes = null;
  let fastestFifty = null;
  let bestBowling = null;
  let bestPartnership = null;
  let highestTeamTotal = null;
  let biggestChase = null;
  let lowestDefended = null;
  let narrowestRunWin = null;
  let highestMatchAggregate = null;

  for (const match of eligibleMatches) {
    const balls = sortBalls(match.balls || []);
    if (!balls.length) continue;

    const innings = new Map();

    function ensureInnings(inningsNo) {
      if (!innings.has(inningsNo)) {
        innings.set(inningsNo, {
          inningsNo,
          teamId: null,
          teamName: "",
          runs: 0,
          wickets: 0,
          legalBalls: 0,
          batting: new Map(),
          bowling: new Map(),
        });
      }

      return innings.get(inningsNo);
    }

    for (const ball of balls) {
      const inningsNo = Number(ball.inningsNo || 1);
      const inningsRow = ensureInnings(inningsNo);

      const striker = getPlayer(roster, ball.strikerId, {
        playerName: ball.striker?.name,
        teamName: ball.striker?.team?.name,
        teamId: ball.striker?.team?.id,
      });

      if (!inningsRow.teamId && striker.teamId) {
        inningsRow.teamId = Number(striker.teamId);
        inningsRow.teamName = striker.teamName || "";
      }

      inningsRow.runs += Number(ball.totalRuns || 0);

      if (ball.legalDelivery) {
        inningsRow.legalBalls += 1;
      }

      if (
        ball.isWicket &&
        String(ball.wicketType || "").trim().toUpperCase() !== "RETIRED_HURT"
      ) {
        inningsRow.wickets += 1;
      }

      if (
        striker.playerId &&
        !shouldExcludePlayerFromLeagueAnalytics(league, striker.playerName)
      ) {
        const key = playerKey(striker.playerId, striker.playerName);

        if (!inningsRow.batting.has(key)) {
          inningsRow.batting.set(key, {
            playerId: striker.playerId,
            playerName: striker.playerName,
            teamName: striker.teamName || inningsRow.teamName || "",
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            ballsToFifty: null,
            match,
          });
        }

        const batting = inningsRow.batting.get(key);
        const beforeRuns = batting.runs;
        batting.runs += Number(ball.runsOffBat || 0);

        if (
          ball.extraType !== "WIDE" &&
          ball.extraType !== "NOBALL" &&
          ball.wicketType !== "RETIRED_HURT"
        ) {
          batting.balls += 1;
        }

        if (Number(ball.runsOffBat || 0) === 4) batting.fours += 1;
        if (Number(ball.runsOffBat || 0) === 6) batting.sixes += 1;

        if (
          batting.ballsToFifty === null &&
          beforeRuns < 50 &&
          batting.runs >= 50
        ) {
          batting.ballsToFifty = batting.balls;
        }
      }

      const bowler = getPlayer(roster, ball.bowlerId, {
        playerName: ball.bowler?.name,
        teamName: ball.bowler?.team?.name,
        teamId: ball.bowler?.team?.id,
      });

      if (
        bowler.playerId &&
        !shouldExcludePlayerFromLeagueAnalytics(league, bowler.playerName)
      ) {
        const key = playerKey(bowler.playerId, bowler.playerName);

        if (!inningsRow.bowling.has(key)) {
          inningsRow.bowling.set(key, {
            playerId: bowler.playerId,
            playerName: bowler.playerName,
            teamName: bowler.teamName || "",
            balls: 0,
            runs: 0,
            wickets: 0,
            match,
          });
        }

        const bowling = inningsRow.bowling.get(key);
        bowling.runs += bowlerRuns(ball);

        if (
          ball.legalDelivery &&
          ball.extraType !== "WIDE" &&
          ball.extraType !== "NOBALL" &&
          ball.wicketType !== "RETIRED_HURT"
        ) {
          bowling.balls += 1;
        }

        if (isBowlerWicket(ball)) {
          bowling.wickets += 1;
        }
      }
    }

    for (const inningsRow of innings.values()) {
      for (const batting of inningsRow.batting.values()) {
        highestScore = compareHighest(highestScore, batting, "runs", "balls");
        mostSixes = compareHighest(mostSixes, batting, "sixes", "runs");

        if (batting.ballsToFifty !== null) {
          if (
            !fastestFifty ||
            batting.ballsToFifty < fastestFifty.ballsToFifty ||
            (batting.ballsToFifty === fastestFifty.ballsToFifty &&
              batting.runs > fastestFifty.runs)
          ) {
            fastestFifty = batting;
          }
        }
      }

      for (const bowling of inningsRow.bowling.values()) {
        if (bowling.wickets > 0) {
          bestBowling = compareBestBowling(bestBowling, bowling);
        }
      }

      const inningsCandidate = {
        ...inningsRow,
        match,
      };

      highestTeamTotal = compareHighest(
        highestTeamTotal,
        inningsCandidate,
        "runs",
        "legalBalls"
      );
    }

    const partnershipCandidate = buildPartnerships({
      balls,
      roster,
      league,
      match,
    })[0];

    if (
      partnershipCandidate &&
      (!bestPartnership ||
        partnershipCandidate.runs > bestPartnership.runs ||
        (partnershipCandidate.runs === bestPartnership.runs &&
          partnershipCandidate.balls < bestPartnership.balls))
    ) {
      bestPartnership = partnershipCandidate;
    }

    const first = innings.get(1);
    const second = innings.get(2);

    if (first && second) {
      const aggregate = first.runs + second.runs;

      if (
        !highestMatchAggregate ||
        aggregate > highestMatchAggregate.aggregate
      ) {
        highestMatchAggregate = {
          aggregate,
          first,
          second,
          match,
        };
      }

      if (second.runs > first.runs) {
        if (!biggestChase || second.runs > biggestChase.second.runs) {
          biggestChase = {
            first,
            second,
            match,
          };
        }
      } else if (first.runs > second.runs) {
        const margin = first.runs - second.runs;

        if (!lowestDefended || first.runs < lowestDefended.first.runs) {
          lowestDefended = {
            first,
            second,
            margin,
            match,
          };
        }

        if (!narrowestRunWin || margin < narrowestRunWin.margin) {
          narrowestRunWin = {
            first,
            second,
            margin,
            match,
          };
        }
      }
    }
  }

  const records = [];

  if (highestScore) {
    records.push(
      makeRecord({
        id: "highest-score",
        icon: "👑",
        category: "Player",
        title: "Highest individual score",
        value: `${highestScore.runs}`,
        holder: highestScore.playerName,
        teamName: highestScore.teamName,
        detail: `${highestScore.balls} balls · ${highestScore.fours} fours · ${highestScore.sixes} sixes`,
        match: highestScore.match,
        league,
        accent: "gold",
      })
    );
  }

  if (bestBowling) {
    records.push(
      makeRecord({
        id: "best-bowling",
        icon: "🎯",
        category: "Player",
        title: "Best bowling figures",
        value: `${bestBowling.wickets}/${bestBowling.runs}`,
        holder: bestBowling.playerName,
        teamName: bestBowling.teamName,
        detail: `${oversFromBalls(bestBowling.balls)} overs`,
        match: bestBowling.match,
        league,
        accent: "purple",
      })
    );
  }

  if (fastestFifty) {
    records.push(
      makeRecord({
        id: "fastest-fifty",
        icon: "⚡",
        category: "Player",
        title: "Fastest fifty",
        value: `${fastestFifty.ballsToFifty} balls`,
        holder: fastestFifty.playerName,
        teamName: fastestFifty.teamName,
        detail: `${fastestFifty.runs} runs in the innings`,
        match: fastestFifty.match,
        league,
        accent: "orange",
      })
    );
  }

  if (mostSixes && mostSixes.sixes > 0) {
    records.push(
      makeRecord({
        id: "most-sixes",
        icon: "🚀",
        category: "Player",
        title: "Most sixes in an innings",
        value: `${mostSixes.sixes}`,
        holder: mostSixes.playerName,
        teamName: mostSixes.teamName,
        detail: `${mostSixes.runs} runs · ${mostSixes.balls} balls`,
        match: mostSixes.match,
        league,
        accent: "blue",
      })
    );
  }

  if (bestPartnership) {
    records.push(
      makeRecord({
        id: "best-partnership",
        icon: "🤝",
        category: "Partnership",
        title: "Highest partnership",
        value: `${bestPartnership.runs}`,
        holder: bestPartnership.playerNames.join(" & "),
        teamName: bestPartnership.teamName,
        detail: `${bestPartnership.balls} legal balls`,
        match: bestPartnership.match,
        league,
        accent: "green",
      })
    );
  }

  if (highestTeamTotal) {
    records.push(
      makeRecord({
        id: "highest-team-total",
        icon: "📈",
        category: "Team",
        title: "Highest team total",
        value: `${highestTeamTotal.runs}/${highestTeamTotal.wickets}`,
        holder: highestTeamTotal.teamName || "Team",
        detail: `${oversFromBalls(highestTeamTotal.legalBalls)} overs`,
        match: highestTeamTotal.match,
        league,
        accent: "blue",
      })
    );
  }

  if (biggestChase) {
    records.push(
      makeRecord({
        id: "biggest-chase",
        icon: "🏃",
        category: "Team",
        title: "Highest successful chase",
        value: `${biggestChase.second.runs}/${biggestChase.second.wickets}`,
        holder: biggestChase.second.teamName || "Chasing team",
        detail: `Target ${biggestChase.first.runs + 1}`,
        match: biggestChase.match,
        league,
        accent: "green",
      })
    );
  }

  if (lowestDefended) {
    records.push(
      makeRecord({
        id: "lowest-defended",
        icon: "🛡️",
        category: "Team",
        title: "Lowest total defended",
        value: `${lowestDefended.first.runs}/${lowestDefended.first.wickets}`,
        holder: lowestDefended.first.teamName || "Defending team",
        detail: `Won by ${lowestDefended.margin} run${lowestDefended.margin === 1 ? "" : "s"}`,
        match: lowestDefended.match,
        league,
        accent: "purple",
      })
    );
  }

  if (narrowestRunWin) {
    records.push(
      makeRecord({
        id: "narrowest-run-win",
        icon: "😮",
        category: "Match",
        title: "Narrowest run victory",
        value: `${narrowestRunWin.margin} run${narrowestRunWin.margin === 1 ? "" : "s"}`,
        holder: narrowestRunWin.first.teamName || "Winning team",
        detail: `${narrowestRunWin.first.runs} defended`,
        match: narrowestRunWin.match,
        league,
        accent: "orange",
      })
    );
  }

  if (highestMatchAggregate) {
    records.push(
      makeRecord({
        id: "highest-match-aggregate",
        icon: "🔥",
        category: "Match",
        title: "Highest match aggregate",
        value: `${highestMatchAggregate.aggregate} runs`,
        holder: matchLabel(highestMatchAggregate.match),
        detail: `${highestMatchAggregate.first.runs} + ${highestMatchAggregate.second.runs}`,
        match: highestMatchAggregate.match,
        league,
        accent: "red",
      })
    );
  }

  return {
    records,
    completedMatches: eligibleMatches.length,
    recordCount: records.length,
  };
}
