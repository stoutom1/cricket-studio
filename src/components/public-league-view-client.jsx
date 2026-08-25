"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "@/app/spectator-league-v2.css";
import LeagueAlertControls from "@/components/league-alert-controls";
import { buildPointsTable as buildSharedPointsTable } from "@/lib/points-table";
import { shouldExcludePlayerFromLeagueAnalytics } from "@/lib/player-analytics-exclusions";
import {
  getLeagueAnalyticsPlayerKey,
  isSurpriseCricketLeague,
} from "@/lib/surprise-player-identity";
import {
  buildLeagueRecords,
} from "@/lib/league-records";
import {
  buildLeagueMilestones,
} from "@/lib/league-milestones";
import {
  buildTeamDNA,
} from "@/lib/team-dna";
import {
  buildTeamRivalries,
} from "@/lib/team-rivalries";
import {
  buildPreMatchCenter,
} from "@/lib/pre-match-center";
import {
  buildShareCardCatalog,
  shareCric4AllCard,
} from "@/lib/share-cards";
import {
  buildWeeklyLeagueDigest,
  copyWeeklyLeagueDigest,
  shareWeeklyLeagueDigest,
} from "@/lib/weekly-league-digest";
import {
  buildPlayerPerformanceCenter,
} from "@/lib/player-performance-center";

function normalizeStatus(status) {
  return String(status || "SCHEDULED").toUpperCase();
}

function formatMatchTitle(match) {
  return `${match.teamA?.name || match.teamAName || "Team A"} vs ${
    match.teamB?.name || match.teamBName || "Team B"
  }`;
}

function buildPointsTable(matches, teams) {
  const table = new Map();

  (teams || []).forEach((team) => {
    table.set(Number(team.id), {
      teamId: Number(team.id),
      teamName: team.name,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      points: 0,
    });
  });

  (matches || []).forEach((match) => {
    const status = normalizeStatus(match.status);
    if (!["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED"].includes(status)) return;

    const teamA = table.get(Number(match.teamAId));
    const teamB = table.get(Number(match.teamBId));
    if (!teamA || !teamB) return;

    teamA.played += 1;
    teamB.played += 1;

    const statusText = String(match.statusText || "").toLowerCase();

    if (statusText.includes("tied")) {
      teamA.tied += 1;
      teamB.tied += 1;
      teamA.points += 1;
      teamB.points += 1;
      return;
    }

    if (statusText.includes(String(teamA.teamName).toLowerCase())) {
      teamA.won += 1;
      teamB.lost += 1;
      teamA.points += 2;
      return;
    }

    if (statusText.includes(String(teamB.teamName).toLowerCase())) {
      teamB.won += 1;
      teamA.lost += 1;
      teamB.points += 2;
    }
  });

  return [...table.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.won - a.won ||
      a.teamName.localeCompare(b.teamName)
  );
}

function buildPublicStats(matches, league) {
  const batting = new Map();
  const bowling = new Map();
  const fielding = new Map();

  /*
   * Fielding relations are intentionally resolved from the league roster
   * instead of requiring additional Prisma includes on every public ball.
   * This keeps the public page payload stable while still letting Leaders use
   * the same filtered completed matches as Batting and Bowling.
   */
  const playerDirectory = new Map();

  for (const team of league?.teams || []) {
    for (const player of team?.players || []) {
      playerDirectory.set(
        Number(player.id),
        {
          playerId: Number(player.id),
          playerName: player.name || `Player ${player.id}`,
          teamName: team.name || "",
        }
      );
    }
  }

  function ensureFieldingRow(playerId) {
    const numericPlayerId = Number(playerId);
    if (!numericPlayerId) return null;

    const player = playerDirectory.get(numericPlayerId);
    const playerName = player?.playerName || `Player ${numericPlayerId}`;

    const key = getLeagueAnalyticsPlayerKey({
      league,
      playerId: numericPlayerId,
      playerName,
    });

    if (!fielding.has(key)) {
      fielding.set(key, {
        playerId: numericPlayerId,
        playerName,
        teamName: player?.teamName || "",
        catches: 0,
        runOuts: 0,
        stumpings: 0,
        assists: 0,
        matches: new Set(),
      });
    }

    return fielding.get(key);
  }

  for (const match of matches || []) {
    for (const ball of match.balls || []) {
      const strikerId = Number(ball.strikerId);
      const bowlerId = Number(ball.bowlerId);
      const strikerName = ball.striker?.name || `Player ${strikerId}`;
      const bowlerName = ball.bowler?.name || `Player ${bowlerId}`;
      const strikerKey = getLeagueAnalyticsPlayerKey({
        league,
        playerId: strikerId,
        playerName: strikerName,
      });
      const bowlerKey = getLeagueAnalyticsPlayerKey({
        league,
        playerId: bowlerId,
        playerName: bowlerName,
      });

      if (strikerId) {
        if (!batting.has(strikerKey)) {
          batting.set(strikerKey, {
            playerId: strikerId,
            playerName: strikerName,
            teamName: ball.striker?.team?.name || "",
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            matches: new Set(),
          });
        }

        const row = batting.get(strikerKey);
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
        if (!bowling.has(bowlerKey)) {
          bowling.set(bowlerKey, {
            playerId: bowlerId,
            playerName: bowlerName,
            teamName: ball.bowler?.team?.name || "",
            balls: 0,
            runs: 0,
            wickets: 0,
            dots: 0,
            matches: new Set(),
          });
        }

        const row = bowling.get(bowlerKey);
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

      const fielderRow =
        ensureFieldingRow(
          ball.fielderId
        );

      if (fielderRow) {
        const wicketType =
          String(
            ball.wicketType ||
            ""
          )
            .trim()
            .toUpperCase();

        if (wicketType === "CAUGHT") {
          fielderRow.catches += 1;
          fielderRow.matches.add(match.id);
        } else if (wicketType === "RUN_OUT") {
          fielderRow.runOuts += 1;
          fielderRow.matches.add(match.id);
        } else if (wicketType === "STUMPED") {
          fielderRow.stumpings += 1;
          fielderRow.matches.add(match.id);
        }
      }

      const assistantRow =
        String(
          ball.wicketType ||
          ""
        )
          .trim()
          .toUpperCase() ===
          "RUN_OUT"
          ? ensureFieldingRow(
              ball.assistantFielderId
            )
          : null;

      if (assistantRow) {
        assistantRow.assists += 1;
        assistantRow.matches.add(match.id);
      }
    }
  }

  const battingRows = [...batting.values()]
    .filter(
      (row) =>
        !shouldExcludePlayerFromLeagueAnalytics(
          league,
          row.playerName
        )
    )
    .map((row) => ({
      ...row,
      matches: row.matches.size,
      strikeRate: row.balls ? ((row.runs / row.balls) * 100).toFixed(2) : "0.00",
    }))
    .sort((a, b) => b.runs - a.runs);

  const bowlingRows = [...bowling.values()]
    .filter(
      (row) =>
        !shouldExcludePlayerFromLeagueAnalytics(
          league,
          row.playerName
        )
    )
    .map((row) => ({
      ...row,
      matches: row.matches.size,
      overs: `${Math.floor(row.balls / 6)}.${row.balls % 6}`,
      economy: row.balls ? ((row.runs / row.balls) * 6).toFixed(2) : "0.00",
    }))
    .sort((a, b) => b.wickets - a.wickets || Number(a.economy) - Number(b.economy));

  const fieldingRows = [...fielding.values()]
    .filter(
      (row) =>
        !shouldExcludePlayerFromLeagueAnalytics(
          league,
          row.playerName
        )
    )
    .map((row) => ({
      ...row,
      matches: row.matches.size,
      fieldingTotal:
        Number(row.catches || 0) +
        Number(row.runOuts || 0) +
        Number(row.stumpings || 0) +
        Number(row.assists || 0),
    }))
    .filter((row) => row.fieldingTotal > 0)
    .sort(
      (a, b) =>
        b.fieldingTotal - a.fieldingTotal ||
        b.catches - a.catches ||
        b.runOuts - a.runOuts
    );

  /*
   * Use the same Cric4All impact weights as /api/leagues/[id]/stats:
   * runs + 25 per wicket + 10 per catch/run-out/stumping + 5 per assist.
   *
   * Merge by the league analytics identity key so Surprise Cricket League's
   * combined-player exception remains consistent across all leader categories.
   */
  const allRound = new Map();

  function mergeImpactRow(source, type) {
    for (const row of source || []) {
      const key = getLeagueAnalyticsPlayerKey({
        league,
        playerId: row.playerId,
        playerName: row.playerName,
      });

      if (!allRound.has(key)) {
        allRound.set(key, {
          playerId: row.playerId,
          playerName: row.playerName,
          teamName: row.teamName || "",
          matches: 0,
          runs: 0,
          wickets: 0,
          catches: 0,
          runOuts: 0,
          stumpings: 0,
          assists: 0,
          fieldingTotal: 0,
        });
      }

      const target = allRound.get(key);

      if (!target.teamName && row.teamName) {
        target.teamName = row.teamName;
      }

      target.matches = Math.max(
        Number(target.matches || 0),
        Number(row.matches || 0)
      );

      if (type === "batting") {
        target.runs = Number(row.runs || 0);
      } else if (type === "bowling") {
        target.wickets = Number(row.wickets || 0);
      } else if (type === "fielding") {
        target.catches = Number(row.catches || 0);
        target.runOuts = Number(row.runOuts || 0);
        target.stumpings = Number(row.stumpings || 0);
        target.assists = Number(row.assists || 0);
        target.fieldingTotal = Number(row.fieldingTotal || 0);
      }
    }
  }

  mergeImpactRow(battingRows, "batting");
  mergeImpactRow(bowlingRows, "bowling");
  mergeImpactRow(fieldingRows, "fielding");

  const allRoundRows = [...allRound.values()]
    .map((row) => ({
      ...row,
      allRounderPoints:
        Number(row.runs || 0) +
        Number(row.wickets || 0) * 25 +
        Number(row.catches || 0) * 10 +
        Number(row.runOuts || 0) * 10 +
        Number(row.stumpings || 0) * 10 +
        Number(row.assists || 0) * 5,
    }))
    .filter((row) => row.allRounderPoints > 0)
    .sort(
      (a, b) =>
        b.allRounderPoints - a.allRounderPoints ||
        b.runs - a.runs ||
        b.wickets - a.wickets
    );

  return {
    battingRows,
    bowlingRows,
    fieldingRows,
    allRoundRows,
  };
}

export default function PublicLeagueViewClient({ league, numericLeagueId }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [matchStatusFilter, setMatchStatusFilter] = useState("all");
  const [publicSearch, setPublicSearch] = useState("");
  const [publicStatsTab, setPublicStatsTab] = useState("batting");
  const [publicLeadersTab, setPublicLeadersTab] = useState("batting");
  const [publicPulseTab, setPublicPulseTab] = useState("rankings");
  const [publicRankingCategory, setPublicRankingCategory] = useState("overall");
  const [publicFormSearch, setPublicFormSearch] = useState("");
  const [publicPulsePlayerSearch, setPublicPulsePlayerSearch] = useState("");
  const [publicRecordsTab, setPublicRecordsTab] = useState("all");
  const [publicMilestonesTab, setPublicMilestonesTab] = useState("recent");
  const [publicDnaTeamId, setPublicDnaTeamId] = useState("all");
  const [publicRivalryKey, setPublicRivalryKey] = useState("");
  const [publicPreviewMatchId, setPublicPreviewMatchId] = useState("");
  const [shareCardBusyId, setShareCardBusyId] = useState("");
  const [shareCardNotice, setShareCardNotice] = useState("");
  const [digestBusyAction, setDigestBusyAction] = useState("");
  const [digestNotice, setDigestNotice] = useState("");
  const [leagueStats, setLeagueStats] = useState(null);
  const [leagueStatsLoading, setLeagueStatsLoading] = useState(false);
  const [leagueStatsError, setLeagueStatsError] = useState("");
  const [leagueAwards, setLeagueAwards] = useState(null);
  const [leagueAwardsLoading, setLeagueAwardsLoading] = useState(false);
  const [leagueAwardsError, setLeagueAwardsError] = useState("");
  const [isFollowing, setIsFollowing] = useState(Boolean(league.isFollowing));
  const [followBusy, setFollowBusy] = useState(false);

  const resolvedLeagueId =
    Number(
      numericLeagueId
    );

  const hasValidLeagueId =
    Number.isInteger(
      resolvedLeagueId
    ) &&
    resolvedLeagueId > 0;

async function toggleFollowLeague() {
  try {
    setFollowBusy(true);

    if (!hasValidLeagueId) {
      throw new Error(
        "Cric4All did not receive the numeric league ID for this public page."
      );
    }

    const res = await fetch(
      `/api/public-league-follow/${resolvedLeagueId}`,
      {
        method: isFollowing ? "DELETE" : "POST",
        credentials: "include",
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Unable to follow league.");
    }

    setIsFollowing(
      Boolean(
        data.followed
      )
    );
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openTabAndClear(tabName) {
    setActiveTab(tabName);
    setPublicSearch("");
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
      .filter(
        (player) =>
          !shouldExcludePlayerFromLeagueAnalytics(
            league,
            player
          )
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

  const liveMatches = filteredMatches.filter((m) =>
    ["LIVE", "IN_PROGRESS"].includes(normalizeStatus(m.status))
  );

  const scheduledMatches = filteredMatches.filter(
    (m) => normalizeStatus(m.status) === "SCHEDULED"
  );

  const completedMatches = filteredMatches.filter((m) =>
    ["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED", "ABANDONED"].includes(normalizeStatus(m.status))
  );

  const visibleMatches = useMemo(() => {
    if (matchStatusFilter === "live") return liveMatches;
    if (matchStatusFilter === "scheduled") return scheduledMatches;
    if (matchStatusFilter === "completed") return completedMatches;
    return filteredMatches;
  }, [matchStatusFilter, liveMatches, scheduledMatches, completedMatches, filteredMatches]);

  const pointsTable = useMemo(
    () =>
      buildSharedPointsTable({
        teams: league.teams || [],
        matches: filteredMatches,
      }),
    [filteredMatches, league.teams]
  );

  /*
   * Statistical eligibility is intentionally stricter than match-history
   * eligibility. Abandoned/cancelled/no-result/live/scheduled matches may
   * remain visible in the public match lists, but must never contribute
   * partial player performance to career statistics.
   */
  const statsEligibleMatches = useMemo(
    () =>
      filteredMatches.filter((match) =>
        ["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED"].includes(
          normalizeStatus(match?.status)
        )
      ),
    [filteredMatches]
  );

  const playerPerformanceCenter = useMemo(
    () =>
      buildPlayerPerformanceCenter(
        statsEligibleMatches,
        league
      ),
    [statsEligibleMatches, league]
  );

  const leagueRecords = useMemo(
    () =>
      buildLeagueRecords(
        statsEligibleMatches,
        league
      ),
    [statsEligibleMatches, league]
  );

  const visibleRecords = useMemo(
    () =>
      publicRecordsTab === "all"
        ? leagueRecords.records
        : leagueRecords.records.filter(
            (record) =>
              String(record.category || "").toLowerCase() ===
              publicRecordsTab
          ),
    [
      leagueRecords.records,
      publicRecordsTab,
    ]
  );

  const leagueMilestones = useMemo(
    () =>
      buildLeagueMilestones(
        statsEligibleMatches,
        league
      ),
    [statsEligibleMatches, league]
  );

  const teamDNA = useMemo(
    () =>
      buildTeamDNA({
        matches: statsEligibleMatches,
        teams: league.teams || [],
      }),
    [statsEligibleMatches, league.teams]
  );

  const visibleTeamDNA = useMemo(
    () =>
      publicDnaTeamId === "all"
        ? teamDNA.teams
        : teamDNA.teams.filter(
            (team) =>
              Number(team.teamId) === Number(publicDnaTeamId)
          ),
    [teamDNA.teams, publicDnaTeamId]
  );

  const teamRivalries = useMemo(
    () =>
      buildTeamRivalries({
        matches: filteredMatches,
        league,
      }),
    [filteredMatches, league]
  );

  const selectedRivalry = useMemo(
    () =>
      teamRivalries.rivalries.find(
        (rivalry) =>
          rivalry.key === publicRivalryKey
      ) ||
      teamRivalries.rivalries[0] ||
      null,
    [
      teamRivalries.rivalries,
      publicRivalryKey,
    ]
  );

  const preMatchCenter = useMemo(
    () =>
      buildPreMatchCenter({
        matches: filteredMatches,
        teams: league.teams || [],
        league,
        teamDNA: teamDNA.teams,
      }),
    [
      filteredMatches,
      league.teams,
      league,
      teamDNA.teams,
    ]
  );

  const selectedPreview = useMemo(
    () =>
      preMatchCenter.previews.find(
        (preview) =>
          Number(preview.matchId) ===
          Number(publicPreviewMatchId)
      ) ||
      preMatchCenter.previews[0] ||
      null,
    [
      preMatchCenter.previews,
      publicPreviewMatchId,
    ]
  );

  const {
    battingRows,
    bowlingRows,
    fieldingRows,
    allRoundRows,
  } = useMemo(
    () => buildPublicStats(statsEligibleMatches, league),
    [statsEligibleMatches, league]
  );

  /*
   * Leaders uses the same league Stats API as Dashboard once it has loaded.
   * Local rows are only a loading fallback, preventing Explore and Dashboard
   * from drifting into separate definitions of runs, wickets or impact.
   */
  const leaderBattingRows =
    leagueStats?.batting ||
    battingRows;

  const leaderBowlingRows =
    leagueStats?.bowling ||
    bowlingRows;

  const leaderFieldingRows =
    leagueStats?.fielding ||
    fieldingRows;

  const leaderAllRoundRows =
    leagueStats
      ?.rankings
      ?.bestAllRounders ||
    allRoundRows;

  const topRunScorer = leaderBattingRows[0];
  const topWicketTaker = leaderBowlingRows[0];

  /*
   * Leaders is intentionally a "best-of" experience rather than another copy
   * of the Stats tables. Each tile answers one quick spectator question and
   * uses only completed-match data already calculated for this public view.
   */
  const topSixHitter = [...leaderBattingRows]
    .filter((p) => Number(p.sixes || 0) > 0)
    .sort((a, b) => b.sixes - a.sixes || b.runs - a.runs)[0];

  const topFourHitter = [...leaderBattingRows]
    .filter((p) => Number(p.fours || 0) > 0)
    .sort((a, b) => b.fours - a.fours || b.runs - a.runs)[0];

  const bestStrikeRate = [...leaderBattingRows]
    .filter((p) => p.balls >= 5)
    .sort((a, b) => Number(b.strikeRate) - Number(a.strikeRate) || b.runs - a.runs)[0];

  const bestRunsPerMatch = [...leaderBattingRows]
    .filter((p) => p.matches >= 1 && p.runs > 0)
    .map((p) => ({
      ...p,
      runsPerMatch: p.runs / p.matches,
    }))
    .sort((a, b) => b.runsPerMatch - a.runsPerMatch || b.runs - a.runs)[0];

  const bestEconomy = [...leaderBowlingRows]
    .filter((p) => p.balls >= 6)
    .sort((a, b) => Number(a.economy) - Number(b.economy) || b.wickets - a.wickets)[0];

  const topDotBowler = [...leaderBowlingRows]
    .filter((p) => Number(p.dots || 0) > 0)
    .sort((a, b) => b.dots - a.dots || b.wickets - a.wickets)[0];

  const bestBowlingStrikeRate = [...leaderBowlingRows]
    .filter((p) => p.wickets > 0 && p.balls >= 6)
    .map((p) => ({
      ...p,
      bowlingStrikeRate: p.balls / p.wickets,
    }))
    .sort(
      (a, b) =>
        a.bowlingStrikeRate - b.bowlingStrikeRate ||
        b.wickets - a.wickets
    )[0];

  const bowlingWorkhorse = [...leaderBowlingRows]
    .filter((p) => p.balls > 0)
    .sort((a, b) => b.balls - a.balls || b.wickets - a.wickets)[0];

  const topFielder = leaderFieldingRows[0];

  const safestHands = [...leaderFieldingRows]
    .filter((p) => p.catches > 0)
    .sort((a, b) => b.catches - a.catches || b.fieldingTotal - a.fieldingTotal)[0];

  const runOutSpecialist = [...leaderFieldingRows]
    .filter((p) => p.runOuts > 0)
    .sort((a, b) => b.runOuts - a.runOuts || b.fieldingTotal - a.fieldingTotal)[0];

  const assistLeader = [...leaderFieldingRows]
    .filter((p) => p.assists > 0)
    .sort((a, b) => b.assists - a.assists || b.fieldingTotal - a.fieldingTotal)[0];

  const stumpingLeader = [...leaderFieldingRows]
    .filter((p) => p.stumpings > 0)
    .sort((a, b) => b.stumpings - a.stumpings || b.fieldingTotal - a.fieldingTotal)[0];

  const topImpactPlayer = leaderAllRoundRows[0];

  const balancedForce = [...leaderAllRoundRows]
    .filter((p) => p.runs > 0 && p.wickets > 0)
    .map((p) => ({
      ...p,
      twoWayPoints:
        Number(p.runs || 0) +
        Number(p.wickets || 0) * 25,
    }))
    .sort(
      (a, b) =>
        b.twoWayPoints - a.twoWayPoints ||
        b.allRounderPoints - a.allRounderPoints
    )[0];

  const threeDimensionalPlayer = [...leaderAllRoundRows]
    .filter(
      (p) =>
        p.runs > 0 &&
        p.wickets > 0 &&
        p.fieldingTotal > 0
    )
    .sort(
      (a, b) =>
        b.allRounderPoints - a.allRounderPoints
    )[0];

  const bestImpactPerMatch = [...leaderAllRoundRows]
    .filter((p) => p.matches >= 2)
    .map((p) => ({
      ...p,
      impactPerMatch:
        p.allRounderPoints /
        p.matches,
    }))
    .sort(
      (a, b) =>
        b.impactPerMatch - a.impactPerMatch ||
        b.allRounderPoints - a.allRounderPoints
    )[0];

  const completePackage = [...leaderAllRoundRows]
    .map((p) => ({
      ...p,
      disciplines:
        Number(p.runs > 0) +
        Number(p.wickets > 0) +
        Number(p.fieldingTotal > 0),
    }))
    .filter((p) => p.disciplines >= 2)
    .sort(
      (a, b) =>
        b.disciplines - a.disciplines ||
        b.allRounderPoints - a.allRounderPoints
    )[0];

  const weeklyDigest = useMemo(
    () =>
      buildWeeklyLeagueDigest({
        matches: filteredMatches,
        league,
        pointsTable,
        leagueMilestones,
        leagueRecords,
      }),
    [
      filteredMatches,
      league,
      pointsTable,
      leagueMilestones,
      leagueRecords,
    ]
  );

  async function handleDigestAction(action) {
    try {
      setDigestBusyAction(action);
      setDigestNotice("");

      if (action === "copy") {
        await copyWeeklyLeagueDigest(
          weeklyDigest
        );

        setDigestNotice(
          "Weekly digest copied."
        );

        return;
      }

      const result =
        await shareWeeklyLeagueDigest(
          weeklyDigest,
          league?.name
        );

      setDigestNotice(
        result.mode === "shared"
          ? "Share sheet opened."
          : result.mode === "copied"
            ? "Weekly digest copied."
            : "Sharing is unavailable in this browser."
      );
    } catch (error) {
      if (error?.name !== "AbortError") {
        setDigestNotice(
          error?.message ||
          "Unable to share the weekly digest."
        );
      }
    } finally {
      setDigestBusyAction("");
    }
  }

  const shareCards = useMemo(
    () =>
      buildShareCardCatalog({
        league,
        topRunScorer,
        topWicketTaker,
        topFielder,
        topImpactPlayer,
        leagueRecords,
        leagueMilestones,
        selectedYear,
        selectedSeriesId,
      }),
    [
      league,
      topRunScorer,
      topWicketTaker,
      topFielder,
      topImpactPlayer,
      leagueRecords,
      leagueMilestones,
      selectedYear,
      selectedSeriesId,
    ]
  );

  async function handleShareCard(card) {
    try {
      setShareCardBusyId(card.id);
      setShareCardNotice("");

      const result =
        await shareCric4AllCard(card);

      setShareCardNotice(
        result.mode === "shared"
          ? "Share sheet opened."
          : result.mode === "downloaded"
            ? "PNG saved. Share caption copied when permitted."
            : "Sharing is unavailable in this browser."
      );
    } catch (error) {
      if (error?.name !== "AbortError") {
        setShareCardNotice(
          error?.message ||
          "Unable to generate this share card."
        );
      }
    } finally {
      setShareCardBusyId("");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadLeagueStats() {
      if (!hasValidLeagueId) return;

      try {
        setLeagueStatsLoading(true);
        setLeagueStatsError("");

        const leaderSeriesIds =
          selectedSeriesId
            ? [
                Number(
                  selectedSeriesId
                ),
              ]
            : selectedYear
              ? (league.series || [])
                  .filter(
                    (series) =>
                      Number(series.year) ===
                      Number(selectedYear)
                  )
                  .map(
                    (series) =>
                      Number(series.id)
                  )
                  .filter(
                    (value) =>
                      Number.isInteger(value) &&
                      value > 0
                  )
              : [];

        const statsQuery =
          new URLSearchParams();

        if (leaderSeriesIds.length) {
          statsQuery.set(
            "seriesIds",
            leaderSeriesIds.join(",")
          );
        } else if (selectedYear) {
          statsQuery.set(
            "seriesIds",
            "none"
          );
        }

        const response = await fetch(
          `/api/leagues/${resolvedLeagueId}/stats${
            statsQuery.toString()
              ? `?${statsQuery.toString()}`
              : ""
          }`,
          { cache: "no-store" }
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error || "Unable to load league statistics.");
        }

        if (!cancelled) setLeagueStats(data);
      } catch (error) {
        if (!cancelled) {
          setLeagueStatsError(error?.message || "Unable to load league statistics.");
        }
      } finally {
        if (!cancelled) setLeagueStatsLoading(false);
      }
    }

    loadLeagueStats();
    return () => { cancelled = true; };
  }, [
    hasValidLeagueId,
    resolvedLeagueId,
    selectedSeriesId,
    selectedYear,
    league.series,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadLeagueAwards() {
      if (!hasValidLeagueId) return;

      try {
        setLeagueAwardsLoading(true);
        setLeagueAwardsError("");

        const params = new URLSearchParams();
        if (selectedSeriesId) {
          params.set("seriesId", String(selectedSeriesId));
        } else {
          params.set("period", "MONTH");
        }

        const response = await fetch(
          `/api/leagues/${resolvedLeagueId}/awards?${params.toString()}`,
          { cache: "no-store" }
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error || "Unable to load league awards.");
        }

        if (!cancelled) setLeagueAwards(data);
      } catch (error) {
        if (!cancelled) {
          setLeagueAwardsError(error?.message || "Unable to load league awards.");
        }
      } finally {
        if (!cancelled) setLeagueAwardsLoading(false);
      }
    }

    loadLeagueAwards();
    return () => { cancelled = true; };
  }, [hasValidLeagueId, resolvedLeagueId, selectedSeriesId]);

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
              <h1>{league.name}</h1>
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

              <LeagueAlertControls
                leagueId={
                  resolvedLeagueId
                }
                leagueName={league.name}
                isFollowing={isFollowing}
              />

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
          <div className="slp-filters">
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
            ["preview", "Match Preview"],
            ["matches", "Matches"],
            ["points", "Standings"],
            ["stats", "Stats"],
            ["leaders", "Leaders"],
            ["pulse", "Player Pulse"],
            ["records", "Records"],
            ["milestones", "Milestones"],
            ["rivalries", "Rivalries"],
            ["dna", "Team DNA"],
            ["digest", "Digest"],
            ["share", "Share"],
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
              liveMatches={liveMatches}
              scheduledMatches={scheduledMatches}
              completedMatches={completedMatches}
              pointsTable={pointsTable}
              topRunScorer={topRunScorer}
              topWicketTaker={topWicketTaker}
              leagueSlug={league.slug}
              openTab={openTab}
            />
          )}

          {activeTab === "preview" && (
            <section className="slp-section">
              <SectionHeader
                eyebrow="Pre-match center"
                title="Match Preview"
                description={`${preMatchCenter.scheduledCount} upcoming match${preMatchCenter.scheduledCount === 1 ? "" : "es"} · ${preMatchCenter.completedContextMatches} completed match${preMatchCenter.completedContextMatches === 1 ? "" : "es"} of context`}
              />

              {preMatchCenter.previews.length ? (
                <>
                  <div className="slp-preview-toolbar">
                    <label>
                      <span>Upcoming fixture</span>
                      <select
                        value={
                          publicPreviewMatchId ||
                          selectedPreview?.matchId ||
                          ""
                        }
                        onChange={(event) =>
                          setPublicPreviewMatchId(event.target.value)
                        }
                      >
                        {preMatchCenter.previews.map((preview) => (
                          <option
                            key={preview.matchId}
                            value={preview.matchId}
                          >
                            {preview.teamAName} vs {preview.teamBName}
                          </option>
                        ))}
                      </select>
                    </label>

                    <span className="slp-preview-scope">
                      {selectedSeriesId
                        ? "Series context"
                        : selectedYear
                          ? `Season ${selectedYear}`
                          : "League context"}
                    </span>
                  </div>

                  {selectedPreview ? (
                    <PreMatchPreview preview={selectedPreview} />
                  ) : null}
                </>
              ) : (
                <EmptyState
                  title="No upcoming fixture to preview"
                  message="The Pre-Match Center appears when a scheduled match exists in the selected Season/Series."
                />
              )}

              <div className="slp-preview-note">
                <span aria-hidden="true">🔎</span>
                <p>
                  <strong>Evidence, not prediction</strong>
                  Cric4All uses completed matches for head-to-head, recent
                  form, Team DNA and players to watch. It does not invent a
                  win probability or claim to know who will win.
                </p>
              </div>
            </section>
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
                title="Statistics & Awards"
                description="League-wide completed-match batting, bowling, fielding, captaincy, wicketkeeping, rankings and awards"
              />

              <SegmentedControl
                value={publicStatsTab}
                onChange={setPublicStatsTab}
                items={[
                  ["batting", "Batting", leagueStats?.batting?.length || battingRows.length],
                  ["bowling", "Bowling", leagueStats?.bowling?.length || bowlingRows.length],
                  ["fielding", "Fielding", leagueStats?.fielding?.length || 0],
                  ["captaincy", "Captaincy", leagueStats?.captaincy?.length || 0],
                  ["wicketkeeping", "Keeping", leagueStats?.wicketkeeping?.length || 0],
                  ["rankings", "Rankings", null],
                  ["awards", "Awards", leagueAwards?.awards?.length || 0],
                ]}
              />

              {leagueStatsLoading && publicStatsTab !== "awards" ? (
                <EmptyState title="Loading statistics" message="Building the completed-match league statistics..." />
              ) : leagueStatsError && publicStatsTab !== "awards" ? (
                <EmptyState title="Statistics unavailable" message={leagueStatsError} />
              ) : publicStatsTab === "batting" ? (
                <DashboardStatsTable type="batting" rows={leagueStats?.batting || battingRows} />
              ) : publicStatsTab === "bowling" ? (
                <DashboardStatsTable type="bowling" rows={leagueStats?.bowling || bowlingRows} />
              ) : publicStatsTab === "fielding" ? (
                <DashboardStatsTable type="fielding" rows={leagueStats?.fielding || []} />
              ) : publicStatsTab === "captaincy" ? (
                <DashboardStatsTable type="captaincy" rows={leagueStats?.captaincy || []} />
              ) : publicStatsTab === "wicketkeeping" ? (
                <DashboardStatsTable type="wicketkeeping" rows={leagueStats?.wicketkeeping || []} />
              ) : publicStatsTab === "rankings" ? (
                <PublicRankings rankings={leagueStats?.rankings} />
              ) : leagueAwardsLoading ? (
                <EmptyState title="Loading awards" message="Calculating league awards from completed matches..." />
              ) : leagueAwardsError ? (
                <EmptyState title="Awards unavailable" message={leagueAwardsError} />
              ) : (
                <PublicAwards awardsData={leagueAwards} />
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
                  ["batting", "Batting", null],
                  ["bowling", "Bowling", null],
                  ["fielding", "Fielding", null],
                  ["allround", "All-Round", null],
                ]}
              />

              {!topRunScorer &&
              !topWicketTaker &&
              !topFielder ? (
                <EmptyState
                  title="No leaders yet"
                  message="Leaders will appear after qualifying completed-match performances."
                />
              ) : publicLeadersTab === "batting" ? (
                <LeaderShowcase
                  accent="batting"
                  hero={{
                    eyebrow: "Orange cap",
                    icon: "🏏",
                    label: "Run machine",
                    row: topRunScorer,
                    value: `${topRunScorer?.runs || 0}`,
                    unit: "runs",
                    detail: topRunScorer
                      ? `${topRunScorer.matches} match${topRunScorer.matches === 1 ? "" : "es"} · ${topRunScorer.balls} balls`
                      : "",
                  }}
                  cards={[
                    {
                      icon: "🚀",
                      label: "Power hitter",
                      hint: "Most sixes",
                      row: topSixHitter,
                      value: topSixHitter?.sixes || 0,
                      unit: "sixes",
                    },
                    {
                      icon: "⚡",
                      label: "Boundary boss",
                      hint: "Most fours",
                      row: topFourHitter,
                      value: topFourHitter?.fours || 0,
                      unit: "fours",
                    },
                    {
                      icon: "🔥",
                      label: "Accelerator",
                      hint: "Best SR · min 5 balls",
                      row: bestStrikeRate,
                      value: bestStrikeRate?.strikeRate || "0.00",
                      unit: "SR",
                    },
                    {
                      icon: "📈",
                      label: "Match impact",
                      hint: "Best runs per match",
                      row: bestRunsPerMatch,
                      value: bestRunsPerMatch?.runsPerMatch?.toFixed(1) || "0.0",
                      unit: "runs/match",
                    },
                  ]}
                />
              ) : publicLeadersTab === "bowling" ? (
                <LeaderShowcase
                  accent="bowling"
                  hero={{
                    eyebrow: "Purple cap",
                    icon: "🎯",
                    label: "Wicket hunter",
                    row: topWicketTaker,
                    value: `${topWicketTaker?.wickets || 0}`,
                    unit: "wickets",
                    detail: topWicketTaker
                      ? `${topWicketTaker.overs} overs · ${topWicketTaker.economy} economy`
                      : "",
                  }}
                  cards={[
                    {
                      icon: "🔒",
                      label: "Run stopper",
                      hint: "Best economy · min 1 over",
                      row: bestEconomy,
                      value: bestEconomy?.economy || "0.00",
                      unit: "economy",
                    },
                    {
                      icon: "⚪",
                      label: "Dot-ball king",
                      hint: "Most dot balls",
                      row: topDotBowler,
                      value: topDotBowler?.dots || 0,
                      unit: "dots",
                    },
                    {
                      icon: "💥",
                      label: "Strike threat",
                      hint: "Fewest balls per wicket",
                      row: bestBowlingStrikeRate,
                      value: bestBowlingStrikeRate?.bowlingStrikeRate?.toFixed(1) || "0.0",
                      unit: "balls/wkt",
                    },
                    {
                      icon: "💪",
                      label: "Workhorse",
                      hint: "Most legal deliveries",
                      row: bowlingWorkhorse,
                      value: bowlingWorkhorse?.overs || "0.0",
                      unit: "overs",
                    },
                  ]}
                />
              ) : publicLeadersTab === "fielding" ? (
                topFielder ? (
                  <LeaderShowcase
                    accent="fielding"
                    hero={{
                      eyebrow: "Fielding crown",
                      icon: "🧤",
                      label: "Fielding MVP",
                      row: topFielder,
                      value: `${topFielder.fieldingTotal || 0}`,
                      unit: "contributions",
                      detail:
                        `${topFielder.catches || 0} catches · ` +
                        `${topFielder.runOuts || 0} run-outs · ` +
                        `${topFielder.stumpings || 0} stumpings · ` +
                        `${topFielder.assists || 0} assists`,
                    }}
                    cards={[
                      {
                        icon: "🤲",
                        label: "Safe hands",
                        hint: "Most catches",
                        row: safestHands,
                        value: safestHands?.catches || 0,
                        unit: "catches",
                      },
                      {
                        icon: "🎯",
                        label: "Run-out specialist",
                        hint: "Most direct run-outs",
                        row: runOutSpecialist,
                        value: runOutSpecialist?.runOuts || 0,
                        unit: "run-outs",
                      },
                      {
                        icon: "🤝",
                        label: "Assist king",
                        hint: "Most run-out assists",
                        row: assistLeader,
                        value: assistLeader?.assists || 0,
                        unit: "assists",
                      },
                      {
                        icon: "⚡",
                        label: "Glove work",
                        hint: "Most stumpings",
                        row: stumpingLeader,
                        value: stumpingLeader?.stumpings || 0,
                        unit: "stumpings",
                      },
                    ]}
                  />
                ) : (
                  <EmptyState
                    title="No fielding leaders yet"
                    message="Catches, run-outs, assists and stumpings will appear after qualifying completed matches."
                  />
                )
              ) : topImpactPlayer ? (
                <LeaderShowcase
                  accent="allround"
                  hero={{
                    eyebrow: "Impact crown",
                    icon: "🌟",
                    label: "Impact player",
                    row: topImpactPlayer,
                    value: `${topImpactPlayer.allRounderPoints || 0}`,
                    unit: "impact pts",
                    detail:
                      `${topImpactPlayer.runs || 0} runs · ` +
                      `${topImpactPlayer.wickets || 0} wickets · ` +
                      `${topImpactPlayer.fieldingTotal || 0} fielding`,
                  }}
                  cards={[
                    {
                      icon: "⚔️",
                      label: "Balanced force",
                      hint: "Runs + wickets impact",
                      row: balancedForce,
                      value: balancedForce
                        ? `${balancedForce.runs}R · ${balancedForce.wickets}W`
                        : "—",
                      unit: "two-way",
                    },
                    {
                      icon: "🧩",
                      label: "Three-dimensional",
                      hint: "Batting + bowling + fielding",
                      row: threeDimensionalPlayer,
                      value: threeDimensionalPlayer?.allRounderPoints || 0,
                      unit: "impact pts",
                    },
                    {
                      icon: "📊",
                      label: "Impact rate",
                      hint: "Best impact per match · min 2",
                      row: bestImpactPerMatch,
                      value: bestImpactPerMatch?.impactPerMatch?.toFixed(1) || "0.0",
                      unit: "pts/match",
                    },
                    {
                      icon: "💎",
                      label: "Complete package",
                      hint: "Contributing disciplines",
                      row: completePackage,
                      value: completePackage?.disciplines || 0,
                      unit: "disciplines",
                    },
                  ]}
                />
              ) : (
                <EmptyState
                  title="No all-round leaders yet"
                  message="All-round impact appears after players contribute across qualifying completed matches."
                />
              )}

              <p className="slp-leader-footnote">
                Leaders use completed matches in the selected season and series.
                All-Round impact follows Cric4All's existing weighting: runs +
                25 per wicket + 10 per catch/run-out/stumping + 5 per assist.
                Qualification minimums are shown where applicable.
              </p>
            </section>
          )}

          {activeTab === "pulse" && (
            <section className="slp-section">
              <SectionHeader
                eyebrow="Player intelligence"
                title="Player Pulse"
                description={`${playerPerformanceCenter.playerCount} players · ${playerPerformanceCenter.completedMatches} completed match${playerPerformanceCenter.completedMatches === 1 ? "" : "es"} in this view`}
              />

              <SegmentedControl
                value={publicPulseTab}
                onChange={setPublicPulseTab}
                items={[
                  ["rankings", "Rankings", null],
                  ["form", "Form", null],
                  ["streaks", "Streaks", null],
                  ["achievements", "Achievements", null],
                  ["progress", "Progress", null],
                  ["team", "Team of Week", null],
                ]}
              />

              {publicPulseTab === "rankings" ? (
                <PlayerPulseRankings
                  rankings={playerPerformanceCenter.rankings}
                  category={publicRankingCategory}
                  onCategoryChange={setPublicRankingCategory}
                />
              ) : publicPulseTab === "form" ? (
                <PlayerFormCenter
                  rows={playerPerformanceCenter.form}
                  search={publicFormSearch}
                  onSearchChange={setPublicFormSearch}
                />
              ) : publicPulseTab === "streaks" ? (
                <PlayerStreakCenter
                  rows={playerPerformanceCenter.streaks}
                />
              ) : publicPulseTab === "achievements" ? (
                <PlayerAchievementCenter
                  rows={playerPerformanceCenter.achievements}
                  search={publicPulsePlayerSearch}
                  onSearchChange={setPublicPulsePlayerSearch}
                />
              ) : publicPulseTab === "progress" ? (
                <PlayerProgressCenter
                  rows={playerPerformanceCenter.progress}
                  search={publicPulsePlayerSearch}
                  onSearchChange={setPublicPulsePlayerSearch}
                  scopeLabel={
                    selectedSeriesId
                      ? "Selected series"
                      : selectedYear
                        ? `Season ${selectedYear}`
                        : "Current league view"
                  }
                />
              ) : (
                <TeamOfWeekCenter
                  data={playerPerformanceCenter.teamOfWeek}
                />
              )}

              <div className="slp-pulse-note">
                <span aria-hidden="true">🧠</span>
                <p>
                  <strong>One performance engine</strong>
                  Rankings, form, streaks, achievements, progress and Team
                  of the Week all use the same completed-match ball data and
                  existing Cric4All player exclusions. Ranking movement
                  compares the current table with the table before the most
                  recent completed match.
                </p>
              </div>
            </section>
          )}

          {activeTab === "records" && (
            <section className="slp-section">
              <SectionHeader
                eyebrow="History book"
                title="League Records"
                description={`${leagueRecords.recordCount} records from ${leagueRecords.completedMatches} completed match${leagueRecords.completedMatches === 1 ? "" : "es"} in this view`}
              />

              <div className="slp-records-toolbar">
                <SegmentedControl
                  value={publicRecordsTab}
                  onChange={setPublicRecordsTab}
                  items={[
                    ["all", "All", leagueRecords.records.length],
                    [
                      "player",
                      "Player",
                      leagueRecords.records.filter(
                        (record) => record.category === "Player"
                      ).length,
                    ],
                    [
                      "partnership",
                      "Partnership",
                      leagueRecords.records.filter(
                        (record) => record.category === "Partnership"
                      ).length,
                    ],
                    [
                      "team",
                      "Team",
                      leagueRecords.records.filter(
                        (record) => record.category === "Team"
                      ).length,
                    ],
                    [
                      "match",
                      "Match",
                      leagueRecords.records.filter(
                        (record) => record.category === "Match"
                      ).length,
                    ],
                  ]}
                />

                <span className="slp-records-scope">
                  {selectedSeriesId
                    ? "Series records"
                    : selectedYear
                      ? `Season ${selectedYear}`
                      : "All-time league records"}
                </span>
              </div>

              {visibleRecords.length === 0 ? (
                <EmptyState
                  title="No qualifying records yet"
                  message="Records appear from completed scored matches in the selected season or series."
                />
              ) : (
                <>
                  <div className="slp-record-hero-grid">
                    {visibleRecords.slice(0, 2).map((record, index) => (
                      <RecordCard
                        key={record.id}
                        record={record}
                        featured
                        rank={index + 1}
                      />
                    ))}
                  </div>

                  {visibleRecords.length > 2 ? (
                    <div className="slp-record-grid">
                      {visibleRecords.slice(2).map((record, index) => (
                        <RecordCard
                          key={record.id}
                          record={record}
                          rank={index + 3}
                        />
                      ))}
                    </div>
                  ) : null}
                </>
              )}

              <div className="slp-records-note">
                <span aria-hidden="true">📚</span>
                <p>
                  <strong>How records work</strong>
                  Records use only completed, completed locked and completed
                  corrected matches in the current Season/Series filter.
                  Abandoned matches and excluded analytics players do not
                  contribute.
                </p>
              </div>
            </section>
          )}

          {activeTab === "milestones" && (
            <section className="slp-section">
              <SectionHeader
                eyebrow="Career landmarks"
                title="Milestone Center"
                description={`${leagueMilestones.playerCount} players · ${leagueMilestones.completedMatches} completed match${leagueMilestones.completedMatches === 1 ? "" : "es"} in this view`}
              />

              <div className="slp-milestones-summary">
                <div>
                  <span>🏏</span>
                  <small>Run milestones</small>
                  <strong>{leagueMilestones.achievedByMetric.runs || 0}</strong>
                </div>

                <div>
                  <span>🎯</span>
                  <small>Wicket milestones</small>
                  <strong>{leagueMilestones.achievedByMetric.wickets || 0}</strong>
                </div>

                <div>
                  <span>🧤</span>
                  <small>Fielding milestones</small>
                  <strong>{leagueMilestones.achievedByMetric.fielding || 0}</strong>
                </div>

                <div>
                  <span>🎽</span>
                  <small>Appearance milestones</small>
                  <strong>{leagueMilestones.achievedByMetric.appearances || 0}</strong>
                </div>
              </div>

              <div className="slp-milestones-tabs">
                <SegmentedControl
                  value={publicMilestonesTab}
                  onChange={setPublicMilestonesTab}
                  items={[
                    [
                      "recent",
                      "Recently achieved",
                      leagueMilestones.recentAchievements.length,
                    ],
                    [
                      "next",
                      "Next up",
                      leagueMilestones.nextUp.length,
                    ],
                  ]}
                />

                <span className="slp-milestones-scope">
                  {selectedSeriesId
                    ? "Series milestones"
                    : selectedYear
                      ? `Season ${selectedYear}`
                      : "All-time career milestones"}
                </span>
              </div>

              {publicMilestonesTab === "recent" ? (
                leagueMilestones.recentAchievements.length ? (
                  <div className="slp-milestone-achievements">
                    {leagueMilestones.recentAchievements.map(
                      (milestone, index) => (
                        <MilestoneAchievementCard
                          key={milestone.id}
                          milestone={milestone}
                          featured={index < 2}
                        />
                      )
                    )}
                  </div>
                ) : (
                  <EmptyState
                    title="No milestones reached yet"
                    message="Career milestones appear automatically as players cross runs, wickets, fielding and appearance landmarks."
                  />
                )
              ) : leagueMilestones.nextUp.length ? (
                <div className="slp-milestone-next-grid">
                  {leagueMilestones.nextUp.map((milestone) => (
                    <MilestoneProgressCard
                      key={milestone.id}
                      milestone={milestone}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No upcoming milestones yet"
                  message="Players will appear here as they move closer to their next career landmark."
                />
              )}

              <div className="slp-milestones-note">
                <span aria-hidden="true">✨</span>
                <p>
                  <strong>Automatic Cric4All milestones</strong>
                  Runs, bowler-credited wickets, recorded fielding
                  contributions and scored match appearances are counted from
                  completed matches only. Abandoned matches and excluded
                  analytics players do not contribute.
                </p>
              </div>
            </section>
          )}

          {activeTab === "rivalries" && (
            <section className="slp-section">
              <SectionHeader
                eyebrow="Head-to-head history"
                title="Team Rivalry Center"
                description={`${teamRivalries.rivalryCount} rivalry matchup${teamRivalries.rivalryCount === 1 ? "" : "s"} · ${teamRivalries.completedMatches} completed match${teamRivalries.completedMatches === 1 ? "" : "es"} in this view`}
              />

              {teamRivalries.rivalries.length ? (
                <>
                  <div className="slp-rivalry-toolbar">
                    <label>
                      <span>Rivalry matchup</span>
                      <select
                        value={
                          publicRivalryKey ||
                          selectedRivalry?.key ||
                          ""
                        }
                        onChange={(event) =>
                          setPublicRivalryKey(event.target.value)
                        }
                      >
                        {teamRivalries.rivalries.map((rivalry) => (
                          <option
                            key={rivalry.key}
                            value={rivalry.key}
                          >
                            {rivalry.teamA.teamName} vs {rivalry.teamB.teamName}
                            {" · "}
                            {rivalry.meetings} meeting{rivalry.meetings === 1 ? "" : "s"}
                          </option>
                        ))}
                      </select>
                    </label>

                    <span className="slp-rivalry-scope">
                      {selectedSeriesId
                        ? "Series rivalry"
                        : selectedYear
                          ? `Season ${selectedYear}`
                          : "All-time rivalry"}
                    </span>
                  </div>

                  {selectedRivalry ? (
                    <TeamRivalryCenter
                      rivalry={selectedRivalry}
                    />
                  ) : null}
                </>
              ) : (
                <EmptyState
                  title="No rivalry history yet"
                  message="The Rivalry Center appears after two teams have at least one qualifying completed meeting in the selected Season/Series view."
                />
              )}

              <div className="slp-rivalry-note">
                <span aria-hidden="true">⚔️</span>
                <p>
                  <strong>Completed meetings only</strong>
                  Head-to-head player leaders use the same Cric4All analytics
                  exclusions as Stats and Player Pulse. Bowler wickets exclude
                  run-outs, retired dismissals and no-ball wickets. Where an
                  official result string is unavailable, Cric4All uses the
                  recorded innings totals and labels the difference as a score
                  gap rather than inventing a formal victory margin.
                </p>
              </div>
            </section>
          )}

          {activeTab === "dna" && (
            <section className="slp-section">
              <SectionHeader
                eyebrow="Team intelligence"
                title="Team DNA"
                description={`${teamDNA.activeTeamCount} active teams · ${teamDNA.completedMatches} completed match${teamDNA.completedMatches === 1 ? "" : "es"} in this view`}
              />

              <div className="slp-dna-toolbar">
                <label>
                  <span>Team</span>
                  <select
                    value={publicDnaTeamId}
                    onChange={(event) =>
                      setPublicDnaTeamId(event.target.value)
                    }
                  >
                    <option value="all">All teams</option>
                    {teamDNA.teams.map((team) => (
                      <option
                        key={team.teamId}
                        value={team.teamId}
                      >
                        {team.teamName}
                      </option>
                    ))}
                  </select>
                </label>

                <span className="slp-dna-scope">
                  {selectedSeriesId
                    ? "Series DNA"
                    : selectedYear
                      ? `Season ${selectedYear}`
                      : "All-time team profile"}
                </span>
              </div>

              {visibleTeamDNA.length ? (
                <div className="slp-dna-grid">
                  {visibleTeamDNA.map((team, index) => (
                    <TeamDnaCard
                      key={team.teamId}
                      team={team}
                      featured={
                        publicDnaTeamId !== "all" || index === 0
                      }
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No Team DNA yet"
                  message="Team DNA appears after completed scored matches provide enough batting, bowling and match-result evidence."
                />
              )}

              <div className="slp-dna-league-baseline">
                <div>
                  <span>📊</span>
                  <p>
                    <small>League batting tempo</small>
                    <strong>
                      {teamDNA.leagueAverages.battingRunRate.toFixed(2)}
                    </strong>
                    <em>runs/over</em>
                  </p>
                </div>

                <div>
                  <span>🎯</span>
                  <p>
                    <small>League bowling economy</small>
                    <strong>
                      {teamDNA.leagueAverages.bowlingEconomy.toFixed(2)}
                    </strong>
                    <em>runs/over</em>
                  </p>
                </div>

                <div>
                  <span>⚪</span>
                  <p>
                    <small>League dot-ball rate</small>
                    <strong>
                      {teamDNA.leagueAverages.dotBallPct.toFixed(0)}%
                    </strong>
                    <em>legal balls</em>
                  </p>
                </div>

                <div>
                  <span>🚀</span>
                  <p>
                    <small>League boundary reliance</small>
                    <strong>
                      {teamDNA.leagueAverages.boundaryRunPct.toFixed(0)}%
                    </strong>
                    <em>runs from 4s/6s</em>
                  </p>
                </div>
              </div>

              <div className="slp-dna-note">
                <span aria-hidden="true">🧬</span>
                <p>
                  <strong>Evidence-based profile</strong>
                  DNA labels compare each team with league averages from the
                  same Season/Series filter. They are descriptive cricket
                  signals, not predictions or manually assigned ratings.
                </p>
              </div>
            </section>
          )}

          {activeTab === "digest" && (
            <section className="slp-section">
              <SectionHeader
                eyebrow="This week in Cric4All"
                title="7-Day League Digest"
                description={`A compact league recap for ${weeklyDigest.rangeLabel}`}
              />

              {digestNotice ? (
                <div className="slp-digest-notice">
                  {digestNotice}
                </div>
              ) : null}

              <div className="slp-digest-hero">
                <div>
                  <span>📅 {weeklyDigest.rangeLabel}</span>
                  <h3>
                    {weeklyDigest.completedCount
                      ? `${weeklyDigest.completedCount} completed match${weeklyDigest.completedCount === 1 ? "" : "es"} in the last 7 days`
                      : "A quiet seven days — no completed matches"}
                  </h3>
                  <p>
                    The digest uses only completed-match scoring data for
                    weekly performances, with current standings and the next
                    scheduled fixture added as league context.
                  </p>
                </div>

                <div className="slp-digest-actions">
                  <button
                    type="button"
                    disabled={Boolean(digestBusyAction)}
                    onClick={() =>
                      handleDigestAction("copy")
                    }
                  >
                    {digestBusyAction === "copy"
                      ? "Copying…"
                      : "📋 Copy digest"}
                  </button>

                  <button
                    type="button"
                    className="is-primary"
                    disabled={Boolean(digestBusyAction)}
                    onClick={() =>
                      handleDigestAction("share")
                    }
                  >
                    {digestBusyAction === "share"
                      ? "Opening…"
                      : "📤 Share digest"}
                  </button>
                </div>
              </div>

              <div className="slp-digest-metrics">
                <DigestMetric
                  icon="🥇"
                  label="Table leader"
                  value={
                    weeklyDigest.tableLeader?.teamName ||
                    "No table yet"
                  }
                  detail={
                    weeklyDigest.tableLeader
                      ? `${weeklyDigest.tableLeader.played || 0} played · ${weeklyDigest.tableLeader.points || 0} pts`
                      : "Standings will appear after results"
                  }
                />

                <DigestMetric
                  icon="🏏"
                  label="Top batter"
                  value={
                    weeklyDigest.topBatter?.playerName ||
                    "No weekly leader"
                  }
                  detail={
                    weeklyDigest.topBatter
                      ? `${weeklyDigest.topBatter.runs} runs · SR ${weeklyDigest.topBatter.strikeRate.toFixed(1)}`
                      : "No completed batting performance this week"
                  }
                />

                <DigestMetric
                  icon="🎯"
                  label="Top bowler"
                  value={
                    weeklyDigest.topBowler?.playerName ||
                    "No weekly leader"
                  }
                  detail={
                    weeklyDigest.topBowler
                      ? `${weeklyDigest.topBowler.wickets} wickets · Econ ${weeklyDigest.topBowler.economy.toFixed(2)}`
                      : "No bowler-credited wickets this week"
                  }
                />

                <DigestMetric
                  icon="🌟"
                  label="Performance of the week"
                  value={
                    weeklyDigest.performanceOfWeek?.playerName ||
                    "No standout yet"
                  }
                  detail={
                    weeklyDigest.performanceOfWeek
                      ? `${weeklyDigest.performanceOfWeek.impact} impact pts · ${weeklyDigest.performanceOfWeek.runs}R · ${weeklyDigest.performanceOfWeek.wickets}W · ${weeklyDigest.performanceOfWeek.fielding} fielding`
                      : "Calculated after completed weekly performances"
                  }
                />
              </div>

              <div className="slp-digest-detail-grid">
                <article className="slp-digest-panel">
                  <div className="slp-digest-panel-head">
                    <div>
                      <small>Scoreboard</small>
                      <strong>Results this week</strong>
                    </div>
                    <span>{weeklyDigest.completedCount}</span>
                  </div>

                  {weeklyDigest.matchResults.length ? (
                    <div className="slp-digest-results">
                      {weeklyDigest.matchResults.map((result) => (
                        result.href ? (
                          <a
                            key={result.matchId}
                            href={result.href}
                          >
                            <span>{result.dateLabel}</span>
                            <strong>{result.label}</strong>
                            <p>{result.result}</p>
                          </a>
                        ) : (
                          <div key={result.matchId}>
                            <span>{result.dateLabel}</span>
                            <strong>{result.label}</strong>
                            <p>{result.result}</p>
                          </div>
                        )
                      ))}
                    </div>
                  ) : (
                    <p className="slp-digest-empty">
                      No completed matches in the rolling seven-day window.
                    </p>
                  )}
                </article>

                <article className="slp-digest-panel">
                  <div className="slp-digest-panel-head">
                    <div>
                      <small>League moments</small>
                      <strong>Worth sharing</strong>
                    </div>
                    <span>✨</span>
                  </div>

                  <div className="slp-digest-moments">
                    <DigestMoment
                      icon="🏅"
                      label="Newest milestone"
                      title={
                        weeklyDigest.milestoneThisWeek
                          ? `${weeklyDigest.milestoneThisWeek.playerName} · ${weeklyDigest.milestoneThisWeek.title}`
                          : "No milestone reached this week"
                      }
                      detail={
                        weeklyDigest.milestoneThisWeek?.matchLabel ||
                        "Milestones will appear automatically when crossed."
                      }
                    />

                    <DigestMoment
                      icon="📚"
                      label="Record-book spotlight"
                      title={
                        weeklyDigest.recordSpotlight
                          ? `${weeklyDigest.recordSpotlight.title} · ${weeklyDigest.recordSpotlight.value}`
                          : "No league record yet"
                      }
                      detail={
                        weeklyDigest.recordSpotlight
                          ? `${weeklyDigest.recordSpotlight.holder}${weeklyDigest.recordSpotlight.teamName ? ` · ${weeklyDigest.recordSpotlight.teamName}` : ""}`
                          : "Records appear after qualifying completed matches."
                      }
                    />

                    <DigestMoment
                      icon="📍"
                      label="Coming next"
                      title={
                        weeklyDigest.upcoming?.label ||
                        "No upcoming fixture scheduled"
                      }
                      detail={
                        weeklyDigest.upcoming
                          ? `${weeklyDigest.upcoming.dateLabel} · ${weeklyDigest.upcoming.venue}`
                          : "Create the next match to add it to the digest."
                      }
                      href={weeklyDigest.upcoming?.href}
                    />
                  </div>
                </article>
              </div>

              <div className="slp-digest-preview">
                <div>
                  <span>💬</span>
                  <p>
                    <small>Share-ready text</small>
                    <strong>Exactly what gets copied or shared</strong>
                  </p>
                </div>

                <pre>{weeklyDigest.text}</pre>
              </div>

              <div className="slp-digest-note">
                <span aria-hidden="true">🛡️</span>
                <p>
                  <strong>No duplicate stats engine</strong>
                  Weekly performance numbers are calculated directly from the
                  same completed ball-by-ball match data and follow the
                  existing Cric4All analytics exclusions. Run-outs and retired
                  dismissals are not credited as bowler wickets.
                </p>
              </div>
            </section>
          )}

          {activeTab === "share" && (
            <section className="slp-section">
              <SectionHeader
                eyebrow="Share Cric4All"
                title="Share Cards"
                description="Turn league performances into polished square cards for WhatsApp, Messages and social sharing."
              />

              {shareCardNotice ? (
                <div className="slp-share-notice">
                  {shareCardNotice}
                </div>
              ) : null}

              {shareCards.length ? (
                <div className="slp-share-card-grid">
                  {shareCards.map((card) => (
                    <ShareCardPreview
                      key={card.id}
                      card={card}
                      busy={shareCardBusyId === card.id}
                      onShare={handleShareCard}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No share cards yet"
                  message="Share cards appear automatically after qualifying leaders, records or milestones exist."
                />
              )}

              <div className="slp-share-note">
                <span aria-hidden="true">📲</span>
                <p>
                  <strong>Ready for phones and laptops</strong>
                  Supported phones open the native Share sheet with a
                  1080×1080 PNG. Browsers without file sharing save the PNG
                  instead and copy the Cric4All caption when clipboard access
                  is allowed.
                </p>
              </div>
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

function PlayerPulseRankings({
  rankings,
  category,
  onCategoryChange,
}) {
  const rows = rankings?.[category] || [];

  return (
    <div className="slp-pulse-block">
      <div className="slp-pulse-toolbar">
        <SegmentedControl
          value={category}
          onChange={onCategoryChange}
          items={[
            ["overall", "Overall", null],
            ["batting", "Batting", null],
            ["bowling", "Bowling", null],
            ["fielding", "Fielding", null],
          ]}
        />
        <span>Rank movement updates after every completed match</span>
      </div>

      {rows.length ? (
        <div className="slp-ranking-list">
          {rows.slice(0, 12).map((row) => (
            <article className="slp-ranking-row" key={`${category}-${row.key}`}>
              <span className="slp-ranking-number">#{row.rank}</span>
              <span className="slp-ranking-avatar">{getInitials(row.playerName)}</span>
              <div className="slp-ranking-player">
                <strong>{row.playerName}</strong>
                <small>{row.teamName || "League player"}</small>
              </div>
              <div className="slp-ranking-points">
                <strong>{Math.round(row.rankingPoints)}</strong>
                <small>ranking pts</small>
              </div>
              <div className={`slp-ranking-move ${row.movement > 0 ? "is-up" : row.movement < 0 ? "is-down" : "is-flat"}`}>
                <strong>
                  {row.movement === null
                    ? "NEW"
                    : row.movement > 0
                      ? `↑${row.movement}`
                      : row.movement < 0
                        ? `↓${Math.abs(row.movement)}`
                        : "—"}
                </strong>
                <small>best #{row.careerBestRank}</small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No qualifying ranking yet"
          message="Rankings appear once completed-match performances exist for this category."
        />
      )}
    </div>
  );
}

function PlayerFormCenter({
  rows,
  search,
  onSearchChange,
}) {
  const normalizedSearch = String(search || "")
    .trim()
    .toLowerCase();

  const visibleRows = (rows || []).filter((row) => {
    if (!normalizedSearch) return true;

    return [
      row.playerName,
      row.teamName,
    ].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  });

  if (!rows?.length) {
    return (
      <EmptyState
        title="No recent player form yet"
        message="Form appears after completed scoring performances are available."
      />
    );
  }

  return (
    <div className="slp-form-center">
      <div className="slp-form-toolbar">
        <label>
          <span>Find player</span>
          <input
            type="search"
            value={search}
            onChange={(event) =>
              onSearchChange(event.target.value)
            }
            placeholder="Search player or team"
          />
        </label>

        <span className="slp-form-count">
          {visibleRows.length} of {rows.length} qualifying players
        </span>
      </div>

      {visibleRows.length ? (
        <div className="slp-form-grid">
          {visibleRows.map((row) => (
            <article className="slp-form-card" key={row.key}>
              <div className="slp-form-card-head">
                <span>{getInitials(row.playerName)}</span>
                <div>
                  <strong>{row.playerName}</strong>
                  <small>{row.teamName || "League player"}</small>
                </div>
                <em className={`is-${row.trend.toLowerCase()}`}>
                  {row.trend}
                </em>
              </div>

              <div className="slp-form-balls">
                {row.lastFive.map((match) => (
                  <div
                    key={`${row.key}-${match.matchId}`}
                    title={match.matchLabel}
                  >
                    <strong>{match.runs}R</strong>
                    <span>
                      {match.wickets}W · {match.fieldingTotal}F
                    </span>
                  </div>
                ))}
              </div>

              <div className="slp-form-summary">
                <span>
                  <small>Last 5 runs</small>
                  <strong>{row.lastFiveRuns}</strong>
                </span>
                <span>
                  <small>Last 5 wickets</small>
                  <strong>{row.lastFiveWickets}</strong>
                </span>
                <span>
                  <small>Form score</small>
                  <strong>{row.formScore.toFixed(1)}</strong>
                </span>
              </div>

              {row.best ? (
                <p>
                  <strong>Best recent:</strong>{" "}
                  {row.best.runs}R · {row.best.wickets}W ·{" "}
                  {row.best.fieldingTotal}F
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No matching player"
          message="Try another player or team name. All qualifying players remain available in Form."
        />
      )}
    </div>
  );
}

function PlayerStreakCenter({ rows }) {
  return rows?.length ? (
    <div className="slp-streak-grid">
      {rows.map((row) => (
        <article className="slp-streak-card" key={row.id}>
          <span className="slp-streak-icon">{row.icon}</span>
          <div>
            <small>{row.type}</small>
            <strong>{row.playerName}</strong>
            <em>{row.teamName || "League player"}</em>
            {row.description ? (
              <span className="slp-streak-explainer">
                {row.description}
              </span>
            ) : null}
          </div>
          <div className="slp-streak-count">
            <strong>{row.current}</strong>
            <span>current</span>
          </div>
          <p>
            Career best: <strong>{row.best}</strong>
          </p>
        </article>
      ))}
    </div>
  ) : (
    <EmptyState
      title="No active streaks yet"
      message="Current batting and wicket-taking streaks appear as players build consecutive qualifying performances."
    />
  );
}

function PlayerPulseSearch({
  search,
  onSearchChange,
  count,
  total,
  placeholder = "Search player or team",
}) {
  return (
    <div className="slp-pulse-player-search">
      <label>
        <span>Find player</span>
        <input
          type="search"
          value={search}
          onChange={(event) =>
            onSearchChange(event.target.value)
          }
          placeholder={placeholder}
        />
      </label>

      <span>
        {count} of {total} players
      </span>
    </div>
  );
}

function PlayerAchievementCenter({
  rows,
  search,
  onSearchChange,
}) {
  const normalized = String(search || "")
    .trim()
    .toLowerCase();

  const visible = (rows || []).filter((row) => {
    if (!normalized) return true;

    return [
      row.playerName,
      row.teamName,
      ...(row.badges || []).map((badge) => badge.title),
    ].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(normalized)
    );
  });

  if (!rows?.length) {
    return (
      <EmptyState
        title="No achievements earned yet"
        message="Badges appear automatically as players reach qualifying batting, bowling, fielding, all-round and appearance achievements."
      />
    );
  }

  return (
    <div className="slp-achievement-center">
      <PlayerPulseSearch
        search={search}
        onSearchChange={onSearchChange}
        count={visible.length}
        total={rows.length}
      />

      {visible.length ? (
        <div className="slp-achievement-grid">
          {visible.map((row) => (
            <article
              className="slp-achievement-player"
              key={row.key}
            >
              <div className="slp-achievement-player-head">
                <span>
                  {getInitials(row.playerName)}
                </span>

                <div>
                  <strong>{row.playerName}</strong>
                  <small>
                    {row.teamName || "League player"}
                  </small>
                </div>

                <em>
                  {row.badgeCount} badge
                  {row.badgeCount === 1 ? "" : "s"}
                </em>
              </div>

              {row.headline ? (
                <div
                  className={`slp-achievement-headline is-${row.headline.tier}`}
                >
                  <span>{row.headline.icon}</span>
                  <p>
                    <small>Featured achievement</small>
                    <strong>{row.headline.title}</strong>
                    <em>{row.headline.description}</em>
                  </p>
                </div>
              ) : null}

              <div className="slp-achievement-badges">
                {row.badges.map((badge) => (
                  <div
                    className={`slp-achievement-badge is-${badge.tier}`}
                    key={`${row.key}-${badge.id}`}
                    title={badge.description}
                  >
                    <span>{badge.icon}</span>
                    <p>
                      <strong>{badge.title}</strong>
                      <small>{badge.category}</small>
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No matching achievement"
          message="Search by player, team or badge name."
        />
      )}
    </div>
  );
}

function PlayerProgressCenter({
  rows,
  search,
  onSearchChange,
  scopeLabel,
}) {
  const normalized = String(search || "")
    .trim()
    .toLowerCase();

  const visible = (rows || []).filter((row) => {
    if (!normalized) return true;

    return [
      row.playerName,
      row.teamName,
    ].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(normalized)
    );
  });

  if (!rows?.length) {
    return (
      <EmptyState
        title="No player progress yet"
        message="Progress appears once completed-match performances exist in this league view."
      />
    );
  }

  return (
    <div className="slp-progress-center">
      <div className="slp-progress-toolbar">
        <PlayerPulseSearch
          search={search}
          onSearchChange={onSearchChange}
          count={visible.length}
          total={rows.length}
        />

        <span className="slp-progress-scope">
          {scopeLabel}
        </span>
      </div>

      {visible.length ? (
        <div className="slp-progress-grid">
          {visible.map((row) => (
            <article
              className="slp-progress-card"
              key={row.key}
            >
              <div className="slp-progress-card-head">
                <span>
                  {getInitials(row.playerName)}
                </span>

                <div>
                  <strong>{row.playerName}</strong>
                  <small>
                    {row.teamName || "League player"}
                  </small>
                </div>

                {row.nearest ? (
                  <em>
                    {Math.round(row.nearest.progress)}%
                    {" "}
                    to next
                  </em>
                ) : (
                  <em>All listed landmarks reached</em>
                )}
              </div>

              <div className="slp-progress-current">
                <span>
                  <small>Runs</small>
                  <strong>{row.runs}</strong>
                </span>
                <span>
                  <small>Wickets</small>
                  <strong>{row.wickets}</strong>
                </span>
                <span>
                  <small>Fielding</small>
                  <strong>{row.fielding}</strong>
                </span>
                <span>
                  <small>Appearances</small>
                  <strong>{row.matches}</strong>
                </span>
              </div>

              <div className="slp-progress-metrics">
                {row.metrics.map((metric) => (
                  <div
                    className="slp-progress-metric"
                    key={`${row.key}-${metric.metric}`}
                  >
                    <div>
                      <span>{metric.icon}</span>
                      <p>
                        <small>{metric.label}</small>
                        <strong>
                          {metric.complete
                            ? `${metric.current}`
                            : `${metric.current} / ${metric.target}`}
                        </strong>
                      </p>

                      <em>
                        {metric.complete
                          ? "Landmark ladder complete"
                          : `${metric.remaining} to next`}
                      </em>
                    </div>

                    <div className="slp-progress-track">
                      <span
                        style={{
                          width: `${Math.max(
                            3,
                            metric.progress
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {row.nearest ? (
                <p className="slp-progress-next">
                  <strong>Closest landmark:</strong>{" "}
                  {row.nearest.remaining}{" "}
                  {row.nearest.metric} to{" "}
                  {row.nearest.target}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No matching player"
          message="Try another player or team name."
        />
      )}
    </div>
  );
}

function TeamOfWeekCenter({ data }) {
  const lineup = data?.lineup || [];

  return (
    <div className="slp-team-week-shell">
      <div className="slp-team-week-head">
        <div>
          <small>Recent seven-day competition window</small>
          <strong>Cric4All XI of the Week</strong>
          <span>{data?.windowLabel || "No completed match window"}</span>
        </div>
        <span>⭐ {lineup.length} selected</span>
      </div>

      {lineup.length ? (
        <div className="slp-team-week-grid">
          {lineup.map((player, index) => (
            <article className="slp-team-week-player" key={player.key}>
              <span className="slp-team-week-no">{String(index + 1).padStart(2, "0")}</span>
              <span className="slp-team-week-avatar">{getInitials(player.playerName)}</span>
              <div>
                <strong>
                  {player.playerName}
                  {player.captain ? " (C)" : ""}
                  {player.wicketkeeper ? " (WK)" : ""}
                </strong>
                <small>{player.teamName || "League player"} · {player.role}</small>
              </div>
              <div className="slp-team-week-stats">
                <strong>{player.runs}R · {player.wickets}W</strong>
                <span>{player.fieldingTotal} fielding · {Math.round(player.selectionScore)} pts</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No Team of the Week yet"
          message="The XI is selected from the most recent seven-day window containing completed scored matches."
        />
      )}
    </div>
  );
}

function DigestMetric({
  icon,
  label,
  value,
  detail,
}) {
  return (
    <article className="slp-digest-metric">
      <span aria-hidden="true">{icon}</span>

      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
    </article>
  );
}

function DigestMoment({
  icon,
  label,
  title,
  detail,
  href,
}) {
  const content = (
    <>
      <span aria-hidden="true">{icon}</span>

      <p>
        <small>{label}</small>
        <strong>{title}</strong>
        <em>{detail}</em>
      </p>
    </>
  );

  return href ? (
    <a
      className="slp-digest-moment"
      href={href}
    >
      {content}
    </a>
  ) : (
    <div className="slp-digest-moment">
      {content}
    </div>
  );
}

function ShareCardPreview({
  card,
  busy,
  onShare,
}) {
  return (
    <article
      className={`slp-share-card slp-share-card--${card.accent}`}
    >
      <div className="slp-share-card-brand">
        <strong>🏏 Cric4All</strong>
        <span>{card.scope}</span>
      </div>

      <div className="slp-share-card-body">
        <small>
          {card.icon} {card.eyebrow}
        </small>

        <h3>{card.title}</h3>

        <div className="slp-share-card-player">
          <strong>{card.name}</strong>
          {card.team ? (
            <span>{card.team}</span>
          ) : null}
        </div>

        <div className="slp-share-card-value">
          {card.value}
        </div>

        <p>{card.detail}</p>
      </div>

      <div className="slp-share-card-footer">
        <span>{card.leagueName}</span>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onShare(card)
          }
        >
          {busy
            ? "Generating…"
            : "📤 Share card"}
        </button>
      </div>
    </article>
  );
}

function PreviewForm({
  form = [],
}) {
  return (
    <div className="slp-preview-form">
      {form.length ? (
        form.map((result, index) => (
          <span
            className={`is-${String(result).toLowerCase()}`}
            key={`${result}-${index}`}
          >
            {result}
          </span>
        ))
      ) : (
        <em>No recent form</em>
      )}
    </div>
  );
}

function PreviewTeamPanel({
  team,
  side,
}) {
  const dna = team.dna;

  return (
    <article className={`slp-preview-team is-${side}`}>
      <div className="slp-preview-team-head">
        <span className="slp-preview-avatar">
          {getInitials(team.teamName)}
        </span>

        <div>
          <small>{side === "a" ? "Team A" : "Team B"}</small>
          <strong>{team.teamName}</strong>
        </div>
      </div>

      <div className="slp-preview-team-form">
        <small>Recent form</small>
        <PreviewForm form={team.form} />
      </div>

      <div className="slp-preview-dna-mini">
        <div>
          <small>Win rate</small>
          <strong>
            {dna ? `${dna.winPct.toFixed(0)}%` : "—"}
          </strong>
        </div>

        <div>
          <small>Batting RR</small>
          <strong>
            {dna ? dna.battingRunRate.toFixed(2) : "—"}
          </strong>
        </div>

        <div>
          <small>Bowling econ</small>
          <strong>
            {dna ? dna.bowlingEconomy.toFixed(2) : "—"}
          </strong>
        </div>
      </div>

      <div className="slp-preview-watch">
        <small>Players to watch</small>

        <div>
          <span>🏏</span>
          <p>
            <strong>
              {team.watch?.batter?.playerName || "No batting leader yet"}
            </strong>
            <em>
              {team.watch?.batter
                ? `${team.watch.batter.runs} runs · SR ${team.watch.batter.strikeRate.toFixed(1)}`
                : "Needs more completed-match evidence"}
            </em>
          </p>
        </div>

        <div>
          <span>🎯</span>
          <p>
            <strong>
              {team.watch?.bowler?.playerName || "No bowling leader yet"}
            </strong>
            <em>
              {team.watch?.bowler
                ? `${team.watch.bowler.wickets} wickets · Econ ${team.watch.bowler.economy.toFixed(2)}`
                : "Needs more completed-match evidence"}
            </em>
          </p>
        </div>
      </div>

      {dna?.strengths?.length ? (
        <div className="slp-preview-traits">
          {dna.strengths.slice(0, 2).map((trait) => (
            <span key={`${team.teamId}-${trait.label}`}>
              {trait.icon} {trait.label}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function PreMatchPreview({
  preview,
}) {
  const h2h = preview.headToHead;

  return (
    <div className="slp-preview-shell">
      <div className="slp-preview-fixture">
        <div>
          <small>{preview.seriesName}</small>
          <strong>
            {preview.teamAName}
            <span> vs </span>
            {preview.teamBName}
          </strong>
          <p>
            {preview.scheduledLabel}
            {" · "}
            {preview.venue}
          </p>
        </div>

        {preview.href ? (
          <a href={preview.href}>
            Open Match Center →
          </a>
        ) : null}
      </div>

      <div className="slp-preview-matchup">
        <PreviewTeamPanel
          team={preview.teamA}
          side="a"
        />

        <div className="slp-preview-h2h">
          <small>Head to head</small>

          <strong>
            {h2h.teamAWins}
            <span> — </span>
            {h2h.teamBWins}
          </strong>

          <p>
            {h2h.matches} previous meeting{h2h.matches === 1 ? "" : "s"}
            {h2h.ties ? ` · ${h2h.ties} tied` : ""}
          </p>

          <div className="slp-preview-h2h-names">
            <span>{preview.teamAName}</span>
            <span>{preview.teamBName}</span>
          </div>
        </div>

        <PreviewTeamPanel
          team={preview.teamB}
          side="b"
        />
      </div>

      <div className="slp-preview-context-grid">
        <article>
          <span>🕘</span>
          <div>
            <small>Last meeting</small>
            <strong>
              {h2h.lastMeeting?.result || "First recorded meeting"}
            </strong>
          </div>
        </article>

        <article>
          <span>🏃</span>
          <div>
            <small>Chasing</small>
            <strong>
              {preview.teamA.dna?.chaseAttempts
                ? `${preview.teamAName}: ${preview.teamA.dna.chaseWinPct.toFixed(0)}%`
                : `${preview.teamAName}: no sample`}
              {" · "}
              {preview.teamB.dna?.chaseAttempts
                ? `${preview.teamBName}: ${preview.teamB.dna.chaseWinPct.toFixed(0)}%`
                : `${preview.teamBName}: no sample`}
            </strong>
          </div>
        </article>

        <article>
          <span>🛡️</span>
          <div>
            <small>Defending</small>
            <strong>
              {preview.teamA.dna?.defendAttempts
                ? `${preview.teamAName}: ${preview.teamA.dna.defendWinPct.toFixed(0)}%`
                : `${preview.teamAName}: no sample`}
              {" · "}
              {preview.teamB.dna?.defendAttempts
                ? `${preview.teamBName}: ${preview.teamB.dna.defendWinPct.toFixed(0)}%`
                : `${preview.teamBName}: no sample`}
            </strong>
          </div>
        </article>
      </div>

      <PreMatchIntelligence
        preview={preview}
      />
    </div>
  );
}

function PreMatchIntelligence({
  preview,
}) {
  const intelligence =
    preview.intelligence || {};
  const edges =
    intelligence.matchupEdges || [];
  const watchList =
    intelligence.watchList || [];

  const teamARecent =
    preview.teamA?.recent || {};
  const teamBRecent =
    preview.teamB?.recent || {};

  return (
    <section className="slp-preview-intelligence">
      <div className="slp-preview-intelligence-head">
        <div>
          <small>🔮 Pre-match intelligence 2.0</small>
          <strong>What to watch</strong>
        </div>

        <span>Evidence-based</span>
      </div>

      <div className="slp-preview-intel-grid">
        <article className="slp-preview-intel-card">
          <small>🔥 Rivalry momentum</small>
          <strong>
            {intelligence.rivalryStreak
              ? `${intelligence.rivalryStreak.teamName} · ${intelligence.rivalryStreak.wins} straight`
              : "No active rivalry streak"}
          </strong>
          <p>
            {intelligence.rivalryStreak
              ? "Consecutive completed head-to-head wins"
              : "The latest meetings do not form a current winning streak"}
          </p>
        </article>

        <article className="slp-preview-intel-card">
          <small>📊 Recent-results edge</small>
          <strong>
            {preview.teamAName}{" "}
            {intelligence.recentFormScore?.teamA ?? 0}
            {" — "}
            {intelligence.recentFormScore?.teamB ?? 0}{" "}
            {preview.teamBName}
          </strong>
          <p>
            2 points per win · 1 per tie across the last five qualifying results
          </p>
        </article>

        <article className="slp-preview-intel-card">
          <small>🏏 In-form batter</small>
          <strong>
            {[
              teamARecent.batter,
              teamBRecent.batter,
            ]
              .filter(Boolean)
              .sort(
                (a, b) =>
                  Number(b.runs || 0) -
                  Number(a.runs || 0)
              )[0]?.playerName ||
              "No recent batting leader"}
          </strong>
          <p>
            {(() => {
              const player = [
                teamARecent.batter,
                teamBRecent.batter,
              ]
                .filter(Boolean)
                .sort(
                  (a, b) =>
                    Number(b.runs || 0) -
                    Number(a.runs || 0)
                )[0];

              return player
                ? `${player.runs} recent runs · SR ${Number(player.strikeRate || 0).toFixed(1)}`
                : "Needs more recent completed batting data";
            })()}
          </p>
        </article>

        <article className="slp-preview-intel-card">
          <small>🎯 In-form bowler</small>
          <strong>
            {[
              teamARecent.bowler,
              teamBRecent.bowler,
            ]
              .filter(Boolean)
              .sort(
                (a, b) =>
                  Number(b.wickets || 0) -
                  Number(a.wickets || 0)
              )[0]?.playerName ||
              "No recent bowling leader"}
          </strong>
          <p>
            {(() => {
              const player = [
                teamARecent.bowler,
                teamBRecent.bowler,
              ]
                .filter(Boolean)
                .sort(
                  (a, b) =>
                    Number(b.wickets || 0) -
                    Number(a.wickets || 0)
                )[0];

              return player
                ? `${player.wickets} recent wicket${player.wickets === 1 ? "" : "s"} · Econ ${Number(player.economy || 0).toFixed(2)}`
                : "Needs more recent bowler-credited wickets";
            })()}
          </p>
        </article>
      </div>

      {edges.length ? (
        <div className="slp-preview-edges">
          <div className="slp-preview-edges-title">
            <small>Matchup edges</small>
            <strong>Where the numbers separate the teams</strong>
          </div>

          <div>
            {edges.map((edge) => (
              <article
                key={`${edge.label}-${edge.teamName}`}
              >
                <span>{edge.icon}</span>
                <p>
                  <small>{edge.label}</small>
                  <strong>{edge.teamName}</strong>
                  <em>
                    {edge.value} · {edge.detail}
                  </em>
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="slp-preview-watchlist">
        <div>
          <small>Broadcast notes</small>
          <strong>Four things to watch</strong>
        </div>

        <ol>
          {watchList.map((note, index) => (
            <li key={`${index}-${note}`}>
              <span>
                {String(index + 1).padStart(2, "0")}
              </span>
              <p>{note}</p>
            </li>
          ))}
        </ol>
      </div>

      <p className="slp-preview-intel-disclaimer">
        Cric4All describes historical and recent performance evidence only.
        This is not a win probability or prediction.
      </p>
    </section>
  );
}

function RivalryTeam({
  team,
  side,
}) {
  return (
    <div className={`slp-rivalry-team is-${side}`}>
      <span className="slp-rivalry-avatar">
        {getInitials(team.teamName)}
      </span>

      <div>
        <strong>{team.teamName}</strong>
        <small>{team.wins} head-to-head win{team.wins === 1 ? "" : "s"}</small>
      </div>
    </div>
  );
}

function RivalrySpotlight({
  icon,
  label,
  value,
  detail,
}) {
  return (
    <article className="slp-rivalry-spotlight">
      <span aria-hidden="true">{icon}</span>
      <p>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
      </p>
    </article>
  );
}

function TeamRivalryCenter({
  rivalry,
}) {
  const leader =
    rivalry.teamA.wins === rivalry.teamB.wins
      ? null
      : rivalry.teamA.wins > rivalry.teamB.wins
        ? rivalry.teamA
        : rivalry.teamB;

  return (
    <div className="slp-rivalry-shell">
      <div className="slp-rivalry-score">
        <RivalryTeam
          team={rivalry.teamA}
          side="a"
        />

        <div className="slp-rivalry-score-center">
          <small>Head to head</small>
          <strong>
            {rivalry.teamA.wins}
            <span> — </span>
            {rivalry.teamB.wins}
          </strong>
          <p>
            {rivalry.meetings} meeting{rivalry.meetings === 1 ? "" : "s"}
            {rivalry.ties ? ` · ${rivalry.ties} tied` : ""}
          </p>

          {leader ? (
            <em>
              {leader.teamName} leads by{" "}
              {Math.abs(
                rivalry.teamA.wins -
                rivalry.teamB.wins
              )}
            </em>
          ) : (
            <em>Rivalry level</em>
          )}
        </div>

        <RivalryTeam
          team={rivalry.teamB}
          side="b"
        />
      </div>

      <div className="slp-rivalry-spotlights">
        <RivalrySpotlight
          icon="🔥"
          label="Current streak"
          value={
            rivalry.currentStreak
              ? `${rivalry.currentStreak.teamName} · ${rivalry.currentStreak.wins}`
              : "No active win streak"
          }
          detail={
            rivalry.currentStreak
              ? `${rivalry.currentStreak.wins} consecutive head-to-head win${rivalry.currentStreak.wins === 1 ? "" : "s"}`
              : "Latest result was tied or the sequence is level"
          }
        />

        <RivalrySpotlight
          icon="📈"
          label="Highest team total"
          value={
            rivalry.highestTotal
              ? `${rivalry.highestTotal.runs}/${rivalry.highestTotal.wickets}`
              : "No scored total"
          }
          detail={
            rivalry.highestTotal
              ? `${rivalry.highestTotal.teamName} · ${rivalry.highestTotal.legalBalls} legal balls`
              : "Needs ball-by-ball scoring data"
          }
        />

        <RivalrySpotlight
          icon="😮"
          label="Closest score gap"
          value={
            rivalry.closestFinish
              ? `${rivalry.closestFinish.scoreGap} run${rivalry.closestFinish.scoreGap === 1 ? "" : "s"}`
              : "No non-tied gap"
          }
          detail={
            rivalry.closestFinish
              ? `${rivalry.closestFinish.label} · ${rivalry.closestFinish.dateLabel}`
              : "No comparable two-innings finish"
          }
        />

        <RivalrySpotlight
          icon="💥"
          label="Biggest score gap"
          value={
            rivalry.biggestWin
              ? `${rivalry.biggestWin.scoreGap} runs`
              : "No scored gap"
          }
          detail={
            rivalry.biggestWin
              ? `${rivalry.biggestWin.winnerTeamName} · ${rivalry.biggestWin.dateLabel}`
              : "No comparable two-innings result"
          }
        />
      </div>

      <div className="slp-rivalry-player-grid">
        <article>
          <span>🏏</span>
          <div>
            <small>Rivalry run leader</small>
            <strong>
              {rivalry.topBatter?.playerName || "No batter leader yet"}
            </strong>
            <p>
              {rivalry.topBatter
                ? `${rivalry.topBatter.runs} runs · SR ${rivalry.topBatter.strikeRate.toFixed(1)} · ${rivalry.topBatter.teamName}`
                : "Needs completed batting data"}
            </p>
          </div>
        </article>

        <article>
          <span>🎯</span>
          <div>
            <small>Rivalry wicket leader</small>
            <strong>
              {rivalry.topBowler?.playerName || "No bowling leader yet"}
            </strong>
            <p>
              {rivalry.topBowler
                ? `${rivalry.topBowler.wickets} wickets · Econ ${rivalry.topBowler.economy.toFixed(2)} · ${rivalry.topBowler.teamName}`
                : "Needs bowler-credited wickets"}
            </p>
          </div>
        </article>
      </div>

      <div className="slp-rivalry-history">
        <div className="slp-rivalry-history-head">
          <div>
            <small>Recent history</small>
            <strong>Last five meetings</strong>
          </div>
          <span>Most recent first</span>
        </div>

        {rivalry.recent.length ? (
          <div className="slp-rivalry-results">
            {rivalry.recent.map((meeting) => {
              const content = (
                <>
                  <span>{meeting.dateLabel}</span>
                  <strong>{meeting.label}</strong>
                  <p>{meeting.result}</p>
                </>
              );

              return meeting.href ? (
                <a
                  key={meeting.matchId}
                  href={meeting.href}
                >
                  {content}
                </a>
              ) : (
                <div key={meeting.matchId}>
                  {content}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="slp-rivalry-empty">
            No completed meetings available.
          </p>
        )}
      </div>
    </div>
  );
}

function TeamDnaCard({
  team,
  featured = false,
}) {
  return (
    <article
      className={`slp-dna-card ${
        featured ? "is-featured" : ""
      }`}
    >
      <div className="slp-dna-card-head">
        <span className="slp-dna-team-avatar">
          {getInitials(team.teamName)}
        </span>

        <div>
          <small>Team profile</small>
          <strong>{team.teamName}</strong>
          <span>
            {team.matches} match{team.matches === 1 ? "" : "es"} ·{" "}
            {team.wins}W {team.losses}L {team.ties}T
          </span>
        </div>

        <div className="slp-dna-win-rate">
          <strong>{team.winPct.toFixed(0)}%</strong>
          <span>win rate</span>
        </div>
      </div>

      <div className="slp-dna-form">
        <small>Recent form</small>
        <div>
          {team.recent.length ? (
            team.recent.map((result, index) => (
              <span
                className={`is-${String(result).toLowerCase()}`}
                key={`${team.teamId}-${result}-${index}`}
              >
                {result}
              </span>
            ))
          ) : (
            <em>No completed form yet</em>
          )}
        </div>
      </div>

      <div className="slp-dna-metrics">
        <div>
          <span>⚡</span>
          <small>Batting RR</small>
          <strong>{team.battingRunRate.toFixed(2)}</strong>
        </div>

        <div>
          <span>📈</span>
          <small>Avg score</small>
          <strong>{team.avgScore.toFixed(1)}</strong>
        </div>

        <div>
          <span>🚀</span>
          <small>Boundary runs</small>
          <strong>{team.boundaryRunPct.toFixed(0)}%</strong>
        </div>

        <div>
          <span>🔒</span>
          <small>Bowling econ</small>
          <strong>{team.bowlingEconomy.toFixed(2)}</strong>
        </div>

        <div>
          <span>⚪</span>
          <small>Dot balls</small>
          <strong>{team.dotBallPct.toFixed(0)}%</strong>
        </div>

        <div>
          <span>🎯</span>
          <small>Wkts/innings</small>
          <strong>{team.wicketsPerBowlingInnings.toFixed(1)}</strong>
        </div>
      </div>

      <div className="slp-dna-situations">
        <div>
          <small>🏃 Chasing</small>
          <strong>
            {team.chaseAttempts
              ? `${team.chaseWins}/${team.chaseAttempts}`
              : "No data"}
          </strong>
          <span>
            {team.chaseAttempts
              ? `${team.chaseWinPct.toFixed(0)}% win rate`
              : "Awaiting chase sample"}
          </span>
        </div>

        <div>
          <small>🛡️ Defending</small>
          <strong>
            {team.defendAttempts
              ? `${team.defendWins}/${team.defendAttempts}`
              : "No data"}
          </strong>
          <span>
            {team.defendAttempts
              ? `${team.defendWinPct.toFixed(0)}% win rate`
              : "Awaiting defend sample"}
          </span>
        </div>
      </div>

      <div className="slp-dna-traits">
        <div>
          <small>Team identity</small>
          <div>
            {team.strengths.map((trait) => (
              <span
                className={`is-${trait.tone}`}
                key={`${team.teamId}-${trait.label}`}
                title={trait.detail}
              >
                {trait.icon} {trait.label}
              </span>
            ))}
          </div>
        </div>

        {team.watch.length ? (
          <div className="slp-dna-watch">
            <small>Watch area</small>
            <div>
              {team.watch.map((trait) => (
                <span
                  key={`${team.teamId}-${trait.label}`}
                  title={trait.detail}
                >
                  {trait.icon} {trait.label}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <details className="slp-dna-evidence">
        <summary>Why Cric4All describes the team this way</summary>
        <div>
          {[...team.strengths, ...team.watch].map((trait) => (
            <p key={`${team.teamId}-evidence-${trait.label}`}>
              <strong>{trait.icon} {trait.label}</strong>
              <span>{trait.detail}</span>
            </p>
          ))}
        </div>
      </details>
    </article>
  );
}

function MilestoneAchievementCard({
  milestone,
  featured = false,
}) {
  const content = (
    <>
      <div className="slp-milestone-achievement-top">
        <span
          className="slp-milestone-achievement-icon"
          aria-hidden="true"
        >
          {milestone.icon}
        </span>

        <div>
          <small>Milestone achieved</small>
          <strong>{milestone.title}</strong>
        </div>

        <span className="slp-milestone-check" aria-label="Achieved">
          ✓
        </span>
      </div>

      <div className="slp-milestone-player">
        <strong>{milestone.playerName}</strong>
        <span>{milestone.teamName || "League player"}</span>
      </div>

      <div className="slp-milestone-total">
        <strong>{milestone.threshold}</strong>
        <span>{milestone.metric}</span>
      </div>

      <div className="slp-milestone-match">
        <small>
          {milestone.dateLabel || "Completed match"}
        </small>
        <strong>{milestone.matchLabel}</strong>
      </div>

      {milestone.href ? (
        <span className="slp-milestone-view">
          View milestone match →
        </span>
      ) : null}
    </>
  );

  const className =
    `slp-milestone-achievement ${
      featured ? "is-featured" : ""
    }`;

  return milestone.href ? (
    <a
      className={className}
      href={milestone.href}
    >
      {content}
    </a>
  ) : (
    <article className={className}>
      {content}
    </article>
  );
}

function MilestoneProgressCard({
  milestone,
}) {
  return (
    <article className="slp-milestone-progress">
      <div className="slp-milestone-progress-head">
        <span aria-hidden="true">
          {milestone.icon}
        </span>

        <div>
          <strong>{milestone.playerName}</strong>
          <small>{milestone.teamName || "League player"}</small>
        </div>

        <b>{Math.round(milestone.progress)}%</b>
      </div>

      <div className="slp-milestone-progress-target">
        <span>{milestone.label}</span>
        <strong>
          {milestone.current} / {milestone.target}
        </strong>
      </div>

      <div
        className="slp-milestone-progress-track"
        aria-label={`${milestone.progress}% toward ${milestone.target} ${milestone.shortLabel}`}
      >
        <span
          style={{
            width: `${Math.max(
              3,
              milestone.progress
            )}%`,
          }}
        />
      </div>

      <p>
        <strong>{milestone.remaining}</strong>{" "}
        {milestone.shortLabel} to the next landmark
      </p>
    </article>
  );
}

function RecordCard({
  record,
  featured = false,
  rank,
}) {
  const content = (
    <>
      <div className="slp-record-card-top">
        <span
          className="slp-record-icon"
          aria-hidden="true"
        >
          {record.icon}
        </span>

        <div>
          <small>
            {record.category} record
          </small>
          <strong>
            {record.title}
          </strong>
        </div>

        <span className="slp-record-rank">
          #{String(rank).padStart(2, "0")}
        </span>
      </div>

      <div className="slp-record-value">
        {record.value}
      </div>

      <div className="slp-record-holder">
        <strong title={record.holder}>
          {record.holder}
        </strong>
        {record.teamName ? (
          <span title={record.teamName}>
            {record.teamName}
          </span>
        ) : null}
      </div>

      <p>{record.detail}</p>

      {record.matchLabel ? (
        <div className="slp-record-match">
          <span>Recorded in</span>
          <strong title={record.matchLabel}>
            {record.matchLabel}
          </strong>
        </div>
      ) : null}

      {record.href ? (
        <span className="slp-record-link">
          View match →
        </span>
      ) : null}
    </>
  );

  const className =
    `slp-record-card slp-record-card--${record.accent} ${
      featured ? "is-featured" : ""
    }`;

  return record.href ? (
    <a
      className={className}
      href={record.href}
    >
      {content}
    </a>
  ) : (
    <article className={className}>
      {content}
    </article>
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
  liveMatches,
  scheduledMatches,
  completedMatches,
  pointsTable,
  topRunScorer,
  topWicketTaker,
  leagueSlug,
  openTab,
}) {
  const fallbackMatch =
    scheduledMatches[0] || completedMatches[0] || null;

  return (
    <section className="slp-overview">
      <LiveMatchRail
        liveMatches={liveMatches}
        fallbackMatch={fallbackMatch}
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

          {!topRunScorer && !topWicketTaker ? (
            <EmptyState
              title="No performers yet"
              message="Player leaders will appear after scoring starts."
            />
          ) : (
            <div className="slp-performers">
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

function LiveMatchRail({
  liveMatches,
  fallbackMatch,
  leagueSlug,
  openTab,
}) {
  const railRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const matches = liveMatches.length
    ? liveMatches
    : fallbackMatch
      ? [fallbackMatch]
      : [];

  const hasMultipleLiveMatches = liveMatches.length > 1;
  const isShowingLiveMatches = liveMatches.length > 0;

  function scrollToMatch(index) {
    const rail = railRef.current;
    if (!rail || !matches.length) return;

    const normalizedIndex =
      (index + matches.length) % matches.length;
    const card = rail.children[normalizedIndex];

    if (!card) return;

    rail.scrollTo({
      left: card.offsetLeft - rail.offsetLeft,
      behavior: "smooth",
    });

    setActiveIndex(normalizedIndex);
  }

  function handleRailScroll() {
    const rail = railRef.current;
    if (!rail || !matches.length) return;

    const cards = Array.from(rail.children);
    const nearestIndex = cards.reduce(
      (bestIndex, card, index) => {
        const bestCard = cards[bestIndex];
        const cardDistance = Math.abs(card.offsetLeft - rail.scrollLeft);
        const bestDistance = Math.abs(
          bestCard.offsetLeft - rail.scrollLeft
        );

        return cardDistance < bestDistance ? index : bestIndex;
      },
      0
    );

    setActiveIndex(nearestIndex);
  }

  useEffect(() => {
    if (!hasMultipleLiveMatches || isPaused) return undefined;

    const timer = window.setInterval(() => {
      setActiveIndex((currentIndex) => {
        const nextIndex = (currentIndex + 1) % matches.length;

        window.requestAnimationFrame(() => {
          const rail = railRef.current;
          const card = rail?.children?.[nextIndex];

          if (rail && card) {
            rail.scrollTo({
              left: card.offsetLeft - rail.offsetLeft,
              behavior: "smooth",
            });
          }
        });

        return nextIndex;
      });
    }, 7000);

    return () => window.clearInterval(timer);
  }, [hasMultipleLiveMatches, isPaused, matches.length]);

  if (!matches.length) {
    return (
      <EmptyState
        title="No matches yet"
        message="Fixtures will appear here when they are created."
      />
    );
  }

  return (
    <section
      className="slp-live-rail-section"
      aria-label={
        isShowingLiveMatches ? "Live matches" : "Featured match"
      }
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className="slp-live-rail-head">
        <div>
          <p>
            {isShowingLiveMatches
              ? "Live cricket"
              : normalizeStatus(matches[0]?.status) === "SCHEDULED"
                ? "Next fixture"
                : "Latest result"}
          </p>
          <h2>
            {isShowingLiveMatches
              ? `${liveMatches.length} ${
                  liveMatches.length === 1 ? "match" : "matches"
                } live now`
              : "Featured match"}
          </h2>
        </div>

        <div className="slp-live-rail-tools">
          {hasMultipleLiveMatches && (
            <>
              <span>
                {activeIndex + 1} / {matches.length}
              </span>

              <button
                type="button"
                onClick={() => scrollToMatch(activeIndex - 1)}
                aria-label="Previous live match"
              >
                ←
              </button>

              <button
                type="button"
                onClick={() => scrollToMatch(activeIndex + 1)}
                aria-label="Next live match"
              >
                →
              </button>
            </>
          )}

          <button
            type="button"
            className="slp-view-all-live"
            onClick={() => openTab("matches")}
          >
            View all
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        className="slp-live-rail"
        onScroll={handleRailScroll}
      >
        {matches.map((match, index) => {
          const isLive = ["LIVE", "IN_PROGRESS"].includes(
            normalizeStatus(match.status)
          );

          return (
            <article
              key={match.id}
              className={`slp-live-card ${
                isLive ? "is-live" : ""
              }`}
              aria-current={activeIndex === index ? "true" : undefined}
            >
              <div className="slp-live-card-status">
                {isLive && <span aria-hidden="true" />}
                {isLive
                  ? "Live now"
                  : normalizeStatus(match.status) === "SCHEDULED"
                    ? "Upcoming"
                    : "Latest result"}
              </div>

              <div className="slp-live-card-copy">
                <small>{match.series?.name || "League match"}</small>
                <h3>{formatMatchTitle(match)}</h3>
                <p>
                  {match.statusText ||
                    formatStatusLabel(match.status)}
                </p>
              </div>

              {match.shareCode ? (
                <a href={`/leagues/${leagueSlug}/matches/${match.id}`}>
                  Match center
                  <Icon name="arrowRight" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => openTab("matches")}
                >
                  View fixture
                  <Icon name="arrowRight" />
                </button>
              )}
            </article>
          );
        })}
      </div>

      {hasMultipleLiveMatches && (
        <div
          className="slp-live-dots"
          aria-label="Select live match"
        >
          {matches.map((match, index) => (
            <button
              key={match.id}
              type="button"
              className={activeIndex === index ? "active" : ""}
              onClick={() => scrollToMatch(index)}
              aria-label={`Show live match ${index + 1}`}
              aria-current={activeIndex === index ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
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
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.teamId}>
              <td><span className="slp-rank">{index + 1}</span></td>
              <td>
                <span className="slp-table-team">
                  <span className="slp-avatar">{getInitials(row.teamName)}</span>
                  <strong>{row.teamName}</strong>
                </span>
              </td>
              <td>{row.played}</td>
              <td>{row.won}</td>
              <td>{row.lost}</td>
              <td>{row.tied}</td>
              <td><strong>{row.points}</strong></td>
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
              <td>{row.teamName || "—"}</td>
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

function DashboardStatsTable({ type, rows = [] }) {
  if (!rows.length) {
    return <EmptyState title="No statistics yet" message="No qualifying completed-match statistics are available." />;
  }

  const headers = {
    batting: ["#", "Player", "Team", "M", "Inn", "Runs", "HS", "Avg", "SR", "4s", "6s"],
    bowling: ["#", "Player", "Team", "M", "Overs", "Runs", "Wkts", "Best", "Avg", "SR", "Eco", "Dots"],
    fielding: ["#", "Player", "Team", "M", "Catches", "Run outs", "Stumpings", "Assists", "Total"],
    captaincy: ["#", "Captain", "Team", "Played", "Won", "Lost", "Win %"],
    wicketkeeping: ["#", "Wicketkeeper", "Team", "Catches", "Stumpings", "Run outs", "Total"],
  }[type] || ["#", "Player"];

  return (
    <div className="slp-table-wrap">
      <table className="slp-table">
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => {
            const playerName = row.playerName || row.name || "Unknown player";
            const teamName = row.teamName || "—";
            return (
              <tr key={`${row.playerId || playerName}-${index}`}>
                <td><span className="slp-rank">{index + 1}</span></td>
                <td><span className="slp-table-team"><span className="slp-avatar">{getInitials(playerName)}</span><strong>{playerName}</strong></span></td>
                <td>{teamName}</td>
                {type === "batting" && <><td>{row.matches ?? 0}</td><td>{row.battingInnings ?? 0}</td><td><strong>{row.runs ?? 0}</strong></td><td>{row.highestScore ?? 0}</td><td>{row.average ?? "0.00"}</td><td>{row.strikeRate ?? "0.00"}</td><td>{row.fours ?? 0}</td><td>{row.sixes ?? 0}</td></>}
                {type === "bowling" && <><td>{row.matches ?? 0}</td><td>{row.bowlingOvers ?? row.overs ?? "0.0"}</td><td>{row.bowlingRuns ?? row.runs ?? 0}</td><td><strong>{row.wickets ?? 0}</strong></td><td>{row.bestBowling ?? "-"}</td><td>{row.bowlingAverage ?? "0.00"}</td><td>{row.bowlingStrikeRate ?? "0.00"}</td><td>{row.economy ?? "0.00"}</td><td>{row.dots ?? 0}</td></>}
                {type === "fielding" && <><td>{row.matches ?? 0}</td><td>{row.catches ?? 0}</td><td>{row.runOuts ?? 0}</td><td>{row.stumpings ?? 0}</td><td>{row.assists ?? 0}</td><td><strong>{row.fieldingTotal ?? 0}</strong></td></>}
                {type === "captaincy" && <><td>{row.played ?? 0}</td><td>{row.won ?? 0}</td><td>{row.lost ?? 0}</td><td><strong>{row.played ? ((Number(row.won || 0) / Number(row.played)) * 100).toFixed(1) : "0.0"}%</strong></td></>}
                {type === "wicketkeeping" && <><td>{row.catches ?? 0}</td><td>{row.stumpings ?? 0}</td><td>{row.runOuts ?? 0}</td><td><strong>{Number(row.catches || 0) + Number(row.stumpings || 0) + Number(row.runOuts || 0)}</strong></td></>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PublicRankings({ rankings }) {
  if (!rankings) {
    return <EmptyState title="No rankings yet" message="Rankings will appear after completed matches." />;
  }

  const groups = [
    ["Top run scorers", rankings.topRunScorers, (row) => `${row.runs || 0} runs`],
    ["Top wicket takers", rankings.topWicketTakers, (row) => `${row.wickets || 0} wickets`],
    ["Best strike rate", rankings.bestStrikeRate, (row) => `${row.strikeRate || "0.00"} SR`],
    ["Best economy", rankings.bestEconomy, (row) => `${row.economy || "0.00"} eco`],
    ["Most sixes", rankings.mostSixes, (row) => `${row.sixes || 0} sixes`],
    ["Most catches", rankings.mostCatches, (row) => `${row.catches || 0} catches`],
    ["Best all-rounders", rankings.bestAllRounders, (row) => `${row.allRounderPoints || 0} pts`],
  ];

  return (
    <div className="slp-ranking-grid">
      {groups.map(([title, rows, value]) => (
        <article className="slp-ranking-card" key={title}>
          <h3>{title}</h3>
          {(rows || []).slice(0, 5).map((row, index) => (
            <div className="slp-ranking-row" key={`${title}-${row.playerId}-${index}`}>
              <span>{index + 1}</span>
              <strong>{row.playerName}</strong>
              <small>{row.teamName || "—"}</small>
              <b>{value(row)}</b>
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}

function PublicAwards({ awardsData }) {
  const awards = awardsData?.awards || [];
  const team = awardsData?.teamOfWeek || [];
  const periodLabel = awardsData?.selectedSeries?.name || (awardsData?.period?.type === "MONTH" ? "Current month" : "Current period");

  if (!awards.length) {
    return <EmptyState title="No awards yet" message="Awards will appear after qualifying completed matches." />;
  }

  return (
    <div>
      <div className="slp-awards-context"><strong>🏆 {periodLabel}</strong><span>{awardsData?.counts?.periodMatches || 0} qualifying matches</span></div>
      <div className="slp-awards-grid">
        {awards.filter((award) => award.available !== false || award.alwaysVisible).map((award) => (
          <article className="slp-award-card" key={award.key}>
            <span className="slp-award-icon">{award.icon || "🏆"}</span>
            <div><small>{award.title}</small><h3>{award.playerName || "Awaiting data"}</h3><em>{award.teamName || "—"}</em></div>
            <strong>{award.value || "—"}</strong>
            <p>{award.subtitle || ""}</p>
            {award.explanation ? <details><summary>How calculated</summary><p>{award.explanation}</p></details> : null}
          </article>
        ))}
      </div>
      {team.length ? <div className="slp-team-award"><h3>👥 Team of {awardsData?.period?.type === "SERIES" ? "Series" : "Period"}</h3><div>{team.map((player) => <span key={`${player.playerId}-${player.role}`}>{player.playerName}<small>{player.role}</small></span>)}</div></div> : null}
    </div>
  );
}

function LeaderShowcase({ hero, cards, accent }) {
  const visibleCards = (cards || []).filter((card) => card?.row);

  return (
    <div className={`slp-leader-showcase slp-leader-showcase--${accent}`}>
      <article className="slp-leader-hero">
        <div className="slp-leader-hero-top">
          <span className="slp-leader-kicker">{hero.eyebrow}</span>
          <span className="slp-leader-hero-icon" aria-hidden="true">
            {hero.icon}
          </span>
        </div>

        <div className="slp-leader-hero-body">
          <span className="slp-leader-hero-avatar">
            {getInitials(hero.row?.playerName || "?")}
          </span>

          <div className="slp-leader-hero-player">
            <small>{hero.label}</small>
            <strong title={hero.row?.playerName || ""}>
              {hero.row?.playerName || "No data yet"}
            </strong>
            <em title={hero.row?.teamName || ""}>
              {hero.row?.teamName || "Statistics pending"}
            </em>
          </div>

          <div className="slp-leader-hero-value">
            <strong>{hero.value}</strong>
            <span>{hero.unit}</span>
          </div>
        </div>

        {hero.detail ? (
          <div className="slp-leader-hero-detail">{hero.detail}</div>
        ) : null}
      </article>

      {visibleCards.length ? (
        <div className="slp-leader-card-grid">
          {visibleCards.map((card) => (
            <article
              className="slp-leader-card"
              key={`${card.label}-${card.row?.playerId || card.row?.playerName}`}
            >
              <div className="slp-leader-card-head">
                <span className="slp-leader-card-icon" aria-hidden="true">
                  {card.icon}
                </span>
                <div>
                  <small>{card.label}</small>
                  <em>{card.hint}</em>
                </div>
              </div>

              <div className="slp-leader-card-player">
                <span className="slp-avatar">
                  {getInitials(card.row?.playerName || "?")}
                </span>
                <div>
                  <strong title={card.row?.playerName || ""}>
                    {card.row?.playerName || "No data yet"}
                  </strong>
                  <em title={card.row?.teamName || ""}>
                    {card.row?.teamName || "Statistics pending"}
                  </em>
                </div>
              </div>

              <div className="slp-leader-card-value">
                <strong>{card.value}</strong>
                <span>{card.unit}</span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
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
