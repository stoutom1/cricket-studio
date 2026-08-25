/* =========================================================
   CRIC4ALL — CANONICAL PLAYER RIVALRY ENGINE

   Product rules:
   - ESTABLISHED RIVALRY is career-level and must be identical wherever it
     is shown (My Feed / Player Journey / Compare qualification).
   - EMERGING MATCHUP highlights meaningful early head-to-head evidence
     without promoting a tiny sample into a permanent career rivalry.
   - NOTABLE BATTING MATCHUP may come from one exceptional batting spell
     and belongs to Compare Players, not the permanent career-rival label.
   - Player reputation, role labels, or Cric4All ratings never determine
     rivalry. Only recorded direct head-to-head evidence does.
   - Surprise Cricket League duplicate player identities can be merged by
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

/*
 * Career-level rivalry requires BOTH recurrence and a meaningful amount of
 * direct interaction. Two dismissals in three balls across two matches are
 * important, but they are an emerging matchup — not yet an established
 * career rivalry.
 *
 * Established when:
 *   A) >= 3 direct matches AND >= 12 legal balls, OR
 *   B) >= 3 direct matches AND >= 2 dismissals AND >= 6 legal balls.
 */
export function isEstablishedRivalry({
  matches,
  balls,
  dismissals,
}) {
  const matchCount = number(matches);
  const legalBalls = number(balls);
  const directDismissals = number(dismissals);

  if (matchCount < 3) {
    return false;
  }

  return (
    legalBalls >= 12 ||
    (
      directDismissals >= 2 &&
      legalBalls >= 6
    )
  );
}

/*
 * Emerging matchup: repeated direct evidence exists, but the sample has not
 * reached career-rivalry strength. This tier is useful in Compare Players
 * and matchup panels without polluting "Biggest established rival".
 */
export function isEmergingRivalry({
  matches,
  balls,
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

  const matchCount = number(matches);
  const legalBalls = number(balls);
  const directDismissals = number(dismissals);

  return (
    (
      matchCount >= 2 &&
      legalBalls >= 6
    ) ||
    (
      matchCount >= 2 &&
      directDismissals >= 2 &&
      legalBalls >= 3
    )
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

  /*
   * A one-off batting spell may still be worth surfacing as "notable",
   * but it is intentionally not a career rivalry.
   */
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
      number(balls) / 24,
      1
    ) * 0.5 +
    Math.min(
      number(matches) / 4,
      1
    ) * 0.35 +
    Math.min(
      number(dismissals) / 3,
      1
    ) * 0.15;

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
   * Established-rival ranking prioritizes recurrence and sample strength.
   * Dismissals remain important, but cannot overpower a tiny sample because
   * qualification already requires recurrence + minimum legal balls.
   */
  const baseScore =
    number(matches) * 10 +
    number(balls) * 1.25 +
    number(dismissals) * 14;

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
        right.balls -
          left.balls ||
        right.dismissals -
          left.dismissals ||
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

/*
 * Direct two-player rivalry considers both batting directions together.
 * It intentionally uses a slightly larger total-ball threshold because the
 * sample is pooled across both directions.
 */
export function isEstablishedDirectRivalry({
  matches,
  totalBalls,
  totalDismissals,
}) {
  const matchCount = number(matches);
  const balls = number(totalBalls);
  const dismissals = number(totalDismissals);

  if (matchCount < 3) {
    return false;
  }

  return (
    balls >= 18 ||
    (
      dismissals >= 2 &&
      balls >= 8
    )
  );
}

export function isEmergingDirectRivalry({
  matches,
  totalBalls,
  totalDismissals,
}) {
  if (
    isEstablishedDirectRivalry({
      matches,
      totalBalls,
      totalDismissals,
    })
  ) {
    return false;
  }

  const matchCount = number(matches);
  const balls = number(totalBalls);
  const dismissals = number(totalDismissals);

  return (
    (
      matchCount >= 2 &&
      balls >= 8
    ) ||
    (
      matchCount >= 2 &&
      dismissals >= 2 &&
      balls >= 3
    )
  );
}
