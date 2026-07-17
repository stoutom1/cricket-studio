const SURPRISE_TEAM_NAMES = new Set([
  "surprise 1",
  "surprise 2",
]);

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Determines whether special combined-player behavior should
 * apply to this league.
 *
 * Prefer checking a stable slug when available.
 */
export function isSurpriseCricketLeague(league) {
  const slug = normalizeText(league?.slug);
  const name = normalizeText(league?.name);

  return (
    slug === "surprise-cricket-league" ||
    name === "surprise cricket league"
  );
}

function isSurpriseTeam(teamName) {
  return SURPRISE_TEAM_NAMES.has(normalizeText(teamName));
}

/**
 * Converts a player's name to a stable merge key.
 *
 * Examples:
 * " Kapil " -> "kapil"
 * "KAPIL"   -> "kapil"
 */
export function createSurprisePlayerKey(playerName) {
  return normalizeText(playerName);
}

function uniqueNumbers(values) {
  return [
    ...new Set(
      values
        .map(Number)
        .filter(Number.isFinite)
    ),
  ];
}

function uniqueStrings(values) {
  return [
    ...new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    ),
  ];
}

/**
 * Combines batting rows belonging to the same named player
 * in Surprise 1 and Surprise 2.
 */
export function combineSurpriseBattingRows(
  rows = [],
  league
) {
  if (!isSurpriseCricketLeague(league)) {
    return rows;
  }

  const combined = new Map();
  const untouched = [];

  for (const row of rows) {
    /*
     * Only merge Surprise 1 and Surprise 2.
     * Other teams remain completely unchanged.
     */
    if (!isSurpriseTeam(row.teamName)) {
      untouched.push(row);
      continue;
    }

    const playerKey =
      createSurprisePlayerKey(row.playerName);

    if (!playerKey) {
      untouched.push(row);
      continue;
    }

    const current = combined.get(playerKey) || {
      playerKey,
      playerId: row.playerId,
      playerIds: [],
      playerName: row.playerName,

      teamId: null,
      teamIds: [],
      teamName: "",
      sourceTeams: [],

      matches: 0,
      innings: 0,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      outs: 0,
      highestScore: 0,
      notOuts: 0,
      fifties: 0,
      hundreds: 0,
    };

    current.playerIds.push(row.playerId);
    current.teamIds.push(row.teamId);
    current.sourceTeams.push(row.teamName);

    current.matches += Number(row.matches || 0);
    current.innings += Number(row.innings || 0);
    current.runs += Number(row.runs || 0);
    current.balls += Number(row.balls || 0);
    current.fours += Number(row.fours || 0);
    current.sixes += Number(row.sixes || 0);
    current.outs += Number(row.outs || 0);
    current.notOuts += Number(row.notOuts || 0);
    current.fifties += Number(row.fifties || 0);
    current.hundreds += Number(row.hundreds || 0);

    current.highestScore = Math.max(
      current.highestScore,
      Number(row.highestScore || 0)
    );

    combined.set(playerKey, current);
  }

  const mergedRows = [...combined.values()].map(
    (row) => {
      const playerIds = uniqueNumbers(row.playerIds);
      const teamIds = uniqueNumbers(row.teamIds);
      const sourceTeams = uniqueStrings(
        row.sourceTeams
      );

      const strikeRate = row.balls
        ? (row.runs / row.balls) * 100
        : 0;

      const average = row.outs
        ? row.runs / row.outs
        : row.runs;

      return {
        ...row,

        /*
         * Keep playerId for compatibility with existing UI,
         * but playerIds contains every underlying database ID.
         */
        playerId: playerIds[0] || row.playerId,
        playerIds,

        teamId: teamIds[0] || null,
        teamIds,

        sourceTeams,
        teamName: sourceTeams.join(" + "),

        strikeRate: strikeRate.toFixed(2),
        average: average.toFixed(2),

        isCombinedPlayer: playerIds.length > 1,
      };
    }
  );

  return [...mergedRows, ...untouched];
}

/**
 * Combines bowling rows belonging to the same named player
 * in Surprise 1 and Surprise 2.
 */
export function combineSurpriseBowlingRows(
  rows = [],
  league
) {
  if (!isSurpriseCricketLeague(league)) {
    return rows;
  }

  const combined = new Map();
  const untouched = [];

  for (const row of rows) {
    if (!isSurpriseTeam(row.teamName)) {
      untouched.push(row);
      continue;
    }

    const playerKey =
      createSurprisePlayerKey(row.playerName);

    if (!playerKey) {
      untouched.push(row);
      continue;
    }

    const current = combined.get(playerKey) || {
      playerKey,
      playerId: row.playerId,
      playerIds: [],
      playerName: row.playerName,

      teamId: null,
      teamIds: [],
      teamName: "",
      sourceTeams: [],

      matches: 0,
      innings: 0,
      balls: 0,
      dots: 0,
      maidens: 0,
      runs: 0,
      wickets: 0,
      wides: 0,
      noBalls: 0,
      bestWickets: 0,
      bestRuns: null,
    };

    current.playerIds.push(row.playerId);
    current.teamIds.push(row.teamId);
    current.sourceTeams.push(row.teamName);

    current.matches += Number(row.matches || 0);
    current.innings += Number(row.innings || 0);

    /*
     * Prefer raw legal-ball count. Do not add decimal
     * overs such as 2.4 + 3.3.
     */
    current.balls += Number(
      row.balls ??
      row.legalBalls ??
      0
    );

    current.dots += Number(row.dots || 0);
    current.maidens += Number(row.maidens || 0);
    current.runs += Number(row.runs || 0);
    current.wickets += Number(row.wickets || 0);
    current.wides += Number(row.wides || 0);
    current.noBalls += Number(row.noBalls || 0);

    const rowBestWickets = Number(
      row.bestWickets || 0
    );

    const rowBestRuns = Number(
      row.bestRuns ?? Number.MAX_SAFE_INTEGER
    );

    const hasBetterFigures =
      rowBestWickets > current.bestWickets ||
      (
        rowBestWickets === current.bestWickets &&
        rowBestRuns <
          Number(
            current.bestRuns ??
            Number.MAX_SAFE_INTEGER
          )
      );

    if (hasBetterFigures) {
      current.bestWickets = rowBestWickets;
      current.bestRuns =
        rowBestRuns === Number.MAX_SAFE_INTEGER
          ? null
          : rowBestRuns;
    }

    combined.set(playerKey, current);
  }

  const mergedRows = [...combined.values()].map(
    (row) => {
      const playerIds = uniqueNumbers(row.playerIds);
      const teamIds = uniqueNumbers(row.teamIds);
      const sourceTeams = uniqueStrings(
        row.sourceTeams
      );

      const overs =
        `${Math.floor(row.balls / 6)}.${row.balls % 6}`;

      const economy = row.balls
        ? (row.runs / row.balls) * 6
        : 0;

      const bowlingAverage = row.wickets
        ? row.runs / row.wickets
        : 0;

      const bowlingStrikeRate = row.wickets
        ? row.balls / row.wickets
        : 0;

      return {
        ...row,

        playerId: playerIds[0] || row.playerId,
        playerIds,

        teamId: teamIds[0] || null,
        teamIds,

        sourceTeams,
        teamName: sourceTeams.join(" + "),

        overs,
        economy: economy.toFixed(2),

        bowlingAverage:
          bowlingAverage.toFixed(2),

        bowlingStrikeRate:
          bowlingStrikeRate.toFixed(2),

        isCombinedPlayer: playerIds.length > 1,
      };
    }
  );

  return [...mergedRows, ...untouched];
}