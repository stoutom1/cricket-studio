/**
 * Canonical Cric4All rule for aggregate/statistical calculations.
 *
 * Abandoned matches stay available to match-history/scorecard UI, but none
 * of their recorded deliveries may affect career stats, form, momentum,
 * milestones, leaderboards, rivalries, awards, or other aggregate metrics.
 */
export function normalizeMatchStatus(status) {
  return String(status || "")
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

export function isAbandonedMatch(matchOrStatus) {
  const status =
    typeof matchOrStatus === "object" && matchOrStatus !== null
      ? matchOrStatus.status
      : matchOrStatus;

  // Covers ABANDONED as well as any future variants such as
  // ABANDONED_LOCKED / MATCH_ABANDONED without relying on exact casing.
  return normalizeMatchStatus(status).includes("ABANDON");
}

export function isMatchEligibleForStats(match) {
  return !isAbandonedMatch(match);
}

export function filterMatchesForStats(matches) {
  return Array.isArray(matches)
    ? matches.filter(isMatchEligibleForStats)
    : [];
}


/**
 * Remove milestone records that belong to statistically ineligible matches.
 *
 * Important:
 * A milestone may have been created while a match was live and valid, then
 * that match may later be marked ABANDONED. In that case the milestone row
 * still exists in PlayerMilestone, but it must no longer appear in career
 * history, Player Journey, My Feed or Player Card achievements.
 *
 * Milestones with no matchId are kept because they are not tied to a specific
 * abandoned match.
 */
export function filterMilestonesForEligibleMatches(
  milestones = [],
  matches = []
) {
  const ineligibleMatchIds =
    new Set(
      matches
        .filter(
          (match) =>
            !isMatchEligibleForStats(
              match
            )
        )
        .map(
          (match) =>
            Number(
              match.id
            )
        )
        .filter(
          Number.isFinite
        )
    );

  return milestones.filter(
    (milestone) => {
      if (
        milestone?.matchId ===
          null ||
        milestone?.matchId ===
          undefined
      ) {
        return true;
      }

      return !ineligibleMatchIds.has(
        Number(
          milestone.matchId
        )
      );
    }
  );
}
