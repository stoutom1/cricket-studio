"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "@/app/public-league-wow.css";
import "@/app/featured-match-spotlight.css";
import {
  combineSurpriseBattingRows,
  combineSurpriseBowlingRows,
} from "@/lib/surprise-player-stats";

function normalizeStatus(status) {
  return String(status || "SCHEDULED")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

const LIVE_MATCH_STATUSES = new Set([
  "LIVE",
  "IN_PROGRESS",
  "INPROGRESS",
  "STARTED",
]);

const COMPLETED_MATCH_STATUSES = new Set([
  "COMPLETED",
  "COMPLETED_LOCKED",
  "COMPLETED_CORRECTED",
  "ABANDONED",
  "CANCELLED",
  "NO_RESULT",
]);

function isLiveMatch(match) {
  return LIVE_MATCH_STATUSES.has(
    normalizeStatus(match?.status)
  );
}

function isScheduledMatch(match) {
  return (
    normalizeStatus(match?.status) === "SCHEDULED"
  );
}

function isCompletedMatch(match) {
  return COMPLETED_MATCH_STATUSES.has(
    normalizeStatus(match?.status)
  );
}

function formatMatchTitle(match) {
  return `${match.teamA?.name || match.teamAName || "Team A"} vs ${
    match.teamB?.name || match.teamBName || "Team B"
  }`;
}

function buildPointsTable(matches = [], teams = []) {
  const table = new Map();

  for (const team of teams || []) {
    table.set(Number(team.id), {
      teamId: Number(team.id),
      teamName: team.name,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      noResult: 0,
      points: 0,
    });
  }

  for (const match of matches || []) {
    const status = normalizeStatus(match.status);

    const isCompleted = [
      "COMPLETED",
      "COMPLETED_LOCKED",
      "COMPLETED_CORRECTED",
    ].includes(status);

    const isNoResultStatus = [
      "ABANDONED",
      "CANCELLED",
      "NO_RESULT",
    ].includes(status);

    if (!isCompleted && !isNoResultStatus) {
      continue;
    }

    const teamAId = Number(match.teamAId);
    const teamBId = Number(match.teamBId);

    const teamA = table.get(teamAId);
    const teamB = table.get(teamBId);

    if (!teamA || !teamB) {
      continue;
    }

    teamA.played += 1;
    teamB.played += 1;

    /*
     * Abandoned, cancelled, or explicitly no-result matches.
     */
    if (isNoResultStatus) {
      teamA.noResult += 1;
      teamB.noResult += 1;

      /*
       * Change this to 0 if your league does not award
       * points for an abandoned/no-result match.
       */
      teamA.points += 1;
      teamB.points += 1;
      continue;
    }

    const outcome = resolvePointsTableOutcome(match);

    if (outcome.type === "TIE") {
      teamA.tied += 1;
      teamB.tied += 1;
      teamA.points += 1;
      teamB.points += 1;
      continue;
    }

    if (outcome.type === "WIN") {
      const winner = table.get(Number(outcome.winnerTeamId));

      const loserTeamId =
        Number(outcome.winnerTeamId) === teamAId
          ? teamBId
          : teamAId;

      const loser = table.get(loserTeamId);

      if (winner && loser) {
        winner.won += 1;
        winner.points += 2;
        loser.lost += 1;
        continue;
      }
    }

    /*
     * A completed match whose result still cannot be resolved
     * is tracked as no-result instead of silently leaving
     * W/L/T totals inconsistent.
     */
    teamA.noResult += 1;
    teamB.noResult += 1;
  }

  return [...table.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.won - a.won ||
      a.lost - b.lost ||
      a.teamName.localeCompare(b.teamName)
  );
}

function resolvePointsTableOutcome(match) {
  const teamAId = Number(match.teamAId);
  const teamBId = Number(match.teamBId);

  const teamAName = String(
    match.teamA?.name ||
    match.teamAName ||
    ""
  )
    .trim()
    .toLowerCase();

  const teamBName = String(
    match.teamB?.name ||
    match.teamBName ||
    ""
  )
    .trim()
    .toLowerCase();

  /*
   * First preference: explicit winner ID stored by the app.
   * This supports several likely field names safely.
   */
  const explicitWinnerId = Number(
    match.winnerTeamId ||
    match.winningTeamId ||
    match.winnerId ||
    match.winner?.id ||
    0
  );

  if (
    explicitWinnerId === teamAId ||
    explicitWinnerId === teamBId
  ) {
    return {
      type: "WIN",
      winnerTeamId: explicitWinnerId,
      source: "winner-id",
    };
  }

  const statusText = String(
    match.statusText ||
    match.resultText ||
    match.result ||
    ""
  )
    .trim()
    .toLowerCase();

  if (
    statusText.includes("tied") ||
    statusText.includes("match tie") ||
    statusText === "tie"
  ) {
    return {
      type: "TIE",
      source: "status-text",
    };
  }

  /*
   * Check the longer team name first. This prevents a partial
   * name from incorrectly matching another team.
   */
  const teamsByLongestName = [
    {
      teamId: teamAId,
      teamName: teamAName,
    },
    {
      teamId: teamBId,
      teamName: teamBName,
    },
  ].sort(
    (a, b) =>
      b.teamName.length - a.teamName.length
  );

  for (const team of teamsByLongestName) {
    if (
      team.teamName &&
      statusText.includes(team.teamName)
    ) {
      return {
        type: "WIN",
        winnerTeamId: team.teamId,
        source: "status-text",
      };
    }
  }

  /*
   * Final fallback: calculate the result from the two
   * regulation innings.
   */
  const scoreResult =
    resolveWinnerFromInningsScores(match);

  if (scoreResult) {
    return scoreResult;
  }

  return {
    type: "UNRESOLVED",
  };
}

function resolveWinnerFromInningsScores(match) {
  const teamAId = Number(match.teamAId);
  const teamBId = Number(match.teamBId);

  const battingFirstTeamId = Number(
    match.battingFirstTeamId ||
    match.battingFirstTeam?.id ||
    0
  );

  if (
    battingFirstTeamId !== teamAId &&
    battingFirstTeamId !== teamBId
  ) {
    return null;
  }

  const inningsTotals = new Map();

  for (const ball of match.balls || []) {
    const inningsNo = Number(
      ball.inningsNo || 1
    );

    /*
     * Use regulation innings only.
     * Super-over outcomes should preferably be resolved through
     * winnerTeamId or statusText.
     */
    if (![1, 2].includes(inningsNo)) {
      continue;
    }

    inningsTotals.set(
      inningsNo,
      Number(inningsTotals.get(inningsNo) || 0) +
        Number(ball.totalRuns || 0)
    );
  }

  /*
   * Do not infer a result unless both innings exist.
   */
  if (
    !inningsTotals.has(1) ||
    !inningsTotals.has(2)
  ) {
    return null;
  }

  const inningsOneRuns = Number(
    inningsTotals.get(1) || 0
  );

  const inningsTwoRuns = Number(
    inningsTotals.get(2) || 0
  );

  if (inningsOneRuns === inningsTwoRuns) {
    return {
      type: "TIE",
      source: "innings-score",
    };
  }

  const battingSecondTeamId =
    battingFirstTeamId === teamAId
      ? teamBId
      : teamAId;

  return {
    type: "WIN",
    winnerTeamId:
      inningsOneRuns > inningsTwoRuns
        ? battingFirstTeamId
        : battingSecondTeamId,
    source: "innings-score",
  };
}

function normalizePlayerName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isSurpriseLeague(league) {
  const name = String(league?.name || "")
    .trim()
    .toLowerCase();

  const slug = String(league?.slug || "")
    .trim()
    .toLowerCase();

  return (
    name === "surprise cricket league" ||
    slug === "surprise-cricket-league"
  );
}

function calculateFastestFifties(
  matches = [],
  league = null
) {
  const performances = [];

  for (const match of matches || []) {
    const inningsNumbers = [
      ...new Set(
        (match.balls || []).map((ball) =>
          Number(ball.inningsNo || 1)
        )
      ),
    ];

    for (const inningsNo of inningsNumbers) {
      const inningsBalls = (match.balls || [])
        .filter(
          (ball) =>
            Number(ball.inningsNo || 1) ===
            Number(inningsNo)
        )
        .sort(
          (a, b) =>
            Number(a.sequence || 0) -
              Number(b.sequence || 0) ||
            Number(a.id || 0) -
              Number(b.id || 0)
        );

      const batterProgress = new Map();

      for (const ball of inningsBalls) {
        const strikerId = Number(
          ball.strikerId ||
          ball.striker?.id ||
          0
        );

        if (!strikerId) continue;

        /*
         * Use the striker relation carried by each ball.
         * This is the same reliable data source already used
         * by buildPublicStats().
         */
        const strikerName =
          ball.striker?.name ||
          `Player ${strikerId}`;

        const strikerTeamName =
          ball.striker?.team?.name ||
          (
            Number(ball.striker?.teamId) ===
            Number(match.teamAId)
              ? match.teamA?.name
              : Number(ball.striker?.teamId) ===
                  Number(match.teamBId)
                ? match.teamB?.name
                : ""
          );

        const strikerTeamId = Number(
          ball.striker?.teamId || 0
        );

        if (!batterProgress.has(strikerId)) {
          batterProgress.set(strikerId, {
            playerId: strikerId,
            playerName: strikerName,
            teamId: strikerTeamId,
            teamName: strikerTeamName,

            inningsNo,
            runs: 0,
            balls: 0,
            fiftyRecorded: false,
          });
        }

        const progress =
          batterProgress.get(strikerId);

        /*
         * Only runs credited to the batter count toward 50.
         */
        progress.runs += Number(
          ball.runsOffBat || 0
        );

        const extraType = String(
          ball.extraType || "NONE"
        ).toUpperCase();

        const wicketType = String(
          ball.wicketType || "NONE"
        ).toUpperCase();

        /*
         * Cricket batting convention:
         * - Wide: not a ball faced
         * - No-ball: counts as a ball faced
         * - Retired-hurt event: not a ball faced
         */
        const countsAsBallFaced =
          extraType !== "WIDE" &&
          wicketType !== "RETIRED_HURT";

        if (countsAsBallFaced) {
          progress.balls += 1;
        }

        /*
         * Capture the first delivery on which the batter
         * reaches or passes 50.
         */
        if (
          !progress.fiftyRecorded &&
          progress.runs >= 50
        ) {
          progress.fiftyRecorded = true;

          performances.push({
            playerId: progress.playerId,
            playerName: progress.playerName,
            teamId: progress.teamId,
            teamName: progress.teamName,

            matchId: match.id,
            matchTitle:
              `${match.teamA?.name || "Team A"} vs ` +
              `${match.teamB?.name || "Team B"}`,

            shareCode: match.shareCode || null,
            inningsNo,

            ballsToFifty: progress.balls,
            runsAtFifty: progress.runs,

            reachedAt:
              `${Number(ball.overNo || 0)}.` +
              `${Number(ball.ballInOver || 0)}`,
          });
        }
      }
    }
  }

  /*
   * Normal leagues retain separate player IDs.
   */
  if (!isSurpriseLeague(league)) {
    return performances.sort(
      (a, b) =>
        Number(a.ballsToFifty || 0) -
          Number(b.ballsToFifty || 0) ||
        Number(a.runsAtFifty || 0) -
          Number(b.runsAtFifty || 0)
    );
  }

  /*
   * Surprise Cricket League:
   * combine Surprise 1 and Surprise 2 by normalized name,
   * retaining each player's quickest fifty.
   */
  const combined = new Map();

  for (const performance of performances) {
    const key = normalizePlayerName(
      performance.playerName
    );

    if (!key) continue;

    const current = combined.get(key);

    const isFaster =
      !current ||
      Number(performance.ballsToFifty) <
        Number(current.ballsToFifty) ||
      (
        Number(performance.ballsToFifty) ===
          Number(current.ballsToFifty) &&
        Number(performance.runsAtFifty) <
          Number(current.runsAtFifty)
      );

    if (isFaster) {
      combined.set(key, {
        ...performance,
        playerKey: key,
        teamName: "Surprise 1 + Surprise 2",
        isCombinedPlayer: true,
      });
    }
  }

  return [...combined.values()].sort(
    (a, b) =>
      Number(a.ballsToFifty || 0) -
        Number(b.ballsToFifty || 0) ||
      Number(a.runsAtFifty || 0) -
        Number(b.runsAtFifty || 0)
  );
}

function buildPublicStats(matches, league) {
  const batting = new Map();
  const bowling = new Map();

  for (const match of matches || []) {
    for (const ball of match.balls || []) {
      const strikerId = Number(ball.strikerId);
      const bowlerId = Number(ball.bowlerId);

      if (strikerId) {
        if (!batting.has(strikerId)) {
          batting.set(strikerId, {
            playerId: strikerId,
            playerName: ball.striker?.name || `Player ${strikerId}`,
            teamName: ball.striker?.team?.name || "",
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            matches: new Set(),
          });
        }

        const row = batting.get(strikerId);
        row.matches.add(match.id);
        row.runs += Number(ball.runsOffBat || 0);

        if (
          ball.extraType !== "WIDE" &&
          ball.extraType !== "NOBALL" &&
          ball.wicketType !== "RETIRED_HURT"
        ) {
          row.balls += 1;
        }

        if (Number(ball.runsOffBat || 0) === 4) row.fours += 1;
        if (Number(ball.runsOffBat || 0) === 6) row.sixes += 1;
      }

      if (bowlerId) {
        if (!bowling.has(bowlerId)) {
          bowling.set(bowlerId, {
            playerId: bowlerId,
            playerName: ball.bowler?.name || `Player ${bowlerId}`,
            teamName: ball.bowler?.team?.name || "",
            balls: 0,
            runs: 0,
            wickets: 0,
            dots: 0,
            matches: new Set(),
          });
        }

        const row = bowling.get(bowlerId);
        row.matches.add(match.id);

        const chargedRuns =
          ball.extraType === "BYE" || ball.extraType === "LEGBYE"
            ? 0
            : Number(ball.totalRuns || 0);

        row.runs += chargedRuns;

        if (
          ball.legalDelivery &&
          ball.extraType !== "WIDE" &&
          ball.extraType !== "NOBALL" &&
          ball.wicketType !== "RETIRED_HURT"
        ) {
          row.balls += 1;
          if (Number(ball.totalRuns || 0) === 0) row.dots += 1;
        }

        if (
          ball.isWicket &&
          !["RUN_OUT", "RETIRED_OUT", "RETIRED_HURT"].includes(ball.wicketType) &&
          ball.extraType !== "NOBALL"
        ) {
          row.wickets += 1;
        }
      }
    }
  }

  const rawBattingRows = [...batting.values()]
    .map((row) => ({
      ...row,
      matches: row.matches.size,
      strikeRate: row.balls ? ((row.runs / row.balls) * 100).toFixed(2) : "0.00",
    }))
    .sort((a, b) => b.runs - a.runs);

  const rawBowlingRows = [...bowling.values()]
    .map((row) => ({
      ...row,
      matches: row.matches.size,
      overs: `${Math.floor(row.balls / 6)}.${row.balls % 6}`,
      economy: row.balls ? ((row.runs / row.balls) * 6).toFixed(2) : "0.00",
    }))
    .sort((a, b) => b.wickets - a.wickets || Number(a.economy) - Number(b.economy));

  const battingRows = combineSurpriseBattingRows(
  rawBattingRows,
  league
).sort(
  (a, b) =>
    Number(b.runs || 0) -
      Number(a.runs || 0) ||
    Number(b.strikeRate || 0) -
      Number(a.strikeRate || 0)
);

const bowlingRows = combineSurpriseBowlingRows(
  rawBowlingRows,
  league
).sort(
  (a, b) =>
    Number(b.wickets || 0) -
      Number(a.wickets || 0) ||
    Number(a.economy || 0) -
      Number(b.economy || 0)
);
  
  return { battingRows, bowlingRows };
}

export default function PublicLeagueViewClient({ league }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [matchStatusFilter, setMatchStatusFilter] = useState("all");
  const [publicSearch, setPublicSearch] = useState("");
  const [publicStatsTab, setPublicStatsTab] = useState("batting");
  const [publicLeadersTab, setPublicLeadersTab] = useState("fastest-fifty");
  const [isFollowing, setIsFollowing] = useState(Boolean(league.isFollowing));
  const [followBusy, setFollowBusy] = useState(false);
async function toggleFollowLeague() {
  try {
    setFollowBusy(true);

    const res = await fetch(`/api/leagues/${league.id}/follow`, {
      method: isFollowing ? "DELETE" : "POST",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Unable to follow league.");
    }

    setIsFollowing(Boolean(data.followed));
  } catch (err) {
    alert(err.message);
  } finally {
    setFollowBusy(false);
  }
}

  const years = useMemo(
    () =>
      [...new Set((league.series || []).map((s) => Number(s.year)).filter(Boolean))].sort(
        (a, b) => b - a
      ),
    [league.series]
  );

  function openTab(tabName) {
    setActiveTab(tabName);
    if (tabName === "leaders") {
    setPublicLeadersTab("fastest-fifty");
  }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openTabAndClear(tabName) {
    setActiveTab(tabName);
    setPublicSearch("");
      if (tabName === "leaders") {
    setPublicLeadersTab("fastest-fifty");
  }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function copyLeagueLink() {
    navigator.clipboard.writeText(window.location.href);
    alert("League link copied.");
  }

  const filteredMatches = useMemo(() => {
    return (league.matches || []).filter((match) => {
      if (selectedSeriesId && Number(match.seriesId) !== Number(selectedSeriesId)) {
        return false;
      }

      if (selectedYear && Number(match.series?.year) !== Number(selectedYear)) {
        return false;
      }

      return true;
    });
  }, [league.matches, selectedSeriesId, selectedYear]);

  const searchResults = useMemo(() => {
    const q = publicSearch.trim().toLowerCase();

    if (!q) return { teams: [], players: [], matches: [] };

    const teams = (league.teams || []).filter((team) =>
      String(team.name || "").toLowerCase().includes(q)
    );

    const players = (league.teams || [])
      .flatMap((team) =>
        (team.players || []).map((player) => ({
          ...player,
          teamName: team.name,
        }))
      )
      .filter((player) =>
        [player.name, player.teamName].filter(Boolean).join(" ").toLowerCase().includes(q)
      );

    const matches = filteredMatches.filter((match) =>
      [
        match.teamA?.name,
        match.teamB?.name,
        match.series?.name,
        match.status,
        match.statusText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );

    return {
      teams: teams.slice(0, 6),
      players: players.slice(0, 8),
      matches: matches.slice(0, 6),
    };
  }, [publicSearch, league.teams, filteredMatches]);

  const liveMatches = useMemo(
  () => filteredMatches.filter(isLiveMatch),
  [filteredMatches]
);

const scheduledMatches = useMemo(
  () => filteredMatches.filter(isScheduledMatch),
  [filteredMatches]
);

const completedMatches = useMemo(
  () => filteredMatches.filter(isCompletedMatch),
  [filteredMatches]
);

const overviewMatchFeed = useMemo(() => {
  /*
   * Priority 1:
   * Show every currently active match.
   */
  if (liveMatches.length > 0) {
    const sortedLiveMatches = [...liveMatches].sort(
      (a, b) => {
        const aDate =
          getLiveMatchDate(a)?.getTime() || 0;

        const bDate =
          getLiveMatchDate(b)?.getTime() || 0;

        return aDate - bDate;
      }
    );

    return {
      mode: "live",
      matches: sortedLiveMatches,
      eyebrow: "Live cricket",
      title:
        sortedLiveMatches.length === 1
          ? "Live match"
          : `${sortedLiveMatches.length} matches live now`,
    };
  }

  /*
   * Priority 2:
   * No live matches—show the next three fixtures.
   */
  if (scheduledMatches.length > 0) {
    const sortedScheduledMatches = [
      ...scheduledMatches,
    ]
      .sort((a, b) => {
        const aDate =
          getScheduledMatchDate(a)?.getTime() ||
          Number.MAX_SAFE_INTEGER;

        const bDate =
          getScheduledMatchDate(b)?.getTime() ||
          Number.MAX_SAFE_INTEGER;

        return aDate - bDate;
      })
      .slice(0, 3);

    return {
      mode: "upcoming",
      matches: sortedScheduledMatches,
      eyebrow: "Coming up",
      title:
        sortedScheduledMatches.length === 1
          ? "Next fixture"
          : "Upcoming fixtures",
    };
  }

  /*
   * Priority 3:
   * No active or upcoming matches—show recent results.
   */
  if (completedMatches.length > 0) {
    const recentCompletedMatches = [
      ...completedMatches,
    ]
      .sort((a, b) => {
        const aDate =
          getCompletedMatchDate(a)?.getTime() || 0;

        const bDate =
          getCompletedMatchDate(b)?.getTime() || 0;

        return bDate - aDate;
      })
      .slice(0, 3);

    return {
      mode: "recent",
      matches: recentCompletedMatches,
      eyebrow: "Latest action",
      title:
        recentCompletedMatches.length === 1
          ? "Latest result"
          : "Recent results",
    };
  }

  return {
    mode: "empty",
    matches: [],
    eyebrow: "Match center",
    title: "No matches yet",
  };
}, [
  liveMatches,
  scheduledMatches,
  completedMatches,
]);

  const visibleMatches = useMemo(() => {
    if (matchStatusFilter === "live") return liveMatches;
    if (matchStatusFilter === "scheduled") return scheduledMatches;
    if (matchStatusFilter === "completed") return completedMatches;
    return filteredMatches;
  }, [matchStatusFilter, liveMatches, scheduledMatches, completedMatches, filteredMatches]);

  const pointsTable = useMemo(
    () => buildPointsTable(filteredMatches, league.teams || []),
    [filteredMatches, league.teams]
  );

const {
  battingRows = [],
  bowlingRows = [],
} = useMemo(
  () => buildPublicStats(filteredMatches, league),
  [filteredMatches, league]
);

const fastestFifties = useMemo(
  () =>
    calculateFastestFifties(
      league.matches || [],
      league
    ),
  [league.matches, league]
);

  const topRunScorer = battingRows[0];
  const topWicketTaker = bowlingRows[0];
  const fastestFiftyLeader =
  fastestFifties?.length
    ? fastestFifties[0]
    : null;
  const topSixHitter = [...battingRows].sort((a, b) => b.sixes - a.sixes)[0];
  const bestStrikeRate = [...battingRows]
    .filter((p) => p.balls >= 5)
    .sort((a, b) => Number(b.strikeRate) - Number(a.strikeRate))[0];
  const bestEconomy = [...bowlingRows]
    .filter((p) => p.balls >= 6)
    .sort((a, b) => Number(a.economy) - Number(b.economy))[0];

return (
    <main className="slp-page">
      <section className="slp-shell">
        <header className="slp-hero">
          <div className="slp-topline">
            <nav className="slp-breadcrumb" aria-label="Breadcrumb">
              <a href="/explore">Explore</a>
              <span>/</span>
              <strong>{league.name}</strong>
            </nav>

            <span className="slp-public-label">
              <span aria-hidden="true" />
              Live league
            </span>
          </div>

          <div className="slp-hero-main">
            <div className="slp-league-copy">
              <p className="slp-kicker">Cric4All Competition</p>
              <h2>{league.name}</h2>
              <p>
                Scores, fixtures, standings and player performances—built for
                spectators who want the cricket first.
              </p>

              <div className="slp-league-facts" aria-label="League summary">
                <span><b>{league.teams?.length || 0}</b> Teams</span>
                <span><b>{league.matches?.length || 0}</b> Matches</span>
                <span><b>{league.series?.length || 0}</b> Series</span>
                <span><b>{liveMatches.length}</b> Live</span>
              </div>
            </div>

            <div className="slp-actions">
              <button
                type="button"
                className={`slp-follow ${isFollowing ? "is-following" : ""}`}
                onClick={toggleFollowLeague}
                disabled={followBusy}
              >
                <Icon name={isFollowing ? "check" : "star"} />
                {followBusy
                  ? "Saving..."
                  : isFollowing
                    ? "Following"
                    : "Follow league"}
              </button>

              <button type="button" onClick={copyLeagueLink}>
                <Icon name="link" />
                Copy link
              </button>

              <a href="/explore">
                <Icon name="compass" />
                Explore
              </a>
            </div>
          </div>
        </header>

        <div className="slp-utility-bar">
          <div className="slp-filter-group">
            <label>
              <span>Season</span>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setSelectedSeriesId("");
                }}
              >
                <option value="">All years</option>
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Series</span>
              <select
                value={selectedSeriesId}
                onChange={(e) => setSelectedSeriesId(e.target.value)}
              >
                <option value="">All series</option>
                {(league.series || [])
                  .filter((series) =>
                    selectedYear
                      ? Number(series.year) === Number(selectedYear)
                      : true
                  )
                  .map((series) => (
                    <option key={series.id} value={series.id}>
                      {series.name} · {series.year}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className="slp-search-wrap">
            <div className="slp-search">
              <Icon name="search" />
              <input
                value={publicSearch}
                onChange={(e) => setPublicSearch(e.target.value)}
                placeholder="Search teams, players or matches"
                aria-label="Search this league"
              />
              {publicSearch && (
                <button
                  type="button"
                  onClick={() => setPublicSearch("")}
                  aria-label="Clear search"
                >
                  <Icon name="close" />
                </button>
              )}
            </div>

            {publicSearch && (
              <SearchResults searchResults={searchResults} league={league} />
            )}
          </div>
        </div>

        <nav className="slp-tabs" aria-label="League sections">
          {[
            ["overview", "Overview"],
            ["matches", "Matches"],
            ["points", "Standings"],
            ["stats", "Stats"],
            ["leaders", "Leaders"],
            ["teams", "Teams"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={activeTab === key ? "active" : ""}
              onClick={() => setActiveTab(key)}
              aria-current={activeTab === key ? "page" : undefined}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="slp-content">
          {activeTab === "overview" && (
            <OverviewSection
              overviewMatchFeed={overviewMatchFeed}
              liveMatches={liveMatches}
              scheduledMatches={scheduledMatches}
              completedMatches={completedMatches}
              pointsTable={pointsTable}
              topRunScorer={topRunScorer}
              topWicketTaker={topWicketTaker}
              fastestFiftyLeader={fastestFiftyLeader}
              leagueSlug={league.slug}
              openTab={openTab}
            />
          )}

          {activeTab === "matches" && (
            <section className="slp-section">
              <SectionHeader
                eyebrow="Fixtures and results"
                title="Matches"
                description={`${filteredMatches.length} matches in this view`}
              />

              <SegmentedControl
                value={matchStatusFilter}
                onChange={setMatchStatusFilter}
                items={[
                  ["all", "All", filteredMatches.length],
                  ["live", "Live", liveMatches.length],
                  ["scheduled", "Scheduled", scheduledMatches.length],
                  ["completed", "Completed", completedMatches.length],
                ]}
              />

              {visibleMatches.length === 0 ? (
                <EmptyState
                  title="No matches found"
                  message="Try changing the year, series or match-status filter."
                />
              ) : (
                <div className="slp-match-list">
                  {visibleMatches.map((match) => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      leagueSlug={league.slug}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === "points" && (
            <section className="slp-section">
              <SectionHeader
                eyebrow="Competition"
                title="Standings"
                description="Calculated from completed matches"
              />

              {pointsTable.length === 0 ? (
                <EmptyState
                  title="No standings yet"
                  message="The table will appear after completed matches."
                />
              ) : (
                <PointsTable rows={pointsTable} />
              )}
            </section>
          )}

          {activeTab === "stats" && (
            <section className="slp-section">
              <SectionHeader
                eyebrow="Player performance"
                title="Statistics"
                description="Batting and bowling numbers from selected matches"
              />

              <SegmentedControl
                value={publicStatsTab}
                onChange={setPublicStatsTab}
                items={[
                  ["batting", "Batting", battingRows.length],
                  ["bowling", "Bowling", bowlingRows.length],
                ]}
              />

              {battingRows.length === 0 && bowlingRows.length === 0 ? (
                <EmptyState
                  title="No statistics yet"
                  message="Statistics will appear after balls are scored."
                />
              ) : publicStatsTab === "batting" ? (
                <StatsTable type="batting" rows={battingRows} />
              ) : (
                <StatsTable type="bowling" rows={bowlingRows} />
              )}
            </section>
          )}

{activeTab === "leaders" && (
  <section className="slp-section">
    <SectionHeader
      eyebrow="Top performers"
      title="League leaders"
      description="The competition's standout players"
    />

    <SegmentedControl
      value={publicLeadersTab}
      onChange={setPublicLeadersTab}
      items={[
        [
          "fastest-fifty",
          "⚡ Fastest Fifty",
          fastestFifties.length,
        ],
        ["batting", "Batting", null],
        ["bowling", "Bowling", null],
      ]}
    />

    {publicLeadersTab === "fastest-fifty" ? (
      <div className="slp-fastest-fifty-section">
        <div className="slp-block-heading">
          <div>
            <p>Batting milestone</p>
            <h2>⚡ Fastest Fifty</h2>
          </div>

          <span>
            Fewest balls required to reach 50 runs
          </span>
        </div>

        {fastestFifties.length > 0 ? (
          <div className="slp-fastest-fifty-list">
            {fastestFifties
              .slice(0, 10)
              .map((row, index) => (
                <article
                  key={
                    row.playerKey ||
                    `${row.playerId}-${row.matchId}-${row.inningsNo}`
                  }
                  className="slp-fastest-fifty-row"
                >
                  <span className="slp-fastest-fifty-rank">
                    {index + 1}
                  </span>

                  <div className="slp-fastest-fifty-player">
                    <strong>
                      {row.playerName}
                    </strong>

                    <small>
                      {row.teamName ||
                        "League player"}
                    </small>

                    <em>
                      {row.matchTitle}
                      {" • "}
                      Innings {row.inningsNo}
                    </em>
                  </div>

                  <div className="slp-fastest-fifty-value">
                    <strong>
                      {row.ballsToFifty}
                    </strong>

                    <span>balls</span>
                  </div>

                  <div className="slp-fastest-fifty-detail">
                    <strong>
                      {row.runsAtFifty}
                    </strong>

                    <span>
                      runs at milestone
                    </span>
                  </div>

                  {row.shareCode ? (
                    <a
                      href={`/live/${row.shareCode}`}
                      className="slp-fastest-fifty-link"
                    >
                      Scorecard →
                    </a>
                  ) : (
                    <span className="slp-fastest-fifty-link is-disabled">
                      No scorecard
                    </span>
                  )}
                </article>
              ))}
          </div>
        ) : (
          <EmptyState
            title="No fifties recorded yet"
            message="The fastest fifty leaderboard will appear when a batter reaches 50 runs."
          />
        )}
      </div>
    ) : publicLeadersTab === "batting" ? (
      topRunScorer ? (
        <div className="slp-fastest-fifty-list">
          <PremiumLeaderCard
            rank="1"
            title="Most Runs"
            row={topRunScorer}
            primary={`${topRunScorer?.runs || 0} Runs`}
            secondary={`${topRunScorer?.strikeRate || 0} SR`}
          />

          <PremiumLeaderCard
            rank="2"
            title="Most Sixes"
            row={topSixHitter}
            primary={`${topSixHitter?.sixes || 0} Sixes`}
            secondary={`${topSixHitter?.runs || 0} Runs`}
          />

          <PremiumLeaderCard
            rank="3"
            title="Best Strike Rate"
            row={bestStrikeRate}
            primary={`${bestStrikeRate?.strikeRate || 0}`}
            secondary={`${bestStrikeRate?.runs || 0} Runs`}
          />
        </div>
      ) : (
        <EmptyState
          title="No batting leaders yet"
          message="Batting leaders will appear after runs are scored."
        />
      )
    ) : publicLeadersTab === "bowling" ? (
      topWicketTaker ? (
        <div className="slp-fastest-fifty-list">

        <PremiumLeaderCard
          rank="1"
          title="Most Wickets"
          row={topWicketTaker}
          primary={`${topWicketTaker?.wickets || 0} Wkts`}
          secondary={`${topWicketTaker?.economy || 0} Eco`}
        />

        <PremiumLeaderCard
          rank="2"
          title="Best Economy"
          row={bestEconomy}
          primary={`${bestEconomy?.economy || 0}`}
          secondary={`${bestEconomy?.wickets || 0} Wkts`}
        />

        </div>
      ) : (
        <EmptyState
          title="No bowling leaders yet"
          message="Bowling leaders will appear after wickets are recorded."
        />
      )
    ) : null}
  </section>
)}
          {activeTab === "teams" && (
            <section className="slp-section">
              <SectionHeader
                eyebrow="League directory"
                title="Teams"
                description={`${league.teams?.length || 0} participating teams`}
              />

              {(league.teams || []).length === 0 ? (
                <EmptyState
                  title="No teams yet"
                  message="Teams will appear once they are added."
                />
              ) : (
                <div className="slp-team-list">
                  {(league.teams || []).map((team, index) => (
                    <a
                      key={team.id}
                      href={`/leagues/${league.slug}/teams/${team.id}`}
                      className="slp-team-row"
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <span className="slp-avatar">{getInitials(team.name)}</span>
                      <span>
                        <strong>{team.name}</strong>
                        <small>{team.players?.length || 0} players</small>
                      </span>
                      <b>View team →</b>
                    </a>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

function getInitials(value) {
  return String(value || "C")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

function OverviewSection({
  overviewMatchFeed,
  liveMatches,
  scheduledMatches,
  completedMatches,
  pointsTable,
  topRunScorer,
  topWicketTaker,
  fastestFiftyLeader,
  leagueSlug,
  openTab,
}) {


  return (
    <section className="slp-overview">
 <LiveMatchRail
  matches={overviewMatchFeed.matches}
  mode={overviewMatchFeed.mode}
  eyebrow={overviewMatchFeed.eyebrow}
  title={overviewMatchFeed.title}
  leagueSlug={leagueSlug}
  openTab={openTab}
/>

      <div className="slp-overview-layout">
        <section className="slp-overview-block">
          <div className="slp-block-heading">
            <div>
              <p>Competition pulse</p>
              <h2>League at a glance</h2>
            </div>
          </div>

          <div className="slp-numbers">
            <button type="button" onClick={() => openTab("matches")}>
              <span>Live</span>
              <strong>{liveMatches.length}</strong>
              <small>Matches happening now</small>
            </button>

            <button type="button" onClick={() => openTab("matches")}>
              <span>Upcoming</span>
              <strong>{scheduledMatches.length}</strong>
              <small>Scheduled fixtures</small>
            </button>

            <button type="button" onClick={() => openTab("matches")}>
              <span>Finished</span>
              <strong>{completedMatches.length}</strong>
              <small>Completed results</small>
            </button>

            <button type="button" onClick={() => openTab("points")}>
              <span>Table leader</span>
              <strong className="is-name">
                {pointsTable[0]?.teamName || "—"}
              </strong>
              <small>Current standings leader</small>
            </button>
          </div>
        </section>

        <section className="slp-overview-block">
          <div className="slp-block-heading">
            <div>
              <p>Form players</p>
              <h2>Top performers</h2>
            </div>
            <button type="button" onClick={() => openTab("leaders")}>
              All leaders
            </button>
          </div>

          {!topRunScorer && !topWicketTaker && !fastestFiftyLeader ? (
            <EmptyState
              title="No performers yet"
              message="Player leaders will appear after scoring starts."
            />
          ) : (
            <div className="slp-performers">
              {fastestFiftyLeader && (
  <button
    type="button"
    className="slp-fastest-fifty-performer"
    onClick={() => openTab("leaders")}
  >
    <span className="slp-avatar">
      {getInitials(
        fastestFiftyLeader.playerName
      )}
    </span>

    <span>
      <small>⚡ Fastest fifty</small>

      <strong>
        {fastestFiftyLeader.playerName}
      </strong>

      <em>
        {fastestFiftyLeader.teamName ||
          "League player"}
      </em>
    </span>

    <b>
      {fastestFiftyLeader.ballsToFifty}
    </b>

    <i>balls</i>
  </button>
)}
              {topRunScorer && (
                <button type="button" onClick={() => openTab("leaders")}>
                  <span className="slp-avatar">
                    {getInitials(topRunScorer.playerName)}
                  </span>
                  <span>
                    <small>Top run scorer</small>
                    <strong>{topRunScorer.playerName}</strong>
                    <em>{topRunScorer.teamName || "League player"}</em>
                  </span>
                  <b>{topRunScorer.runs}</b>
                  <i>runs</i>
                </button>
              )}

              {topWicketTaker && (
                <button type="button" onClick={() => openTab("leaders")}>
                  <span className="slp-avatar">
                    {getInitials(topWicketTaker.playerName)}
                  </span>
                  <span>
                    <small>Top wicket taker</small>
                    <strong>{topWicketTaker.playerName}</strong>
                    <em>{topWicketTaker.teamName || "League player"}</em>
                  </span>
                  <b>{topWicketTaker.wickets}</b>
                  <i>wickets</i>
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function FeaturedMatchSpotlight({
  match,
  leagueSlug,
  openTab,
}) {
  const presentation =
    getMatchCardPresentation(match);

  const isLive =
    presentation.type === "live";

  return (
    <article
      className={`slp-spotlight-match ${
        isLive ? "is-live" : ""
      }`}
    >
      <span
        className="slp-spotlight-accent"
        aria-hidden="true"
      />

      <div className="slp-spotlight-main">
        <div className="slp-spotlight-copy">
          <div className="slp-spotlight-meta">
            <span
              className={`slp-spotlight-state ${
                isLive ? "is-live" : ""
              }`}
            >
              {isLive && (
                <i aria-hidden="true" />
              )}

              {presentation.stateLabel}
            </span>

            <span
              className="slp-spotlight-dot"
              aria-hidden="true"
            >
              •
            </span>

            <span className="slp-spotlight-series">
              {match.series?.name ||
                "League match"}
            </span>
          </div>

          <h3>{formatMatchTitle(match)}</h3>

          <p>
            {match.statusText ||
              formatStatusLabel(match.status)}
          </p>
        </div>

        <time
          className={`slp-spotlight-time is-${presentation.type}`}
          dateTime={
            presentation.rawDate?.toISOString()
          }
        >
          <span
            className="slp-spotlight-time-icon"
            aria-hidden="true"
          >
            {presentation.type === "scheduled"
              ? "◷"
              : presentation.type === "live"
                ? "●"
                : presentation.type === "locked"
                  ? "✓"
                  : presentation.type === "abandoned"
                    ? "!"
                    : "■"}
          </span>

          <span className="slp-spotlight-time-copy">
            <small>
              {presentation.timelineLabel}
            </small>

            {presentation.date ? (
              <span className="slp-spotlight-time-line">
                <strong>
                  {presentation.date}
                </strong>

                {presentation.time ? (
                  <>
                    <span
                      className="slp-spotlight-time-divider"
                      aria-hidden="true"
                    >
                      •
                    </span>

                    <em>
                      {presentation.time}
                    </em>
                  </>
                ) : null}
              </span>
            ) : (
              <span className="slp-spotlight-time-line">
                <strong>
                  {presentation.timelineLabel}
                </strong>
              </span>
            )}
          </span>
        </time>

        <div className="slp-spotlight-action">
          {match.shareCode ? (
            <a
              href={`/leagues/${leagueSlug}/matches/${match.id}`}
            >
              <span>Match center</span>
              <Icon name="arrowRight" />
            </a>
          ) : (
            <button
              type="button"
              onClick={() =>
                openTab("matches")
              }
            >
              <span>View fixture</span>
              <Icon name="arrowRight" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function CompactLiveMatchCard({
  match,
  leagueSlug,
  active = false,
}) {
  const presentation =
    getMatchCardPresentation(match);

  const isLive =
    presentation.type === "live";

  return (
    <article
      className={`slp-multi-match-card ${
        isLive ? "is-live" : ""
      } ${active ? "is-active" : ""}`}
    >
      <span
        className="slp-multi-match-accent"
        aria-hidden="true"
      />

      <div className="slp-multi-match-top">
        <span
          className={`slp-multi-match-state ${
            isLive ? "is-live" : ""
          }`}
        >
          {isLive && (
            <i aria-hidden="true" />
          )}

          {presentation.stateLabel}
        </span>

        <div
          className={`slp-multi-match-time is-${presentation.type}`}
        >
          <small>
            {presentation.timelineLabel}
          </small>

          {presentation.date ? (
            <span>{presentation.date}</span>
          ) : null}

          {presentation.time ? (
            <strong>
              {presentation.time}
            </strong>
          ) : null}
        </div>
      </div>

      <div className="slp-multi-match-copy">
        <small>
          {match.series?.name ||
            "League match"}
        </small>

        <h3>{formatMatchTitle(match)}</h3>

        <p>
          {match.statusText ||
            formatStatusLabel(match.status)}
        </p>
      </div>

      <div className="slp-multi-match-footer">
        <span>
          {isLive
            ? "Follow live score"
            : presentation.type ===
                "scheduled"
              ? "Fixture details"
              : presentation.type ===
                  "abandoned"
                ? "Match details"
                : "View scorecard"}
        </span>

        {match.shareCode ? (
          <a
            href={`/leagues/${leagueSlug}/matches/${match.id}`}
          >
            Match center
            <Icon name="arrowRight" />
          </a>
        ) : (
          <span className="slp-multi-match-unavailable">
            Scorecard unavailable
          </span>
        )}
      </div>
    </article>
  );
}

function LiveMatchRail({
  matches = [],
  mode = "empty",
  eyebrow,
  title,
  leagueSlug,
  openTab,
}) {
  const railRef = useRef(null);

  const [activeIndex, setActiveIndex] =
    useState(0);

  const [isPaused, setIsPaused] =
    useState(false);

  const hasMultipleMatches =
    matches.length > 1;

  const shouldAutoRotate =
    mode === "live" &&
    hasMultipleMatches;

  const matchIdentity = matches
    .map((match) => match.id)
    .join(",");

  useEffect(() => {
    setActiveIndex(0);

    const rail = railRef.current;

    if (rail) {
      rail.scrollTo({
        left: 0,
        behavior: "auto",
      });
    }
  }, [mode, matchIdentity]);

  function scrollToMatch(index) {
    const rail = railRef.current;

    if (!rail || !matches.length) {
      return;
    }

    const normalizedIndex =
      (index + matches.length) %
      matches.length;

    const card =
      rail.children[normalizedIndex];

    if (!card) return;

    rail.scrollTo({
      left:
        card.offsetLeft -
        rail.offsetLeft,
      behavior: "smooth",
    });

    setActiveIndex(normalizedIndex);
  }

  function handleRailScroll() {
    const rail = railRef.current;

    if (!rail || !matches.length) {
      return;
    }

    const cards =
      Array.from(rail.children);

    if (!cards.length) return;

    const nearestIndex = cards.reduce(
      (bestIndex, card, index) => {
        const bestCard =
          cards[bestIndex];

        const cardDistance = Math.abs(
          card.offsetLeft -
            rail.scrollLeft
        );

        const bestDistance = Math.abs(
          bestCard.offsetLeft -
            rail.scrollLeft
        );

        return cardDistance <
          bestDistance
          ? index
          : bestIndex;
      },
      0
    );

    setActiveIndex(nearestIndex);
  }

  useEffect(() => {
    if (
      !shouldAutoRotate ||
      isPaused
    ) {
      return undefined;
    }

    const timer =
      window.setInterval(() => {
        setActiveIndex(
          (currentIndex) => {
            const nextIndex =
              (currentIndex + 1) %
              matches.length;

            window.requestAnimationFrame(
              () => {
                const rail =
                  railRef.current;

                const card =
                  rail?.children?.[
                    nextIndex
                  ];

                if (rail && card) {
                  rail.scrollTo({
                    left:
                      card.offsetLeft -
                      rail.offsetLeft,
                    behavior: "smooth",
                  });
                }
              }
            );

            return nextIndex;
          }
        );
      }, 7000);

    return () =>
      window.clearInterval(timer);
  }, [
    shouldAutoRotate,
    isPaused,
    matches.length,
  ]);

  if (!matches.length) {
    return (
      <EmptyState
        title="No matches yet"
        message="Fixtures will appear here when they are created."
      />
    );
  }

  if (matches.length === 1) {
    return (
      <section
        className="slp-spotlight-section"
        aria-label={title}
      >
        <div className="slp-spotlight-heading">
          <div className="slp-spotlight-heading-copy">
            <p>{eyebrow}</p>
            <h2>{title}</h2>
          </div>

          <button
            type="button"
            className="slp-spotlight-view-all"
            onClick={() =>
              openTab("matches")
            }
          >
            View all
          </button>
        </div>

        <FeaturedMatchSpotlight
          match={matches[0]}
          leagueSlug={leagueSlug}
          openTab={openTab}
        />
      </section>
    );
  }

  return (
    <section
      className="slp-live-rail-section"
      aria-label={title}
      onMouseEnter={() =>
        setIsPaused(true)
      }
      onMouseLeave={() =>
        setIsPaused(false)
      }
      onFocusCapture={() =>
        setIsPaused(true)
      }
      onBlurCapture={() =>
        setIsPaused(false)
      }
    >
      <div className="slp-live-rail-head">
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
        </div>

        <div className="slp-live-rail-tools">
          <span>
            {activeIndex + 1} /{" "}
            {matches.length}
          </span>

          <button
            type="button"
            onClick={() =>
              scrollToMatch(
                activeIndex - 1
              )
            }
            aria-label="Previous match"
          >
            ←
          </button>

          <button
            type="button"
            onClick={() =>
              scrollToMatch(
                activeIndex + 1
              )
            }
            aria-label="Next match"
          >
            →
          </button>

          <button
            type="button"
            className="slp-view-all-live"
            onClick={() =>
              openTab("matches")
            }
          >
            View all
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        className="slp-live-rail has-multiple-matches"
        onScroll={handleRailScroll}
      >
        {matches.map(
          (match, index) => (
            <CompactLiveMatchCard
              key={match.id}
              match={match}
              leagueSlug={
                leagueSlug
              }
              active={
                activeIndex === index
              }
            />
          )
        )}
      </div>

      <div
        className="slp-live-dots"
        aria-label="Select match"
      >
        {matches.map(
          (match, index) => (
            <button
              key={match.id}
              type="button"
              className={
                activeIndex === index
                  ? "active"
                  : ""
              }
              onClick={() =>
                scrollToMatch(index)
              }
              aria-label={`Show match ${
                index + 1
              }`}
              aria-current={
                activeIndex === index
                  ? "true"
                  : undefined
              }
            />
          )
        )}
      </div>
    </section>
  );
}

function getMatchCardPresentation(match) {
  const status = normalizeStatus(
    match?.status
  );

  if (LIVE_MATCH_STATUSES.has(status)) {
    const startedDate =
      getLiveMatchDate(match);

    return {
      type: "live",
      stateLabel: "Live now",
      timelineLabel: startedDate
        ? "Started"
        : "In progress",
      date: startedDate
        ? formatFeaturedMatchDate(
            startedDate
          )
        : null,
      time: startedDate
        ? formatFeaturedMatchTime(
            startedDate
          )
        : null,
      rawDate: startedDate,
    };
  }

  if (status === "SCHEDULED") {
    const scheduledDate =
      getScheduledMatchDate(match);

    return {
      type: "scheduled",
      stateLabel: "Upcoming",
      timelineLabel: "Scheduled",
      date: scheduledDate
        ? formatFeaturedMatchDate(
            scheduledDate
          )
        : null,
      time: scheduledDate
        ? formatFeaturedMatchTime(
            scheduledDate
          )
        : null,
      rawDate: scheduledDate,
    };
  }

  const completedDate =
    getCompletedMatchDate(match);

  const isLocked =
    status === "COMPLETED_LOCKED";

  const isAbandoned =
    status === "ABANDONED";

  return {
    type: isAbandoned
      ? "abandoned"
      : isLocked
        ? "locked"
        : "completed",

    stateLabel: isAbandoned
      ? "Abandoned"
      : "Final result",

    timelineLabel: isAbandoned
      ? "Ended"
      : isLocked
        ? "Locked"
        : "Completed",

    date: completedDate
      ? formatFeaturedMatchDate(
          completedDate
        )
      : null,

    time: completedDate
      ? formatFeaturedMatchTime(
          completedDate
        )
      : null,

    rawDate: completedDate,
  };
}

function SearchResults({ searchResults, league }) {
  const isEmpty =
    searchResults.teams.length === 0 &&
    searchResults.players.length === 0 &&
    searchResults.matches.length === 0;

  return (
    <div className="slp-search-results">
      {isEmpty ? (
        <div className="slp-search-empty">
          <strong>No results found</strong>
          <span>Try another team, player, match or series.</span>
        </div>
      ) : (
        <>
          {searchResults.teams.length > 0 && (
            <SearchGroup title="Teams">
              {searchResults.teams.map((team) => (
                <a
                  key={team.id}
                  href={`/leagues/${league.slug}/teams/${team.id}`}
                >
                  <span className="slp-avatar">{getInitials(team.name)}</span>
                  <span>
                    <strong>{team.name}</strong>
                    <small>{team.players?.length || 0} players</small>
                  </span>
                  <b>→</b>
                </a>
              ))}
            </SearchGroup>
          )}

          {searchResults.players.length > 0 && (
            <SearchGroup title="Players">
              {searchResults.players.map((player) => (
                <a
                  key={player.id}
                  href={`/leagues/${league.slug}/players/${player.id}`}
                >
                  <span className="slp-avatar">{getInitials(player.name)}</span>
                  <span>
                    <strong>{player.name}</strong>
                    <small>{player.teamName}</small>
                  </span>
                  <b>→</b>
                </a>
              ))}
            </SearchGroup>
          )}

          {searchResults.matches.length > 0 && (
            <SearchGroup title="Matches">
              {searchResults.matches.map((match) =>
                match.shareCode ? (
                  <a key={match.id} href={`/live/${match.shareCode}`}>
                    <span className="slp-avatar">VS</span>
                    <span>
                      <strong>{formatMatchTitle(match)}</strong>
                      <small>
                        {match.series?.name || "No series"} ·{" "}
                        {formatStatusLabel(match.status)}
                      </small>
                    </span>
                    <b>→</b>
                  </a>
                ) : (
                  <div key={match.id} className="is-disabled">
                    <span className="slp-avatar">VS</span>
                    <span>
                      <strong>{formatMatchTitle(match)}</strong>
                      <small>Scorecard unavailable</small>
                    </span>
                  </div>
                )
              )}
            </SearchGroup>
          )}
        </>
      )}
    </div>
  );
}

function SearchGroup({ title, children }) {
  return (
    <section className="slp-search-group">
      <p>{title}</p>
      <div>{children}</div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className="slp-section-heading">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <span>{description}</span>
    </div>
  );
}

function SegmentedControl({ value, onChange, items }) {
  return (
    <div className="slp-segments">
      {items.map(([key, label, count]) => (
        <button
          key={key}
          type="button"
          className={value === key ? "active" : ""}
          onClick={() => onChange(key)}
        >
          {label}
          {count !== null && count !== undefined && <b>{count}</b>}
        </button>
      ))}
    </div>
  );
}

function MatchRow({ match, leagueSlug }) {
  const status = normalizeStatus(match.status);
  const isLive = ["LIVE", "IN_PROGRESS"].includes(status);

  return (
    <article className="slp-match-row">
      <div className={`slp-status ${getStatusClass(status)}`}>
        {isLive && <span />}
        {formatStatusLabel(match.status)}
      </div>

      <div className="slp-match-copy">
        <small>
          {match.series?.name || "No series"}
          {match.series?.year ? ` · ${match.series.year}` : ""}
        </small>
        <strong>{formatMatchTitle(match)}</strong>
        {match.statusText && <p>{match.statusText}</p>}
      </div>

      <div className="slp-match-date">
        <span>{getMatchDatePart(match, "day")}</span>
        <b>{getMatchDatePart(match, "month")}</b>
      </div>

      {match.shareCode ? (
        <a href={`/leagues/${leagueSlug}/matches/${match.id}`}>
          Match center →
        </a>
      ) : (
        <span className="slp-unavailable">Unavailable</span>
      )}
    </article>
  );
}

function PointsTable({ rows }) {
  return (
    <div className="slp-table-wrap">
      <table className="slp-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Team</th>
            <th>P</th>
            <th>W</th>
            <th>L</th>
            <th>T</th>
            <th>NR</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.teamId}>
              <td>
                <span className="slp-rank">
                  {index + 1}
                </span>
              </td>

              <td>
                <span className="slp-table-team">
                  <span className="slp-avatar">
                    {getInitials(row.teamName)}
                  </span>

                  <strong>{row.teamName}</strong>
                </span>
              </td>

              <td>{row.played}</td>
              <td>{row.won}</td>
              <td>{row.lost}</td>
              <td>{row.tied}</td>
              <td>{row.noResult}</td>

              <td>
                <strong>{row.points}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatsTable({ type, rows }) {
  return (
    <div className="slp-table-wrap">
      <table className="slp-table">
        <thead>
          {type === "batting" ? (
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Team</th>
              <th>Runs</th>
              <th>Balls</th>
              <th>4s</th>
              <th>6s</th>
              <th>SR</th>
            </tr>
          ) : (
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Team</th>
              <th>Overs</th>
              <th>Runs</th>
              <th>Wickets</th>
              <th>Economy</th>
            </tr>
          )}
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.playerId}-${index}`}>
              <td><span className="slp-rank">{index + 1}</span></td>
              <td>
                <span className="slp-table-team">
                  <span className="slp-avatar">{getInitials(row.playerName)}</span>
                  <strong>{row.playerName}</strong>
                </span>
              </td>
              <td>
                {row.isCombinedPlayer ? (
                  <span className="combined-team-label">
                    Surprise 1 & 2
                  </span>
                ) : (
                  row.teamName || "—"
                )}
              </td>
              {type === "batting" ? (
                <>
                  <td><strong>{row.runs}</strong></td>
                  <td>{row.balls}</td>
                  <td>{row.fours}</td>
                  <td>{row.sixes}</td>
                  <td><strong>{row.strikeRate}</strong></td>
                </>
              ) : (
                <>
                  <td>{row.overs}</td>
                  <td>{row.runs}</td>
                  <td><strong>{row.wickets}</strong></td>
                  <td><strong>{row.economy}</strong></td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PremiumLeaderCard({
  rank,
  title,
  row,
  primary,
  secondary,
}) {
  if (!row) return null;

  return (
    <article className="slp-premium-leader">
      <span className="slp-premium-rank">
        {rank}
      </span>

      <div className="slp-premium-player">
        <strong>{row.playerName}</strong>

        <small>
          {row.teamName || "League player"}
        </small>

        <em>{title}</em>
      </div>

      <div className="slp-premium-main">
        <strong>{primary}</strong>
      </div>

      <div className="slp-premium-side">
        <span>{secondary}</span>
      </div>
    </article>
  );
}

function LeaderRow({ rank, label, row, value }) {
  return (
    <article className="slp-leader-row">
      <span className="slp-leader-rank">{rank}</span>
      <span className="slp-avatar">{getInitials(row?.playerName || "?")}</span>
      <span>
        <small>{label}</small>
        <strong>{row?.playerName || "No data yet"}</strong>
        <em>{row?.teamName || "Statistics pending"}</em>
      </span>
      <b>{value}</b>
    </article>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="slp-empty">
      <span>—</span>
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

function getMatchDatePart(match, part) {
  const candidate =
    match.matchDate ||
    match.scheduledAt ||
    match.startTime ||
    match.createdAt;

  if (!candidate) return part === "day" ? "—" : "";

  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) return part === "day" ? "—" : "";

  if (part === "day") return String(date.getDate()).padStart(2, "0");

  return date
    .toLocaleString("en-US", { month: "short" })
    .toUpperCase();
}

function firstValidDate(...candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;

    const date = new Date(candidate);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function formatFeaturedMatchDate(date) {
  if (!date) return null;

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFeaturedMatchTime(date) {
  if (!date) return null;

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getMatchTimeline(match) {
  const status = normalizeStatus(match?.status);

  const isLive = [
    "LIVE",
    "IN_PROGRESS",
    "INPROGRESS",
    "STARTED",
  ].includes(status);

  const isCompleted = [
    "COMPLETED",
    "COMPLETED_LOCKED",
    "COMPLETED_CORRECTED",
  ].includes(status);

  const isAbandoned = status === "ABANDONED";

  /*
   * Completed/locked match:
   * Prefer the lock date because it represents the final
   * published scorecard. Otherwise use completion/end time.
   */
  if (isCompleted) {
    const lockDate = firstValidDate(
      match.lockedAt,
      match.lockDate,
      match.scorecardLockedAt
    );

    if (lockDate) {
      return {
        type: "locked",
        eyebrow: "Scorecard locked",
        date: formatFeaturedMatchDate(lockDate),
        time: formatFeaturedMatchTime(lockDate),
        rawDate: lockDate,
      };
    }

    const completedDate = firstValidDate(
      match.completedAt,
      match.endedAt,
      match.endTime,
      match.endDate,
      match.matchEndedAt,
      match.updatedAt
    );

    if (completedDate) {
      return {
        type: "completed",
        eyebrow: "Match ended",
        date: formatFeaturedMatchDate(completedDate),
        time: formatFeaturedMatchTime(completedDate),
        rawDate: completedDate,
      };
    }
  }

  /*
   * Abandoned match.
   */
  if (isAbandoned) {
    const abandonedDate = firstValidDate(
      match.abandonedAt,
      match.endedAt,
      match.endTime,
      match.updatedAt
    );

    if (abandonedDate) {
      return {
        type: "abandoned",
        eyebrow: "Match abandoned",
        date: formatFeaturedMatchDate(abandonedDate),
        time: formatFeaturedMatchTime(abandonedDate),
        rawDate: abandonedDate,
      };
    }
  }

  /*
   * Live match:
   * Prefer the actual start time over the scheduled time.
   */
  if (isLive) {
    const startedDate = firstValidDate(
      match.startedAt,
      match.matchStartedAt,
      match.actualStartTime,
      match.startTime,
      match.matchDate,
      match.scheduledAt
    );

    if (startedDate) {
      return {
        type: "started",
        eyebrow: "Started",
        date: formatFeaturedMatchDate(startedDate),
        time: formatFeaturedMatchTime(startedDate),
        rawDate: startedDate,
      };
    }
  }

  /*
   * Scheduled/upcoming match.
   */
  const scheduledDate = firstValidDate(
    match.scheduledAt,
    match.matchDate,
    match.scheduledDate,
    match.startTime
  );

  if (scheduledDate) {
    return {
      type: "scheduled",
      eyebrow: "Scheduled",
      date: formatFeaturedMatchDate(scheduledDate),
      time: formatFeaturedMatchTime(scheduledDate),
      rawDate: scheduledDate,
    };
  }

  return null;
}

function getValidDate(...values) {
  for (const value of values) {
    if (!value) continue;

    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function getScheduledMatchDate(match) {
  return getValidDate(
    match?.scheduledAt,
    match?.matchDate,
    match?.scheduledDate,
    match?.startTime,
    match?.createdAt
  );
}

function getLiveMatchDate(match) {
  return getValidDate(
    match?.startedAt,
    match?.matchStartedAt,
    match?.actualStartTime
  );
}

function getCompletedMatchDate(match) {
  return getValidDate(
    match?.lockedAt,
    match?.lockDate,
    match?.scorecardLockedAt,
    match?.completedAt,
    match?.endedAt,
    match?.endTime,
    match?.updatedAt
  );
}

function formatStatusLabel(status) {
  return normalizeStatus(status)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusClass(status) {
  if (["LIVE", "IN_PROGRESS"].includes(status)) return "is-live";
  if (["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED"].includes(status)) {
    return "is-completed";
  }
  if (status === "ABANDONED") return "is-abandoned";
  return "is-scheduled";
}

function Icon({ name }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" /></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" /></>,
    arrowRight: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  };

  return (
    <svg
      className="slp-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.arrowRight}
    </svg>
  );
}
