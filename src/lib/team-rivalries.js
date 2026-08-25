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

function matchDate(match) {
  const value =
    match?.endedAt ||
    match?.lockedAt ||
    match?.startedAt ||
    match?.scheduledAt ||
    match?.createdAt;

  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(match) {
  const date = matchDate(match);

  if (!date) return "Date unavailable";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function teamIdFrom(match, side) {
  return Number(
    side === "a"
      ? match?.teamAId || match?.teamA?.id
      : match?.teamBId || match?.teamB?.id
  ) || null;
}

function pairKey(teamAId, teamBId) {
  return [Number(teamAId), Number(teamBId)]
    .sort((a, b) => a - b)
    .join(":");
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

function getBallBattingTeamId(ball, roster) {
  return (
    Number(ball?.striker?.teamId) ||
    Number(ball?.striker?.team?.id) ||
    Number(roster.get(Number(ball?.strikerId))?.teamId) ||
    null
  );
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

function buildInnings(match, roster) {
  const innings = new Map();

  function ensure(inningsNo) {
    if (!innings.has(inningsNo)) {
      innings.set(inningsNo, {
        inningsNo,
        teamId: null,
        runs: 0,
        wickets: 0,
        legalBalls: 0,
      });
    }

    return innings.get(inningsNo);
  }

  for (const ball of sortBalls(match?.balls || [])) {
    const inningsNo = Number(ball?.inningsNo || 1);
    const row = ensure(inningsNo);

    if (!row.teamId) {
      row.teamId = getBallBattingTeamId(ball, roster);
    }

    row.runs += Number(ball?.totalRuns || 0);

    if (ball?.legalDelivery) {
      row.legalBalls += 1;
    }

    const wicketType = String(ball?.wicketType || "")
      .trim()
      .toUpperCase();

    if (ball?.isWicket && wicketType !== "RETIRED_HURT") {
      row.wickets += 1;
    }
  }

  return [...innings.values()].sort(
    (a, b) => a.inningsNo - b.inningsNo
  );
}

function inferOutcome(match, inningsRows) {
  const explicitWinner =
    Number(match?.winnerTeamId) ||
    Number(match?.winnerId) ||
    null;

  if (explicitWinner) {
    return {
      winnerTeamId: explicitWinner,
      tied: false,
    };
  }

  const statusText = String(
    match?.statusText ||
    match?.resultText ||
    ""
  ).toLowerCase();

  if (statusText.includes("tied")) {
    return {
      winnerTeamId: null,
      tied: true,
    };
  }

  if (inningsRows.length >= 2) {
    const first = inningsRows[0];
    const second = inningsRows[1];

    if (first.runs === second.runs) {
      return {
        winnerTeamId: null,
        tied: true,
      };
    }

    return {
      winnerTeamId:
        first.runs > second.runs
          ? Number(first.teamId)
          : Number(second.teamId),
      tied: false,
    };
  }

  const teamAId = teamIdFrom(match, "a");
  const teamBId = teamIdFrom(match, "b");
  const teamAName = String(match?.teamA?.name || "").toLowerCase();
  const teamBName = String(match?.teamB?.name || "").toLowerCase();

  if (teamAName && statusText.includes(teamAName)) {
    return {
      winnerTeamId: teamAId,
      tied: false,
    };
  }

  if (teamBName && statusText.includes(teamBName)) {
    return {
      winnerTeamId: teamBId,
      tied: false,
    };
  }

  return {
    winnerTeamId: null,
    tied: false,
  };
}

function matchResultText(match, inningsRows, outcome, teamsById) {
  const explicit = String(
    match?.statusText ||
    match?.resultText ||
    ""
  ).trim();

  if (explicit) return explicit;

  if (outcome.tied) return "Match tied";

  if (!outcome.winnerTeamId) {
    return "Completed — result unavailable";
  }

  const winnerName =
    teamsById.get(Number(outcome.winnerTeamId))?.name ||
    "Winner";

  if (inningsRows.length >= 2) {
    const first = inningsRows[0];
    const second = inningsRows[1];
    const gap = Math.abs(
      Number(first.runs || 0) -
      Number(second.runs || 0)
    );

    return `${winnerName} won · ${gap}-run score gap`;
  }

  return `${winnerName} won`;
}

function buildPlayerStats(matches, roster, league) {
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
        key,
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

  for (const match of matches) {
    for (const ball of sortBalls(match?.balls || [])) {
      const striker = ensure(ball?.strikerId, {
        playerName: ball?.striker?.name,
        teamId:
          ball?.striker?.teamId ||
          ball?.striker?.team?.id,
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
        teamId:
          ball?.bowler?.teamId ||
          ball?.bowler?.team?.id,
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

  return [...players.values()].map((row) => ({
    ...row,
    matches: row.matches.size,
    strikeRate:
      row.balls > 0
        ? (row.runs / row.balls) * 100
        : 0,
    economy:
      row.bowlingBalls > 0
        ? row.bowlingRuns / (row.bowlingBalls / 6)
        : 0,
  }));
}

function currentRivalryStreak(meetings, teamsById) {
  if (!meetings.length) return null;

  const newestFirst = [...meetings].sort(
    (a, b) =>
      (matchDate(b.match)?.getTime() || 0) -
      (matchDate(a.match)?.getTime() || 0)
  );

  const first = newestFirst[0];

  if (!first?.outcome?.winnerTeamId || first.outcome.tied) {
    return null;
  }

  const winnerId = Number(first.outcome.winnerTeamId);
  let count = 0;

  for (const meeting of newestFirst) {
    if (
      meeting.outcome.tied ||
      Number(meeting.outcome.winnerTeamId) !== winnerId
    ) {
      break;
    }

    count += 1;
  }

  return {
    teamId: winnerId,
    teamName:
      teamsById.get(winnerId)?.name ||
      "Team",
    wins: count,
  };
}

export function buildTeamRivalries({
  matches = [],
  league,
}) {
  const teams = league?.teams || [];
  const teamsById = new Map(
    teams.map((team) => [
      Number(team.id),
      team,
    ])
  );

  const roster = buildRoster(league);

  const completed = matches
    .filter((match) =>
      COMPLETED_STATUSES.has(
        normalizeStatus(match?.status)
      )
    )
    .sort(
      (a, b) =>
        (matchDate(a)?.getTime() || 0) -
        (matchDate(b)?.getTime() || 0)
    );

  const grouped = new Map();

  for (const match of completed) {
    const teamAId = teamIdFrom(match, "a");
    const teamBId = teamIdFrom(match, "b");

    if (!teamAId || !teamBId || teamAId === teamBId) {
      continue;
    }

    const key = pairKey(teamAId, teamBId);
    const innings = buildInnings(match, roster);
    const outcome = inferOutcome(match, innings);

    if (!grouped.has(key)) {
      const sortedIds = [teamAId, teamBId].sort((a, b) => a - b);

      grouped.set(key, {
        key,
        teamAId: sortedIds[0],
        teamBId: sortedIds[1],
        meetings: [],
      });
    }

    grouped.get(key).meetings.push({
      match,
      innings,
      outcome,
    });
  }

  const rivalries = [];

  for (const rivalry of grouped.values()) {
    const teamA =
      teamsById.get(Number(rivalry.teamAId)) || {
        id: rivalry.teamAId,
        name: `Team ${rivalry.teamAId}`,
      };

    const teamB =
      teamsById.get(Number(rivalry.teamBId)) || {
        id: rivalry.teamBId,
        name: `Team ${rivalry.teamBId}`,
      };

    let teamAWins = 0;
    let teamBWins = 0;
    let ties = 0;

    const totals = [];
    const gaps = [];

    for (const meeting of rivalry.meetings) {
      if (meeting.outcome.tied) {
        ties += 1;
      } else if (
        Number(meeting.outcome.winnerTeamId) ===
        Number(teamA.id)
      ) {
        teamAWins += 1;
      } else if (
        Number(meeting.outcome.winnerTeamId) ===
        Number(teamB.id)
      ) {
        teamBWins += 1;
      }

      for (const innings of meeting.innings) {
        if (
          Number(innings.teamId) === Number(teamA.id) ||
          Number(innings.teamId) === Number(teamB.id)
        ) {
          totals.push({
            teamId: Number(innings.teamId),
            teamName:
              teamsById.get(Number(innings.teamId))?.name ||
              "Team",
            runs: Number(innings.runs || 0),
            wickets: Number(innings.wickets || 0),
            legalBalls: Number(innings.legalBalls || 0),
            match: meeting.match,
          });
        }
      }

      if (meeting.innings.length >= 2) {
        const gap = Math.abs(
          Number(meeting.innings[0]?.runs || 0) -
          Number(meeting.innings[1]?.runs || 0)
        );

        gaps.push({
          gap,
          match: meeting.match,
          outcome: meeting.outcome,
          innings: meeting.innings,
        });
      }
    }

    totals.sort(
      (a, b) =>
        b.runs - a.runs ||
        a.wickets - b.wickets
    );

    const positiveGaps = gaps.filter(
      (row) => row.gap > 0
    );

    const closest =
      [...positiveGaps].sort(
        (a, b) => a.gap - b.gap
      )[0] || null;

    const biggest =
      [...positiveGaps].sort(
        (a, b) => b.gap - a.gap
      )[0] || null;

    const playerRows = buildPlayerStats(
      rivalry.meetings.map((row) => row.match),
      roster,
      league
    ).filter(
      (player) =>
        Number(player.teamId) === Number(teamA.id) ||
        Number(player.teamId) === Number(teamB.id)
    );

    const topBatter =
      [...playerRows]
        .filter((player) => player.runs > 0)
        .sort(
          (a, b) =>
            b.runs - a.runs ||
            b.strikeRate - a.strikeRate
        )[0] || null;

    const topBowler =
      [...playerRows]
        .filter((player) => player.wickets > 0)
        .sort(
          (a, b) =>
            b.wickets - a.wickets ||
            a.economy - b.economy
        )[0] || null;

    const recent = [...rivalry.meetings]
      .sort(
        (a, b) =>
          (matchDate(b.match)?.getTime() || 0) -
          (matchDate(a.match)?.getTime() || 0)
      )
      .slice(0, 5)
      .map((meeting) => ({
        matchId: Number(meeting.match.id),
        dateLabel: formatDate(meeting.match),
        label: `${meeting.match?.teamA?.name || "Team A"} vs ${meeting.match?.teamB?.name || "Team B"}`,
        result: matchResultText(
          meeting.match,
          meeting.innings,
          meeting.outcome,
          teamsById
        ),
        winnerTeamId:
          Number(meeting.outcome.winnerTeamId) ||
          null,
        tied: meeting.outcome.tied,
        href:
          league?.slug
            ? `/leagues/${league.slug}/matches/${meeting.match.id}`
            : "",
      }));

    rivalry.meetings.sort(
      (a, b) =>
        (matchDate(a.match)?.getTime() || 0) -
        (matchDate(b.match)?.getTime() || 0)
    );

    rivalries.push({
      key: rivalry.key,
      teamA: {
        teamId: Number(teamA.id),
        teamName: teamA.name,
        wins: teamAWins,
      },
      teamB: {
        teamId: Number(teamB.id),
        teamName: teamB.name,
        wins: teamBWins,
      },
      ties,
      meetings: rivalry.meetings.length,
      currentStreak: currentRivalryStreak(
        rivalry.meetings,
        teamsById
      ),
      highestTotal: totals[0] || null,
      closestFinish: closest
        ? {
            scoreGap: closest.gap,
            dateLabel: formatDate(closest.match),
            label: `${closest.match?.teamA?.name || "Team A"} vs ${closest.match?.teamB?.name || "Team B"}`,
          }
        : null,
      biggestWin: biggest
        ? {
            scoreGap: biggest.gap,
            dateLabel: formatDate(biggest.match),
            winnerTeamName:
              teamsById.get(
                Number(biggest.outcome.winnerTeamId)
              )?.name || "Winner",
          }
        : null,
      topBatter,
      topBowler,
      recent,
    });
  }

  rivalries.sort(
    (a, b) =>
      b.meetings - a.meetings ||
      Math.max(b.teamA.wins, b.teamB.wins) -
        Math.max(a.teamA.wins, a.teamB.wins) ||
      a.teamA.teamName.localeCompare(
        b.teamA.teamName
      )
  );

  return {
    rivalries,
    rivalryCount: rivalries.length,
    completedMatches: completed.length,
  };
}
