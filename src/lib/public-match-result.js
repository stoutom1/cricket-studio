const TECHNICAL_MATCH_STATUS_TEXT = new Set([
  "",
  "LIVE",
  "SCHEDULED",
  "IN_PROGRESS",
  "IN PROGRESS",
  "COMPLETED",
  "COMPLETED_LOCKED",
  "COMPLETED LOCKED",
  "COMPLETED_CORRECTED",
  "COMPLETED CORRECTED",
  "MATCH COMPLETED",
  "LOCKED",
]);

function cleanStatusText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTechnicalStatus(value) {
  return cleanStatusText(value)
    .replace(/-/g, "_")
    .toUpperCase();
}

export function isMeaningfulCricketResultText(value) {
  const clean = cleanStatusText(value);
  if (!clean) return false;

  const normalized = normalizeTechnicalStatus(clean);

  if (TECHNICAL_MATCH_STATUS_TEXT.has(normalized)) {
    return false;
  }

  /*
   * Treat real cricket-result language as authoritative. This is particularly
   * important for persisted DLS / D/L Standard results.
   */
  return (
    /\bwon\b/i.test(clean) ||
    /\btied\b/i.test(clean) ||
    /\bno result\b/i.test(clean) ||
    /\babandon/i.test(clean) ||
    /\bd\/l\b/i.test(clean) ||
    /\bdls\b/i.test(clean)
  );
}

export function summarizePublicInnings(balls = [], inningsNo) {
  const rows = (balls || []).filter(
    (ball) => Number(ball.inningsNo) === Number(inningsNo)
  );

  const runs = rows.reduce(
    (sum, ball) => sum + Number(ball.totalRuns || 0),
    0
  );

  const wickets = rows.filter(
    (ball) =>
      Boolean(ball.isWicket) &&
      String(ball.wicketType || "").toUpperCase() !== "RETIRED_HURT"
  ).length;

  const legalBalls = rows.filter(
    (ball) => Boolean(ball.legalDelivery)
  ).length;

  return {
    runs,
    wickets,
    legalBalls,
    overs: `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`,
  };
}

function teamNameForId(match, teamId) {
  const id = Number(teamId);

  if (id && Number(match?.teamAId) === id) {
    return match?.teamA?.name || "Team A";
  }

  if (id && Number(match?.teamBId) === id) {
    return match?.teamB?.name || "Team B";
  }

  return null;
}

export function buildPublicMatchResult(match) {
  const persisted = cleanStatusText(match?.statusText);

  /*
   * DLS and other real persisted outcomes win over score arithmetic.
   * Technical lifecycle states such as COMPLETED_LOCKED do not.
   */
  if (isMeaningfulCricketResultText(persisted)) {
    return persisted;
  }

  const status = normalizeTechnicalStatus(match?.status);

  if (status === "ABANDONED") {
    return "Match abandoned";
  }

  if (
    ![
      "COMPLETED",
      "COMPLETED_LOCKED",
      "COMPLETED_CORRECTED",
    ].includes(status)
  ) {
    return persisted || "Match details will update as scoring progresses.";
  }

  const first = summarizePublicInnings(match?.balls || [], 1);
  const second = summarizePublicInnings(match?.balls || [], 2);

  /*
   * Ball does not store battingTeamId in the current Cric4All schema.
   * Resolve innings batting order from Match.battingFirstTeamId instead.
   *
   * If an older match does not have battingFirstTeamId populated, fall back
   * to Team A batting first. This mirrors the existing match-level model
   * rather than querying a Ball field that does not exist.
   */
  const firstBattingTeamId =
    Number(match?.battingFirstTeamId) ||
    Number(match?.teamAId) ||
    null;

  const secondBattingTeamId =
    firstBattingTeamId &&
    Number(match?.teamAId) === firstBattingTeamId
      ? Number(match?.teamBId) || null
      : Number(match?.teamAId) || null;

  const defendingTeamName =
    teamNameForId(match, firstBattingTeamId) ||
    match?.teamA?.name ||
    "Team A";

  const chasingTeamName =
    teamNameForId(match, secondBattingTeamId) ||
    match?.teamB?.name ||
    "Team B";

  if (second.runs > first.runs) {
    const maxWickets =
      Number(match?.maxWicketsPerInnings) > 0
        ? Number(match.maxWicketsPerInnings)
        : 10;

    const wicketsRemaining = Math.max(
      maxWickets - second.wickets,
      0
    );

    return wicketsRemaining > 0
      ? `${chasingTeamName} won by ${wicketsRemaining} wicket${
          wicketsRemaining === 1 ? "" : "s"
        }`
      : `${chasingTeamName} won the match`;
  }

  if (second.runs === first.runs) {
    return "Match tied";
  }

  const margin = first.runs - second.runs;

  return `${defendingTeamName} won by ${margin} run${
    margin === 1 ? "" : "s"
  }`;
}
