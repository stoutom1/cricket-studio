import {
  shouldExcludePlayerFromLeagueAnalytics,
} from "@/lib/player-analytics-exclusions";

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

function matchTime(match) {
  const value =
    match?.scheduledAt ||
    match?.startedAt ||
    match?.createdAt;

  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function completedTime(match) {
  const value =
    match?.endedAt ||
    match?.lockedAt ||
    match?.startedAt ||
    match?.scheduledAt ||
    match?.createdAt;

  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function formatDateTime(match) {
  const value =
    match?.scheduledAt ||
    match?.startedAt ||
    match?.createdAt;

  if (!value) return "Date not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function buildRoster(teams = []) {
  const roster = new Map();

  for (const team of teams) {
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
      playerName:
        fallback.playerName ||
        (numericId ? `Player ${numericId}` : "Player"),
      teamId: Number(fallback.teamId) || null,
      teamName: fallback.teamName || "",
    }
  );
}

function playerKey(playerId, playerName) {
  const numericId = Number(playerId);

  if (Number.isInteger(numericId) && numericId > 0) {
    return `id:${numericId}`;
  }

  return `name:${String(playerName || "")
    .trim()
    .toLowerCase()}`;
}

function sortBalls(balls = []) {
  return [...balls].sort(
    (a, b) =>
      Number(a.inningsNo || 0) - Number(b.inningsNo || 0) ||
      Number(a.sequence || 0) - Number(b.sequence || 0) ||
      Number(a.id || 0) - Number(b.id || 0)
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

  if (
    teamAName &&
    statusText.includes(teamAName) &&
    !statusText.includes("tied")
  ) {
    return Number(match?.teamAId || match?.teamA?.id) || null;
  }

  if (
    teamBName &&
    statusText.includes(teamBName) &&
    !statusText.includes("tied")
  ) {
    return Number(match?.teamBId || match?.teamB?.id) || null;
  }

  return null;
}

function isTied(match) {
  return String(match?.statusText || "")
    .toLowerCase()
    .includes("tied");
}

function isBetween(match, teamAId, teamBId) {
  const ids = [
    Number(match?.teamAId || match?.teamA?.id),
    Number(match?.teamBId || match?.teamB?.id),
  ].sort((a, b) => a - b);

  const target = [Number(teamAId), Number(teamBId)].sort(
    (a, b) => a - b
  );

  return ids[0] === target[0] && ids[1] === target[1];
}

function isBowlerWicket(ball) {
  if (!ball?.isWicket) return false;

  const wicketType = String(ball?.wicketType || "")
    .trim()
    .toUpperCase();

  if (
    ["RUN_OUT", "RETIRED_OUT", "RETIRED_HURT"].includes(
      wicketType
    )
  ) {
    return false;
  }

  return (
    String(ball?.extraType || "")
      .trim()
      .toUpperCase() !== "NOBALL"
  );
}

function buildPlayerWatch({
  completedMatches,
  teams,
  league,
}) {
  const roster = buildRoster(teams);
  const players = new Map();

  function ensure(playerId, fallback = {}) {
    const player = getPlayer(roster, playerId, fallback);

    if (
      !player.playerId ||
      shouldExcludePlayerFromLeagueAnalytics(
        league,
        player.playerName
      )
    ) {
      return null;
    }

    const key = playerKey(player.playerId, player.playerName);

    if (!players.has(key)) {
      players.set(key, {
        ...player,
        runs: 0,
        balls: 0,
        wickets: 0,
        bowlingBalls: 0,
        bowlingRuns: 0,
        matches: new Set(),
      });
    }

    return players.get(key);
  }

  for (const match of completedMatches) {
    for (const ball of sortBalls(match?.balls || [])) {
      const striker = ensure(ball?.strikerId, {
        playerName: ball?.striker?.name,
        teamId: ball?.striker?.teamId || ball?.striker?.team?.id,
        teamName: ball?.striker?.team?.name,
      });

      if (striker) {
        striker.runs += Number(ball?.runsOffBat || 0);

        if (
          String(ball?.extraType || "").toUpperCase() !== "WIDE" &&
          String(ball?.extraType || "").toUpperCase() !== "NOBALL" &&
          String(ball?.wicketType || "").toUpperCase() !== "RETIRED_HURT"
        ) {
          striker.balls += 1;
        }

        striker.matches.add(Number(match.id));
      }

      const bowler = ensure(ball?.bowlerId, {
        playerName: ball?.bowler?.name,
        teamId: ball?.bowler?.teamId || ball?.bowler?.team?.id,
        teamName: ball?.bowler?.team?.name,
      });

      if (bowler) {
        const extraType = String(ball?.extraType || "")
          .trim()
          .toUpperCase();

        if (!["BYE", "LEGBYE"].includes(extraType)) {
          bowler.bowlingRuns += Number(ball?.totalRuns || 0);
        }

        if (ball?.legalDelivery) {
          bowler.bowlingBalls += 1;
        }

        if (isBowlerWicket(ball)) {
          bowler.wickets += 1;
        }

        bowler.matches.add(Number(match.id));
      }
    }
  }

  return [...players.values()].map((player) => ({
    ...player,
    matches: player.matches.size,
    strikeRate:
      player.balls > 0
        ? (player.runs / player.balls) * 100
        : 0,
    economy:
      player.bowlingBalls > 0
        ? player.bowlingRuns / (player.bowlingBalls / 6)
        : 0,
  }));
}

function recentFormForTeam(completedMatches, teamId) {
  return completedMatches
    .filter(
      (match) =>
        Number(match?.teamAId || match?.teamA?.id) === Number(teamId) ||
        Number(match?.teamBId || match?.teamB?.id) === Number(teamId)
    )
    .sort((a, b) => completedTime(b) - completedTime(a))
    .slice(0, 5)
    .map((match) => {
      if (isTied(match)) return "T";

      const winnerId = getWinnerTeamId(match);

      if (!winnerId) return "—";
      return Number(winnerId) === Number(teamId) ? "W" : "L";
    });
}

function lastMeetingSummary(match, teamAId, teamBId) {
  if (!match) return null;

  if (isTied(match)) {
    return {
      result: "Match tied",
      winnerTeamId: null,
      matchId: Number(match.id),
    };
  }

  const winnerTeamId = getWinnerTeamId(match);

  if (!winnerTeamId) {
    return {
      result: match?.statusText || "Result unavailable",
      winnerTeamId: null,
      matchId: Number(match.id),
    };
  }

  const winnerName =
    Number(winnerTeamId) === Number(teamAId)
      ? match?.teamAId === teamAId
        ? match?.teamA?.name
        : match?.teamB?.name
      : Number(winnerTeamId) === Number(teamBId)
        ? match?.teamAId === teamBId
          ? match?.teamA?.name
          : match?.teamB?.name
        : "";

  return {
    result:
      match?.statusText ||
      `${winnerName || "Winner"} won`,
    winnerTeamId,
    matchId: Number(match.id),
  };
}

function getTeamName(teams, teamId) {
  return (
    teams.find((team) => Number(team.id) === Number(teamId))?.name ||
    `Team ${teamId}`
  );
}

function teamMatches(completedMatches, teamId, limit = 5) {
  return completedMatches
    .filter(
      (match) =>
        Number(match?.teamAId || match?.teamA?.id) === Number(teamId) ||
        Number(match?.teamBId || match?.teamB?.id) === Number(teamId)
    )
    .sort((a, b) => completedTime(b) - completedTime(a))
    .slice(0, limit);
}

function recentPlayerFormForTeam({
  completedMatches,
  teams,
  league,
  teamId,
}) {
  const recentMatches = teamMatches(
    completedMatches,
    teamId,
    5
  );

  const rows = buildPlayerWatch({
    completedMatches: recentMatches,
    teams,
    league,
  })
    .filter(
      (player) =>
        Number(player.teamId) === Number(teamId)
    );

  const batter =
    [...rows]
      .filter((player) => player.runs > 0)
      .sort(
        (a, b) =>
          b.runs - a.runs ||
          b.strikeRate - a.strikeRate
      )[0] || null;

  const bowler =
    [...rows]
      .filter((player) => player.wickets > 0)
      .sort(
        (a, b) =>
          b.wickets - a.wickets ||
          a.economy - b.economy
      )[0] || null;

  return {
    matchesConsidered: recentMatches.length,
    batter,
    bowler,
  };
}

function headToHeadStreak(headToHeadMatches, teamAId, teamBId) {
  const newestFirst = [...headToHeadMatches]
    .sort((a, b) => completedTime(b) - completedTime(a));

  if (!newestFirst.length) {
    return null;
  }

  const newest = newestFirst[0];

  if (isTied(newest)) {
    return null;
  }

  const winnerId = Number(getWinnerTeamId(newest));

  if (
    winnerId !== Number(teamAId) &&
    winnerId !== Number(teamBId)
  ) {
    return null;
  }

  let count = 0;

  for (const match of newestFirst) {
    if (
      isTied(match) ||
      Number(getWinnerTeamId(match)) !== winnerId
    ) {
      break;
    }

    count += 1;
  }

  return {
    teamId: winnerId,
    wins: count,
  };
}

function formScore(form = []) {
  return form.reduce((score, result) => {
    if (result === "W") return score + 2;
    if (result === "T") return score + 1;
    return score;
  }, 0);
}

function buildMatchupEdges({
  teamAName,
  teamBName,
  teamADna,
  teamBDna,
}) {
  const edges = [];

  function addEdge({
    icon,
    label,
    teamName,
    value,
    detail,
  }) {
    edges.push({
      icon,
      label,
      teamName,
      value,
      detail,
    });
  }

  if (teamADna && teamBDna) {
    const battingGap =
      Number(teamADna.battingRunRate || 0) -
      Number(teamBDna.battingRunRate || 0);

    if (Math.abs(battingGap) >= 0.25) {
      const stronger =
        battingGap > 0
          ? {
              name: teamAName,
              dna: teamADna,
            }
          : {
              name: teamBName,
              dna: teamBDna,
            };

      addEdge({
        icon: "⚡",
        label: "Batting tempo edge",
        teamName: stronger.name,
        value: `${Number(stronger.dna.battingRunRate || 0).toFixed(2)} RPO`,
        detail: "Higher completed-match scoring rate in this view",
      });
    }

    const economyGap =
      Number(teamADna.bowlingEconomy || 0) -
      Number(teamBDna.bowlingEconomy || 0);

    if (Math.abs(economyGap) >= 0.25) {
      const stronger =
        economyGap < 0
          ? {
              name: teamAName,
              dna: teamADna,
            }
          : {
              name: teamBName,
              dna: teamBDna,
            };

      addEdge({
        icon: "🔒",
        label: "Run-control edge",
        teamName: stronger.name,
        value: `${Number(stronger.dna.bowlingEconomy || 0).toFixed(2)} econ`,
        detail: "Lower completed-match bowling economy",
      });
    }

    const wicketGap =
      Number(teamADna.wicketsPerBowlingInnings || 0) -
      Number(teamBDna.wicketsPerBowlingInnings || 0);

    if (Math.abs(wicketGap) >= 0.5) {
      const stronger =
        wicketGap > 0
          ? {
              name: teamAName,
              dna: teamADna,
            }
          : {
              name: teamBName,
              dna: teamBDna,
            };

      addEdge({
        icon: "🎯",
        label: "Wicket-pressure edge",
        teamName: stronger.name,
        value: `${Number(stronger.dna.wicketsPerBowlingInnings || 0).toFixed(1)} wkts/inn`,
        detail: "Higher wicket-taking rate per bowling innings",
      });
    }
  }

  return edges.slice(0, 3);
}

function buildWatchList({
  teamAName,
  teamBName,
  teamAForm,
  teamBForm,
  teamARecent,
  teamBRecent,
  streak,
  teamAWins,
  teamBWins,
  edges,
}) {
  const notes = [];

  if (streak?.wins >= 2) {
    notes.push(
      `${streak.teamName} enters with ${streak.wins} consecutive head-to-head wins.`
    );
  } else if (teamAWins !== teamBWins && teamAWins + teamBWins > 0) {
    const leader =
      teamAWins > teamBWins
        ? teamAName
        : teamBName;

    notes.push(
      `${leader} holds the current head-to-head lead.`
    );
  }

  const scoreA = formScore(teamAForm);
  const scoreB = formScore(teamBForm);

  if (Math.abs(scoreA - scoreB) >= 2) {
    notes.push(
      `${scoreA > scoreB ? teamAName : teamBName} has the stronger recent results profile.`
    );
  }

  const hotBatter =
    [teamARecent?.batter, teamBRecent?.batter]
      .filter(Boolean)
      .sort(
        (a, b) =>
          Number(b.runs || 0) -
          Number(a.runs || 0)
      )[0] || null;

  if (hotBatter) {
    notes.push(
      `${hotBatter.playerName} is the in-form batter with ${hotBatter.runs} runs across the recent sample.`
    );
  }

  const hotBowler =
    [teamARecent?.bowler, teamBRecent?.bowler]
      .filter(Boolean)
      .sort(
        (a, b) =>
          Number(b.wickets || 0) -
          Number(a.wickets || 0)
      )[0] || null;

  if (hotBowler) {
    notes.push(
      `${hotBowler.playerName} brings the strongest recent bowling return with ${hotBowler.wickets} wicket${hotBowler.wickets === 1 ? "" : "s"}.`
    );
  }

  if (edges?.[0]) {
    notes.push(
      `${edges[0].teamName} owns the clearest statistical edge: ${edges[0].label.toLowerCase()}.`
    );
  }

  if (!notes.length) {
    notes.push(
      "The available completed-match evidence does not show a clear pre-match edge yet."
    );
  }

  return notes.slice(0, 4);
}

function playerWatchForTeam(playerRows, teamId) {
  const teamPlayers = playerRows.filter(
    (player) => Number(player.teamId) === Number(teamId)
  );

  const batter =
    [...teamPlayers]
      .filter((player) => player.runs > 0)
      .sort(
        (a, b) =>
          b.runs - a.runs ||
          b.strikeRate - a.strikeRate
      )[0] || null;

  const bowler =
    [...teamPlayers]
      .filter((player) => player.wickets > 0)
      .sort(
        (a, b) =>
          b.wickets - a.wickets ||
          a.economy - b.economy
      )[0] || null;

  return {
    batter,
    bowler,
  };
}

export function buildPreMatchCenter({
  matches = [],
  teams = [],
  league,
  teamDNA = [],
}) {
  const scheduledMatches = [...matches]
    .filter((match) =>
      ["SCHEDULED", "UPCOMING"].includes(
        normalizeStatus(match?.status)
      )
    )
    .sort((a, b) => matchTime(a) - matchTime(b));

  const completedMatches = [...matches]
    .filter((match) =>
      COMPLETED_STATUSES.has(
        normalizeStatus(match?.status)
      )
    )
    .sort((a, b) => completedTime(a) - completedTime(b));

  const playerRows = buildPlayerWatch({
    completedMatches,
    teams,
    league,
  });

  const previews = scheduledMatches.map((match) => {
    const teamAId = Number(match?.teamAId || match?.teamA?.id);
    const teamBId = Number(match?.teamBId || match?.teamB?.id);

    const headToHeadMatches = completedMatches
      .filter((completed) =>
        isBetween(completed, teamAId, teamBId)
      )
      .sort((a, b) => completedTime(b) - completedTime(a));

    let teamAWins = 0;
    let teamBWins = 0;
    let ties = 0;

    for (const meeting of headToHeadMatches) {
      if (isTied(meeting)) {
        ties += 1;
        continue;
      }

      const winnerId = getWinnerTeamId(meeting);

      if (Number(winnerId) === teamAId) teamAWins += 1;
      if (Number(winnerId) === teamBId) teamBWins += 1;
    }

    const teamAName =
      match?.teamA?.name || getTeamName(teams, teamAId);
    const teamBName =
      match?.teamB?.name || getTeamName(teams, teamBId);

    const teamAForm =
      recentFormForTeam(completedMatches, teamAId);
    const teamBForm =
      recentFormForTeam(completedMatches, teamBId);

    const teamADna =
      teamDNA.find(
        (team) => Number(team.teamId) === teamAId
      ) || null;

    const teamBDna =
      teamDNA.find(
        (team) => Number(team.teamId) === teamBId
      ) || null;

    const recentTeamA =
      recentPlayerFormForTeam({
        completedMatches,
        teams,
        league,
        teamId: teamAId,
      });

    const recentTeamB =
      recentPlayerFormForTeam({
        completedMatches,
        teams,
        league,
        teamId: teamBId,
      });

    const h2hStreak =
      headToHeadStreak(
        headToHeadMatches,
        teamAId,
        teamBId
      );

    const rivalryStreak =
      h2hStreak
        ? {
            ...h2hStreak,
            teamName:
              Number(h2hStreak.teamId) === teamAId
                ? teamAName
                : teamBName,
          }
        : null;

    const matchupEdges =
      buildMatchupEdges({
        teamAName,
        teamBName,
        teamADna,
        teamBDna,
      });

    const watchList =
      buildWatchList({
        teamAName,
        teamBName,
        teamAForm,
        teamBForm,
        teamARecent: recentTeamA,
        teamBRecent: recentTeamB,
        streak: rivalryStreak,
        teamAWins,
        teamBWins,
        edges: matchupEdges,
      });

    return {
      matchId: Number(match.id),
      teamAId,
      teamBId,
      teamAName,
      teamBName,
      scheduledLabel: formatDateTime(match),
      venue:
        match?.venueName ||
        match?.venueAddress ||
        "Venue not set",
      seriesName:
        match?.series?.name ||
        "League match",

      headToHead: {
        matches: headToHeadMatches.length,
        teamAWins,
        teamBWins,
        ties,
        lastMeeting: lastMeetingSummary(
          headToHeadMatches[0],
          teamAId,
          teamBId
        ),
      },

      teamA: {
        teamId: teamAId,
        teamName: teamAName,
        form: teamAForm,
        dna: teamADna,
        watch: playerWatchForTeam(playerRows, teamAId),
        recent: recentTeamA,
      },

      teamB: {
        teamId: teamBId,
        teamName: teamBName,
        form: teamBForm,
        dna: teamBDna,
        watch: playerWatchForTeam(playerRows, teamBId),
        recent: recentTeamB,
      },

      intelligence: {
        rivalryStreak,
        matchupEdges,
        watchList,
        recentFormScore: {
          teamA: formScore(teamAForm),
          teamB: formScore(teamBForm),
        },
      },

      href:
        league?.slug
          ? `/leagues/${league.slug}/matches/${match.id}`
          : "",
    };
  });

  return {
    previews,
    scheduledCount: previews.length,
    completedContextMatches: completedMatches.length,
  };
}
