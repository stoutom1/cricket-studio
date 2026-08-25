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
    safeDate(match?.createdAt)
  );
}

function scheduledDate(match) {
  return (
    safeDate(match?.scheduledAt) ||
    safeDate(match?.startedAt) ||
    safeDate(match?.createdAt)
  );
}

function sortBalls(balls = []) {
  return [...balls].sort(
    (a, b) =>
      Number(a.inningsNo || 0) - Number(b.inningsNo || 0) ||
      Number(a.sequence || 0) - Number(b.sequence || 0) ||
      Number(a.id || 0) - Number(b.id || 0)
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

function bowlerWicket(ball) {
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

function fieldingContribution(ball, playerId) {
  const numericId = Number(playerId);
  if (!numericId) return 0;

  const wicketType = String(ball?.wicketType || "")
    .trim()
    .toUpperCase();

  if (
    Number(ball?.fielderId) === numericId &&
    ["CAUGHT", "RUN_OUT", "STUMPED"].includes(wicketType)
  ) {
    return 1;
  }

  if (
    wicketType === "RUN_OUT" &&
    Number(ball?.assistantFielderId) === numericId
  ) {
    return 1;
  }

  return 0;
}

function formatShortDate(date) {
  if (!date) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatFixtureDate(date) {
  if (!date) return "Date not set";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function matchLabel(match) {
  return `${match?.teamA?.name || "Team A"} vs ${match?.teamB?.name || "Team B"}`;
}

function makePlayerRow(player) {
  return {
    ...player,
    runs: 0,
    balls: 0,
    wickets: 0,
    bowlingBalls: 0,
    bowlingRuns: 0,
    fielding: 0,
    matches: new Set(),
  };
}

function ensurePlayer({
  map,
  roster,
  league,
  playerId,
  fallback,
}) {
  const player = getPlayer(
    roster,
    playerId,
    fallback
  );

  if (
    !player.playerId ||
    shouldExcludePlayerFromLeagueAnalytics(
      league,
      player.playerName
    )
  ) {
    return null;
  }

  const key = playerKey(
    player.playerId,
    player.playerName
  );

  if (!map.has(key)) {
    map.set(
      key,
      makePlayerRow(player)
    );
  }

  return map.get(key);
}

function resultText(match) {
  const explicit = String(
    match?.statusText ||
    match?.resultText ||
    ""
  ).trim();

  if (explicit) return explicit;

  return normalizeStatus(match?.status)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function buildWeeklyLeagueDigest({
  matches = [],
  league,
  pointsTable = [],
  leagueMilestones,
  leagueRecords,
  now = new Date(),
}) {
  const referenceDate =
    now instanceof Date
      ? now
      : new Date(now);

  const safeNow = Number.isNaN(referenceDate.getTime())
    ? new Date()
    : referenceDate;

  const windowEnd = safeNow.getTime();
  const windowStart =
    windowEnd - 7 * 24 * 60 * 60 * 1000;

  const completedMatches = matches
    .filter((match) =>
      COMPLETED_STATUSES.has(
        normalizeStatus(match?.status)
      )
    )
    .filter((match) => {
      const date = matchDate(match);
      if (!date) return false;

      const time = date.getTime();

      return (
        time >= windowStart &&
        time <= windowEnd
      );
    })
    .sort(
      (a, b) =>
        (matchDate(b)?.getTime() || 0) -
        (matchDate(a)?.getTime() || 0)
    );

  const upcomingMatch = matches
    .filter((match) =>
      ["SCHEDULED", "UPCOMING"].includes(
        normalizeStatus(match?.status)
      )
    )
    .map((match) => ({
      match,
      date: scheduledDate(match),
    }))
    .filter(
      ({ date }) =>
        date &&
        date.getTime() >= windowEnd
    )
    .sort(
      (a, b) =>
        a.date.getTime() -
        b.date.getTime()
    )[0] || null;

  const roster = buildRoster(league);
  const playerRows = new Map();

  for (const match of completedMatches) {
    for (const ball of sortBalls(match?.balls || [])) {
      const striker = ensurePlayer({
        map: playerRows,
        roster,
        league,
        playerId: ball?.strikerId,
        fallback: {
          playerName: ball?.striker?.name,
          teamId:
            ball?.striker?.teamId ||
            ball?.striker?.team?.id,
          teamName:
            ball?.striker?.team?.name,
        },
      });

      if (striker) {
        striker.runs += Number(
          ball?.runsOffBat ||
          0
        );

        if (
          String(ball?.extraType || "").toUpperCase() !== "WIDE" &&
          String(ball?.extraType || "").toUpperCase() !== "NOBALL" &&
          String(ball?.wicketType || "").toUpperCase() !== "RETIRED_HURT"
        ) {
          striker.balls += 1;
        }

        striker.matches.add(Number(match.id));
      }

      const bowler = ensurePlayer({
        map: playerRows,
        roster,
        league,
        playerId: ball?.bowlerId,
        fallback: {
          playerName: ball?.bowler?.name,
          teamId:
            ball?.bowler?.teamId ||
            ball?.bowler?.team?.id,
          teamName:
            ball?.bowler?.team?.name,
        },
      });

      if (bowler) {
        const extraType = String(
          ball?.extraType ||
          ""
        )
          .trim()
          .toUpperCase();

        if (!["BYE", "LEGBYE"].includes(extraType)) {
          bowler.bowlingRuns += Number(
            ball?.totalRuns ||
            0
          );
        }

        if (ball?.legalDelivery) {
          bowler.bowlingBalls += 1;
        }

        if (bowlerWicket(ball)) {
          bowler.wickets += 1;
        }

        bowler.matches.add(Number(match.id));
      }

      for (const candidateId of [
        ball?.fielderId,
        ball?.assistantFielderId,
      ]) {
        const fielder = ensurePlayer({
          map: playerRows,
          roster,
          league,
          playerId: candidateId,
        });

        if (fielder) {
          fielder.fielding += fieldingContribution(
            ball,
            candidateId
          );

          if (
            fieldingContribution(
              ball,
              candidateId
            ) > 0
          ) {
            fielder.matches.add(Number(match.id));
          }
        }
      }
    }
  }

  const players = [...playerRows.values()].map(
    (player) => {
      const matchesPlayed =
        player.matches.size;

      const strikeRate =
        player.balls > 0
          ? (player.runs / player.balls) * 100
          : 0;

      const economy =
        player.bowlingBalls > 0
          ? player.bowlingRuns /
            (player.bowlingBalls / 6)
          : 0;

      const impact =
        player.runs +
        player.wickets * 25 +
        player.fielding * 10;

      return {
        ...player,
        matches: matchesPlayed,
        strikeRate,
        economy,
        impact,
      };
    }
  );

  const topBatter =
    [...players]
      .filter((player) => player.runs > 0)
      .sort(
        (a, b) =>
          b.runs - a.runs ||
          b.strikeRate - a.strikeRate
      )[0] || null;

  const topBowler =
    [...players]
      .filter((player) => player.wickets > 0)
      .sort(
        (a, b) =>
          b.wickets - a.wickets ||
          a.economy - b.economy
      )[0] || null;

  const performanceOfWeek =
    [...players]
      .filter((player) => player.impact > 0)
      .sort(
        (a, b) =>
          b.impact - a.impact ||
          b.runs - a.runs ||
          b.wickets - a.wickets
      )[0] || null;

  const milestoneThisWeek =
    [...(leagueMilestones?.achievements || [])]
      .filter((item) =>
        Number(item?.sortTime || 0) >= windowStart &&
        Number(item?.sortTime || 0) <= windowEnd
      )
      .sort(
        (a, b) =>
          Number(b?.sortTime || 0) -
          Number(a?.sortTime || 0)
      )[0] || null;

  const recordSpotlight =
    leagueRecords?.records?.[0] ||
    null;

  const tableLeader =
    pointsTable?.[0] ||
    null;

  const rangeLabel =
    `${formatShortDate(new Date(windowStart))} – ${formatShortDate(safeNow)}`;

  const matchResults = completedMatches
    .slice(0, 4)
    .map((match) => ({
      matchId: Number(match.id),
      label: matchLabel(match),
      result: resultText(match),
      dateLabel: formatShortDate(matchDate(match)),
      href:
        league?.slug
          ? `/leagues/${league.slug}/matches/${match.id}`
          : "",
    }));

  const upcoming = upcomingMatch
    ? {
        matchId: Number(upcomingMatch.match.id),
        label: matchLabel(upcomingMatch.match),
        dateLabel: formatFixtureDate(upcomingMatch.date),
        venue:
          upcomingMatch.match?.venueName ||
          upcomingMatch.match?.venueAddress ||
          "Venue not set",
        href:
          league?.slug
            ? `/leagues/${league.slug}/matches/${upcomingMatch.match.id}`
            : "",
      }
    : null;

  const digestLines = [
    `🏏 ${league?.name || "Cric4All"} — 7-Day Digest`,
    `📅 ${rangeLabel}`,
    completedMatches.length
      ? `✅ ${completedMatches.length} completed match${completedMatches.length === 1 ? "" : "es"}`
      : "✅ No completed matches in the last 7 days",
    tableLeader?.teamName
      ? `🥇 Table leader: ${tableLeader.teamName}`
      : "",
    topBatter
      ? `🏏 Top batter: ${topBatter.playerName} — ${topBatter.runs} runs`
      : "",
    topBowler
      ? `🎯 Top bowler: ${topBowler.playerName} — ${topBowler.wickets} wickets`
      : "",
    performanceOfWeek
      ? `🌟 Performance: ${performanceOfWeek.playerName} — ${performanceOfWeek.impact} impact pts`
      : "",
    milestoneThisWeek
      ? `🏅 Milestone: ${milestoneThisWeek.playerName} — ${milestoneThisWeek.title}`
      : "",
    upcoming
      ? `📍 Next: ${upcoming.label} — ${upcoming.dateLabel}`
      : "",
    "Cric4All · cric4all.app",
  ].filter(Boolean);

  return {
    rangeLabel,
    completedMatches,
    matchResults,
    completedCount: completedMatches.length,
    tableLeader,
    topBatter,
    topBowler,
    performanceOfWeek,
    milestoneThisWeek,
    recordSpotlight,
    upcoming,
    text: digestLines.join("\n"),
  };
}

export async function shareWeeklyLeagueDigest(digest, leagueName) {
  if (typeof navigator === "undefined") {
    return {
      mode: "unavailable",
    };
  }

  if (navigator.share) {
    await navigator.share({
      title: `${leagueName || "Cric4All"} Weekly Digest`,
      text: digest.text,
    });

    return {
      mode: "shared",
    };
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(
      digest.text
    );

    return {
      mode: "copied",
    };
  }

  return {
    mode: "unavailable",
  };
}

export async function copyWeeklyLeagueDigest(digest) {
  if (
    typeof navigator === "undefined" ||
    !navigator.clipboard?.writeText
  ) {
    throw new Error(
      "Clipboard access is unavailable in this browser."
    );
  }

  await navigator.clipboard.writeText(
    digest.text
  );

  return true;
}
