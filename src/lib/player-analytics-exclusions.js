const EXCLUSION_LEAGUE_TOKENS = new Set([
  "surprisecricketleague",
  "surprisevsfalconsleague",
  "friendlyleague",
]);

function compactToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function isPlayerAnalyticsExclusionLeague(league) {
  const nameToken = compactToken(league?.name);
  const slugToken = compactToken(league?.slug);

  return (
    EXCLUSION_LEAGUE_TOKENS.has(nameToken) ||
    EXCLUSION_LEAGUE_TOKENS.has(slugToken)
  );
}

export function isExcludedAnalyticsPlayerName(playerName) {
  const name = String(playerName || "").trim();

  if (!name) {
    return false;
  }

  if (/guest/i.test(name)) {
    return true;
  }

  return /^GP[1-5]$/i.test(name);
}

export function shouldExcludePlayerFromLeagueAnalytics(league, playerOrName) {
  if (!isPlayerAnalyticsExclusionLeague(league)) {
    return false;
  }

  const playerName =
    typeof playerOrName === "string"
      ? playerOrName
      : playerOrName?.playerName ?? playerOrName?.name;

  return isExcludedAnalyticsPlayerName(playerName);
}

export function filterPlayerAnalyticsRows(rows = [], league) {
  if (!isPlayerAnalyticsExclusionLeague(league)) {
    return rows;
  }

  return (rows || []).filter(
    (row) => !shouldExcludePlayerFromLeagueAnalytics(league, row)
  );
}

export function filterMatchStatsForLeague(stats = {}, league) {
  if (!isPlayerAnalyticsExclusionLeague(league)) {
    return stats;
  }

  const filter = (rows) => filterPlayerAnalyticsRows(rows || [], league);

  return {
    ...stats,
    batting: filter(stats.batting),
    bowling: filter(stats.bowling),
    battingRows: filter(stats.battingRows),
    bowlingRows: filter(stats.bowlingRows),
    captaincy: filter(stats.captaincy),
    wicketkeeping: filter(stats.wicketkeeping),
    fielding: filter(stats.fielding),
  };
}

/**
 * Creates an analytics-only scoreboard view. It deliberately leaves the real
 * scoreboard untouched so Guest/GP players still appear in scorecards and live
 * scoring, while POTM/insight calculations ignore them in the three configured
 * leagues.
 */
export function filterScoreboardForPlayerAnalytics(scoreboard) {
  if (!scoreboard) {
    return scoreboard;
  }

  const league = {
    id: scoreboard?.match?.leagueId,
    name: scoreboard?.match?.leagueName,
    slug: scoreboard?.match?.leagueSlug,
  };

  if (!isPlayerAnalyticsExclusionLeague(league)) {
    return scoreboard;
  }

  return {
    ...scoreboard,
    innings: (scoreboard.innings || []).map((innings) => ({
      ...innings,
      battingRows: filterPlayerAnalyticsRows(innings.battingRows || [], league),
      bowlingRows: filterPlayerAnalyticsRows(innings.bowlingRows || [], league),
    })),
  };
}
