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
        form: recentFormForTeam(completedMatches, teamAId),
        dna:
          teamDNA.find(
            (team) => Number(team.teamId) === teamAId
          ) || null,
        watch: playerWatchForTeam(playerRows, teamAId),
      },

      teamB: {
        teamId: teamBId,
        teamName: teamBName,
        form: recentFormForTeam(completedMatches, teamBId),
        dna:
          teamDNA.find(
            (team) => Number(team.teamId) === teamBId
          ) || null,
        watch: playerWatchForTeam(playerRows, teamBId),
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
