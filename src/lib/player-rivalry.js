/* =========================================================
   CRIC4ALL — CANONICAL PLAYER RIVALRY ENGINE

   Product rules:
   - ESTABLISHED RIVALRY is career-level and must be identical wherever it
     is shown (My Feed / Player Journey / Compare qualification).
   - NOTABLE MATCHUP may come from one strong batting spell and belongs to
     Compare Players, not the permanent career-rival label.
   - Surprise 1 + Surprise 2 duplicate player identities can be merged by
     passing the page's existing identityKey(player) function.
   ========================================================= */

function number(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function matchCountFrom(candidate) {
  const matchIds =
    candidate?.matchIds ||
    candidate?.matches ||
    candidate?.encounters;

  if (matchIds instanceof Set) {
    return matchIds.size;
  }

  if (Array.isArray(matchIds)) {
    return new Set(matchIds).size;
  }

  return number(
    candidate?.matchCount ??
      candidate?.encounterCount ??
      candidate?.matches
  );
}

function normalizeMatchIds(candidate) {
  const source =
    candidate?.matchIds ||
    candidate?.matches ||
    candidate?.encounters;

  if (source instanceof Set) {
    return new Set(source);
  }

  if (Array.isArray(source)) {
    return new Set(source);
  }

  return new Set();
}

export function isEstablishedRivalry({
  matches,
  balls,
  dismissals,
}) {
  const matchCount = number(matches);
  const legalBalls = number(balls);
  const directDismissals = number(dismissals);

  return (
    (
      matchCount >= 2 &&
      legalBalls >= 6
    ) ||
    directDismissals >= 2
  );
}

export function isNotableBattingMatchup({
  matches,
  balls,
  runs,
  dismissals,
}) {
  if (
    isEstablishedRivalry({
      matches,
      balls,
      dismissals,
    })
  ) {
    return false;
  }

  return (
    number(balls) >= 8 ||
    number(runs) >= 20
  );
}

export function rivalryEvidenceConfidence({
  matches,
  balls,
  dismissals,
}) {
  const confidence =
    Math.min(
      number(balls) / 18,
      1
    ) * 0.5 +
    Math.min(
      number(matches) / 4,
      1
    ) * 0.3 +
    Math.min(
      number(dismissals) / 3,
      1
    ) * 0.2;

  return Math.min(
    1,
    Math.max(0, confidence)
  );
}

export function establishedRivalryScore({
  matches,
  balls,
  dismissals,
}) {
  const confidence =
    rivalryEvidenceConfidence({
      matches,
      balls,
      dismissals,
    });

  /*
   * Runs are intentionally NOT part of the established-rival score.
   * A single explosive batting spell belongs to Notable Matchup. A career
   * rivalry is ranked by repeated direct evidence and dismissals.
   */
  const baseScore =
    number(balls) +
    number(dismissals) * 22 +
    number(matches) * 6;

  return (
    baseScore *
    (
      0.55 +
      confidence * 0.45
    )
  );
}

function stablePlayerId(candidate) {
  return number(
    candidate?.playerId ??
      candidate?.player?.id
  );
}

function mergeCandidates({
  candidates,
  getIdentityKey,
}) {
  const grouped = new Map();

  for (const candidate of candidates || []) {
    const player = candidate?.player;

    if (!player) {
      continue;
    }

    const fallbackKey =
      `player:${stablePlayerId(candidate)}`;

    const key =
      getIdentityKey?.(player) ||
      fallbackKey;

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        player,
        playerId: stablePlayerId(candidate),
        playerIds: new Set(),
        matchIds: new Set(),
        balls: 0,
        runs: 0,
        dismissals: 0,
      });
    }

    const row = grouped.get(key);
    const candidatePlayerId =
      stablePlayerId(candidate);

    if (candidatePlayerId) {
      row.playerIds.add(candidatePlayerId);

      /* Stable representative/canonical link target. */
      if (
        !row.playerId ||
        candidatePlayerId < row.playerId
      ) {
        row.playerId = candidatePlayerId;
        row.player = player;
      }
    }

    for (
      const matchId of
      normalizeMatchIds(candidate)
    ) {
      row.matchIds.add(matchId);
    }

    row.balls += number(candidate.balls);
    row.runs += number(candidate.runs);
    row.dismissals += number(
      candidate.dismissals ??
        candidate.wickets
    );
  }

  return Array.from(grouped.values());
}

export function buildEstablishedRivalries({
  candidates,
  getIdentityKey,
}) {
  return mergeCandidates({
    candidates,
    getIdentityKey,
  })
    .map((row) => {
      const matchCount = row.matchIds.size;
      const isEstablished =
        isEstablishedRivalry({
          matches: matchCount,
          balls: row.balls,
          dismissals: row.dismissals,
        });

      const evidenceConfidence =
        rivalryEvidenceConfidence({
          matches: matchCount,
          balls: row.balls,
          dismissals: row.dismissals,
        });

      const rivalryScore =
        establishedRivalryScore({
          matches: matchCount,
          balls: row.balls,
          dismissals: row.dismissals,
        });

      return {
        ...row,
        matchCount,
        encounters: matchCount,
        wickets: row.dismissals,
        isEstablished,
        evidenceConfidence,
        confidence: evidenceConfidence,
        rivalryScore,
        score: rivalryScore,
      };
    })
    .filter(
      (row) =>
        row.isEstablished
    )
    .sort(
      (left, right) =>
        right.rivalryScore -
          left.rivalryScore ||
        right.matchCount -
          left.matchCount ||
        right.dismissals -
          left.dismissals ||
        right.balls -
          left.balls ||
        left.playerId -
          right.playerId
    );
}

export function selectTopEstablishedRival(options) {
  return (
    buildEstablishedRivalries(options)[0] ||
    null
  );
}

export function isEstablishedDirectRivalry({
  matches,
  totalBalls,
  totalDismissals,
}) {
  return (
    (
      number(matches) >= 2 &&
      number(totalBalls) >= 12
    ) ||
    number(totalDismissals) >= 2
  );
}
