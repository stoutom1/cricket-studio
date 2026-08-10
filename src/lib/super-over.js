/*
 * Cric4All Super Over engine.
 *
 * Storage model:
 * Super Over deliveries are stored as MatchEvent rows rather than Ball rows.
 *
 * WHY:
 * - A Super Over decides the result of a tied match.
 * - Super Over batting/bowling figures must not leak into the player's
 *   normal match/career statistics.
 * - No Prisma migration is required because MatchEvent already exists.
 *
 * Event types:
 * SUPER_OVER_START
 * SUPER_OVER_SETUP
 * SUPER_OVER_BALL
 * SUPER_OVER_UNDO
 * SUPER_OVER_INNINGS_END
 * SUPER_OVER_ROUND_TIED
 * SUPER_OVER_RESULT
 */

export const SUPER_OVER_PREFIX = "SUPER_OVER_";

export function parseSuperOverNote(note) {
  if (!note) return null;

  try {
    return JSON.parse(note);
  } catch {
    return null;
  }
}

export function getSuperOverEvents(match) {
  return (match?.events || [])
    .filter((event) =>
      String(event?.eventType || "")
        .toUpperCase()
        .startsWith(SUPER_OVER_PREFIX)
    )
    .map((event) => ({
      ...event,
      data: parseSuperOverNote(event.note),
    }))
    .filter((event) => event.data);
}

export function isLegalSuperOverDelivery(extraType) {
  const type = String(extraType || "NONE").toUpperCase();
  return type !== "WIDE" && type !== "NOBALL";
}

export function formatSuperOverBalls(legalBalls = 0) {
  const balls = Number(legalBalls || 0);
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function roundEvents(events, round) {
  return events.filter(
    (event) => Number(event.data?.round) === Number(round)
  );
}

function activeBallEvents(events, round, innings) {
  const target = roundEvents(events, round).filter(
    (event) =>
      Number(event.data?.superInnings) === Number(innings)
  );

  const undoneIds = new Set(
    target
      .filter((event) => event.eventType === "SUPER_OVER_UNDO")
      .map((event) => Number(event.data?.ballEventId))
      .filter(Number.isFinite)
  );

  return target.filter(
    (event) =>
      event.eventType === "SUPER_OVER_BALL" &&
      !undoneIds.has(Number(event.id))
  );
}

function buildInnings(events, round, superInnings) {
  const setupEvent =
    [...roundEvents(events, round)]
      .reverse()
      .find(
        (event) =>
          event.eventType === "SUPER_OVER_SETUP" &&
          Number(event.data?.superInnings) === Number(superInnings)
      );

  const setup = setupEvent?.data || null;
  const balls = activeBallEvents(events, round, superInnings);

  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;

  let strikerId = setup?.batter1Id || null;
  let nonStrikerId = setup?.batter2Id || null;
  const thirdBatterId = setup?.batter3Id || null;

  let thirdBatterUsed = false;

  for (const event of balls) {
    const ball = event.data;

    runs += Number(ball.totalRuns || 0);

    if (ball.legalDelivery) {
      legalBalls += 1;
    }

    if (ball.isWicket) {
      wickets += 1;

      if (wickets < 2 && thirdBatterId && !thirdBatterUsed) {
        strikerId = thirdBatterId;
        thirdBatterUsed = true;
      }
    } else if (Number(ball.totalRuns || 0) % 2 === 1) {
      [strikerId, nonStrikerId] = [
        nonStrikerId,
        strikerId,
      ];
    }

    if (
      ball.legalDelivery &&
      legalBalls > 0 &&
      legalBalls % 6 === 0 &&
      wickets < 2
    ) {
      [strikerId, nonStrikerId] = [
        nonStrikerId,
        strikerId,
      ];
    }
  }

  return {
    superInnings: Number(superInnings),
    setup,
    balls,
    runs,
    wickets,
    legalBalls,
    overs: formatSuperOverBalls(legalBalls),
    strikerId,
    nonStrikerId,
    bowlerId: setup?.bowlerId || null,
    thirdBatterId,
    thirdBatterUsed,
    complete:
      legalBalls >= 6 ||
      wickets >= 2,
  };
}

export function buildSuperOverState(match) {
  const events = getSuperOverEvents(match);

  const starts = events.filter(
    (event) => event.eventType === "SUPER_OVER_START"
  );

  if (!starts.length) {
    return {
      exists: false,
      active: false,
      completed: false,
      round: 0,
      history: [],
    };
  }

  const start = starts[starts.length - 1];
  const round = Number(start.data?.round || starts.length);

  const first = buildInnings(events, round, 1);
  const second = buildInnings(events, round, 2);

  const resultEvent =
    [...roundEvents(events, round)]
      .reverse()
      .find((event) => event.eventType === "SUPER_OVER_RESULT");

  const tieEvent =
    [...roundEvents(events, round)]
      .reverse()
      .find((event) => event.eventType === "SUPER_OVER_ROUND_TIED");

  const secondTarget = first.runs + 1;

  const secondChaseComplete =
    Boolean(second.setup) &&
    second.runs >= secondTarget;

  const firstComplete = first.complete;
  const secondComplete =
    second.complete || secondChaseComplete;

  let currentSuperInnings = 1;

  if (firstComplete) {
    currentSuperInnings = 2;
  }

  if (resultEvent || tieEvent) {
    currentSuperInnings = 0;
  }

  const history = starts.map((roundStart) => {
    const r = Number(roundStart.data?.round || 1);
    const r1 = buildInnings(events, r, 1);
    const r2 = buildInnings(events, r, 2);

    const final =
      [...roundEvents(events, r)]
        .reverse()
        .find((event) =>
          [
            "SUPER_OVER_RESULT",
            "SUPER_OVER_ROUND_TIED",
          ].includes(event.eventType)
        );

    return {
      round: r,
      firstBattingTeamId:
        Number(roundStart.data?.firstBattingTeamId),
      secondBattingTeamId:
        Number(roundStart.data?.secondBattingTeamId),
      first: r1,
      second: r2,
      result: final?.data || null,
      tied: final?.eventType === "SUPER_OVER_ROUND_TIED",
      completed:
        final?.eventType === "SUPER_OVER_RESULT",
    };
  });

  return {
    exists: true,
    active: !resultEvent && !tieEvent,
    completed: Boolean(resultEvent),
    tied: Boolean(tieEvent),
    round,
    currentSuperInnings,
    firstBattingTeamId:
      Number(start.data?.firstBattingTeamId),
    secondBattingTeamId:
      Number(start.data?.secondBattingTeamId),
    first,
    second,
    target:
      firstComplete ? secondTarget : null,
    winnerTeamId:
      resultEvent?.data?.winnerTeamId || null,
    resultText:
      resultEvent?.data?.resultText ||
      tieEvent?.data?.resultText ||
      null,
    history,
  };
}

export function isMainMatchTied(match) {
  const innings1 = (match?.balls || []).filter(
    (ball) => Number(ball.inningsNo) === 1
  );

  const innings2 = (match?.balls || []).filter(
    (ball) => Number(ball.inningsNo) === 2
  );

  const runs = (balls) =>
    balls.reduce(
      (sum, ball) => sum + Number(ball.totalRuns || 0),
      0
    );

  const firstRuns = runs(innings1);
  const secondRuns = runs(innings2);

  const persisted = String(match?.statusText || "").toUpperCase();

  return (
    (
      innings1.length > 0 &&
      innings2.length > 0 &&
      firstRuns === secondRuns
    ) ||
    (
      persisted.includes("TIED") &&
      (
        persisted.includes("DLS") ||
        persisted.includes("MATCH")
      )
    )
  );
}
