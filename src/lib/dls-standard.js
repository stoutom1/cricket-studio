/*
 * Cric4All D/L Standard Edition support.
 *
 * IMPORTANT:
 * ICC requires the current Stern Edition / ICC DLS Calculator for official
 * top-level DLS calculations. The public table below is the ICC-published
 * D/L Standard Edition fallback table.
 *
 * Cric4All therefore exposes:
 *   1) STANDARD — calculated from the published Standard Edition table.
 *      The published table is over-by-over. Cric4All linearly interpolates
 *      between adjacent table rows so an interruption can be recorded at
 *      any LEGAL-delivery boundary (for example 3.3 overs).
 *   2) OFFICIAL_OVERRIDE — scorer enters a target/par produced by an
 *      official/licensed DLS calculator. This can be used at any ball.
 *
 * Source table: ICC D/L Standard Edition, resource percentages remaining,
 * over-by-over, 50 overs to 0.
 *
 * IMPORTANT:
 * Ball-level interpolation is a Cric4All Standard convenience calculation.
 * It must not be represented as Official DLS / Stern Edition.
 */

export const DLS_STANDARD_G50 = 200;

const RESOURCE = {"50":[100.0,93.4,85.1,74.9,62.7,49.0,34.9,22.0,11.9,4.7],"49":[99.1,92.6,84.5,74.4,62.5,48.9,34.9,22.0,11.9,4.7],"48":[98.1,91.7,83.8,74.0,62.2,48.8,34.9,22.0,11.9,4.7],"47":[97.1,90.9,83.2,73.5,61.9,48.6,34.9,22.0,11.9,4.7],"46":[96.1,90.0,82.5,73.0,61.6,48.5,34.8,22.0,11.9,4.7],"45":[95.0,89.1,81.8,72.5,61.3,48.4,34.8,22.0,11.9,4.7],"44":[93.9,88.2,81.0,72.0,61.0,48.3,34.8,22.0,11.9,4.7],"43":[92.8,87.3,80.3,71.4,60.7,48.1,34.7,22.0,11.9,4.7],"42":[91.7,86.3,79.5,70.9,60.3,47.9,34.7,22.0,11.9,4.7],"41":[90.5,85.3,78.7,70.3,59.9,47.8,34.6,22.0,11.9,4.7],"40":[89.3,84.2,77.8,69.6,59.5,47.6,34.6,22.0,11.9,4.7],"39":[88.0,83.1,76.9,69.0,59.1,47.4,34.5,22.0,11.9,4.7],"38":[86.7,82.0,76.0,68.3,58.7,47.1,34.5,21.9,11.9,4.7],"37":[85.4,80.9,75.0,67.6,58.2,46.9,34.4,21.9,11.9,4.7],"36":[84.1,79.7,74.1,66.8,57.7,46.6,34.3,21.9,11.9,4.7],"35":[82.7,78.5,73.0,66.0,57.2,46.4,34.2,21.9,11.9,4.7],"34":[81.3,77.2,72.0,65.2,56.6,46.1,34.1,21.9,11.9,4.7],"33":[79.8,75.9,70.9,64.4,56.0,45.8,34.0,21.9,11.9,4.7],"32":[78.3,74.6,69.7,63.5,55.4,45.4,33.9,21.9,11.9,4.7],"31":[76.7,73.2,68.6,62.5,54.8,45.1,33.7,21.9,11.9,4.7],"30":[75.1,71.8,67.3,61.6,54.1,44.7,33.6,21.8,11.9,4.7],"29":[73.5,70.3,66.1,60.5,53.4,44.2,33.4,21.8,11.9,4.7],"28":[71.8,68.8,64.8,59.5,52.6,43.8,33.2,21.8,11.9,4.7],"27":[70.1,67.2,63.4,58.4,51.8,43.3,33.0,21.7,11.9,4.7],"26":[68.3,65.6,62.0,57.2,50.9,42.8,32.8,21.7,11.9,4.7],"25":[66.5,63.9,60.5,56.0,50.0,42.2,32.6,21.6,11.9,4.7],"24":[64.6,62.2,59.0,54.7,49.0,41.6,32.3,21.6,11.9,4.7],"23":[62.7,60.4,57.4,53.4,48.0,40.9,32.0,21.5,11.9,4.7],"22":[60.7,58.6,55.8,52.0,47.0,40.2,31.6,21.4,11.9,4.7],"21":[58.7,56.7,54.1,50.6,45.8,39.4,31.2,21.3,11.9,4.7],"20":[56.6,54.8,52.4,49.1,44.6,38.6,30.8,21.2,11.9,4.7],"19":[54.4,52.8,50.5,47.5,43.4,37.7,30.3,21.1,11.9,4.7],"18":[52.2,50.7,48.6,45.9,42.0,36.8,29.8,20.9,11.9,4.7],"17":[49.9,48.5,46.7,44.1,40.6,35.8,29.2,20.7,11.9,4.7],"16":[47.6,46.3,44.7,42.3,39.1,34.7,28.5,20.5,11.8,4.7],"15":[45.2,44.1,42.6,40.5,37.6,33.5,27.8,20.2,11.8,4.7],"14":[42.7,41.7,40.4,38.5,35.9,32.2,27.0,19.9,11.8,4.7],"13":[40.2,39.3,38.1,36.5,34.2,30.8,26.1,19.5,11.7,4.7],"12":[37.6,36.8,35.8,34.3,32.3,29.4,25.1,19.0,11.6,4.7],"11":[34.9,34.2,33.4,32.1,30.4,27.8,24.0,18.5,11.5,4.7],"10":[32.1,31.6,30.8,29.8,28.3,26.1,22.8,17.9,11.4,4.7],"9":[29.3,28.9,28.2,27.4,26.1,24.2,21.4,17.1,11.2,4.7],"8":[26.4,26.0,25.5,24.8,23.8,22.3,19.9,16.2,10.9,4.7],"7":[23.4,23.1,22.7,22.2,21.4,20.1,18.2,15.2,10.5,4.7],"6":[20.3,20.1,19.8,19.4,18.8,17.8,16.4,13.9,10.1,4.6],"5":[17.2,17.0,16.8,16.5,16.1,15.4,14.3,12.5,9.4,4.6],"4":[13.9,13.8,13.7,13.5,13.2,12.7,12.0,10.7,8.4,4.5],"3":[10.6,10.5,10.4,10.3,10.2,9.9,9.5,8.7,7.2,4.2],"2":[7.2,7.1,7.1,7.0,7.0,6.8,6.6,6.2,5.5,3.7],"1":[3.6,3.6,3.6,3.6,3.6,3.5,3.5,3.4,3.2,2.5],"0":[0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0]};

export function normalizeDlsMode(value) {
  return String(value || "")
    .trim()
    .toUpperCase() === "OFFICIAL_OVERRIDE"
    ? "OFFICIAL_OVERRIDE"
    : "STANDARD";
}

export function resourcePercent(oversLeft, wicketsLost) {
  const overs = Number(oversLeft);
  const wickets = Math.max(0, Math.min(9, Number(wicketsLost || 0)));

  if (!Number.isInteger(overs) || overs < 0 || overs > 50) {
    throw new Error(
      "D/L Standard automatic calculation requires a whole number of overs remaining between 0 and 50."
    );
  }

  return Number(RESOURCE[overs]?.[wickets] || 0);
}


/*
 * Return Standard-table resource remaining at an exact LEGAL-ball position.
 *
 * RESOURCE contains whole overs remaining only. For a partial over we linearly
 * interpolate between the surrounding whole-over rows.
 *
 * Example:
 *   4.3 overs remaining = 27 legal balls remaining.
 *   That lies halfway between 4 overs (24 balls) and 5 overs (30 balls).
 *
 * This makes Cric4All Standard usable when rain stops play at 3.1, 3.2,
 * 3.3, etc. It is intentionally labelled Cric4All Standard, not Official DLS.
 */
export function resourcePercentAtBalls(legalBallsLeft, wicketsLost) {
  const balls = Number(legalBallsLeft);

  if (
    !Number.isInteger(balls) ||
    balls < 0 ||
    balls > 50 * 6
  ) {
    throw new Error(
      "D/L Standard automatic calculation requires legal balls remaining between 0 and 300."
    );
  }

  const lowerOvers =
    Math.floor(balls / 6);

  const extraBalls =
    balls % 6;

  if (extraBalls === 0) {
    return resourcePercent(
      lowerOvers,
      wicketsLost
    );
  }

  const upperOvers =
    lowerOvers + 1;

  const lower =
    resourcePercent(
      lowerOvers,
      wicketsLost
    );

  const upper =
    resourcePercent(
      upperOvers,
      wicketsLost
    );

  const fraction =
    extraBalls / 6;

  return Number(
    (
      lower +
      (upper - lower) *
        fraction
    ).toFixed(3)
  );
}

export function calculateTarget({ team1Score, r1, r2, g50 = DLS_STANDARD_G50 }) {
  const S = Number(team1Score || 0);
  const R1 = Number(r1 || 0);
  const R2 = Number(r2 || 0);

  if (!(R1 > 0)) {
    throw new Error("Team 1 resource percentage must be greater than zero.");
  }

  let par;

  if (R2 < R1) {
    par = Math.floor(S * R2 / R1);
  } else if (R2 === R1) {
    par = S;
  } else {
    par = Math.floor(S + ((R2 - R1) * Number(g50 || DLS_STANDARD_G50) / 100));
  }

  return {
    par,
    target: par + 1,
  };
}

export function parseDlsEvent(event) {
  if (!event?.note) return null;

  try {
    return JSON.parse(event.note);
  } catch {
    return null;
  }
}

export function dlsEvents(match) {
  return (match?.events || [])
    .filter((event) =>
      String(event?.eventType || "").startsWith("DLS_")
    )
    .map((event) => ({
      ...event,
      dls: parseDlsEvent(event),
    }))
    .filter((event) => event.dls);
}

export function latestDlsState(match) {
  const events = dlsEvents(match);
  if (!events.length) return null;

  const latest = events[events.length - 1];

  return {
    ...latest.dls,
    eventId: latest.id,
    createdAt: latest.createdAt,
    history: events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      createdAt: event.createdAt,
      ...event.dls,
    })),
  };
}

export function inningsSnapshot(match, inningsNo) {
  const balls = (match?.balls || []).filter(
    (ball) => Number(ball.inningsNo) === Number(inningsNo)
  );

  const legalBalls = balls.filter((ball) => ball.legalDelivery).length;
  const runs = balls.reduce(
    (sum, ball) => sum + Number(ball.totalRuns || 0),
    0
  );
  const wickets = balls.reduce(
    (sum, ball) =>
      sum +
      (
        Number(ball.isWicket || 0) &&
        String(ball.wicketType || "") !== "RETIRED_HURT"
          ? 1
          : 0
      ),
    0
  );

  return { legalBalls, runs, wickets };
}

export function currentAllocation(match, inningsNo) {
  const events = dlsEvents(match)
    .filter((event) => Number(event.inningsNo) === Number(inningsNo))
    .filter((event) => Number(event.dls?.revisedOvers) > 0);

  if (!events.length) {
    return Number(match?.oversPerInnings || 0);
  }

  return Number(events[events.length - 1].dls.revisedOvers);
}

export function resourceAvailableForInnings(match, inningsNo) {
  const originalOvers = Number(match?.oversPerInnings || 0);
  const startingResource = resourcePercent(originalOvers, 0);

  const losses = dlsEvents(match)
    .filter((event) => Number(event.inningsNo) === Number(inningsNo))
    .reduce(
      (sum, event) => sum + Number(event.dls?.resourceLost || 0),
      0
    );

  return Math.max(0, Number((startingResource - losses).toFixed(1)));
}

export function calculateStandardInterruption({
  match,
  inningsNo,
  revisedOvers,
  g50 = DLS_STANDARD_G50,
}) {
  const innings = inningsSnapshot(match, inningsNo);
  const currentOvers = currentAllocation(match, inningsNo);

  /*
   * Keep the exact legal-ball position. Cricket notation 3.3 means
   * 3 overs + 3 balls = 21 legal balls = 3.5 decimal overs for arithmetic.
   */
  const completedBalls =
    innings.legalBalls;

  const completedOvers =
    completedBalls / 6;

  const newOvers = Number(revisedOvers);

  if (!Number.isInteger(newOvers)) {
    throw new Error("Revised overs must be a whole number for Standard mode.");
  }

  if (newOvers < completedOvers) {
    throw new Error(
      `Revised allocation cannot be below ${completedOvers} overs already completed.`
    );
  }

  if (newOvers >= currentOvers) {
    throw new Error(
      `Revised allocation must be lower than the current ${currentOvers} overs.`
    );
  }

  const currentAllocationBalls =
    Math.round(
      currentOvers * 6
    );

  const revisedAllocationBalls =
    Math.round(
      newOvers * 6
    );

  const beforeRemainingBalls =
    Math.max(
      currentAllocationBalls -
        completedBalls,
      0
    );

  const afterRemainingBalls =
    Math.max(
      revisedAllocationBalls -
        completedBalls,
      0
    );

  const beforeRemaining =
    beforeRemainingBalls / 6;

  const afterRemaining =
    afterRemainingBalls / 6;

  const beforeResource =
    resourcePercentAtBalls(
      beforeRemainingBalls,
      innings.wickets
    );

  const afterResource =
    resourcePercentAtBalls(
      afterRemainingBalls,
      innings.wickets
    );

  const resourceLost =
    Number(
      (
        beforeResource -
        afterResource
      ).toFixed(1)
    );

  const originalStartResource = resourcePercent(
    Number(match.oversPerInnings),
    0
  );

  const previousLosses = dlsEvents(match)
    .filter((event) => Number(event.inningsNo) === Number(inningsNo))
    .reduce(
      (sum, event) => sum + Number(event.dls?.resourceLost || 0),
      0
    );

  const resourceAvailable = Number(
    (originalStartResource - previousLosses - resourceLost).toFixed(1)
  );

  let target = null;
  let par = null;
  let r1 = resourceAvailableForInnings(match, 1);
  let r2 = inningsNo === 2
    ? resourceAvailable
    : null;

  if (Number(inningsNo) === 2) {
    const first = inningsSnapshot(match, 1);
    const targetInfo = calculateTarget({
      team1Score: first.runs,
      r1,
      r2,
      g50,
    });
    target = targetInfo.target;
    par = targetInfo.par;
  }

  return {
    mode: "STANDARD",
    inningsNo: Number(inningsNo),
    completedOvers,
    completedBalls,
    wickets: innings.wickets,
    runs: innings.runs,
    previousOvers: currentOvers,
    revisedOvers: newOvers,
    beforeRemaining,
    afterRemaining,
    beforeResource,
    afterResource,
    resourceLost,
    resourceAvailable,
    r1,
    r2,
    target,
    par,
    g50: Number(g50),
  };
}

export function calculateTermination({ match, g50 = DLS_STANDARD_G50 }) {
  const second = inningsSnapshot(match, 2);
  const allocation = currentAllocation(match, 2);
  const remainingBalls = Math.max(
    allocation * 6 - second.legalBalls,
    0
  );

  /*
   * Standard termination is also ball-aware. The remaining resource is
   * interpolated from the public whole-over Standard table at the exact
   * legal-delivery boundary where play stopped.
   *
   * Match/competition minimum-overs eligibility is a separate rule and
   * should be enforced by the match-ending workflow, not by rounding this
   * resource calculation to a completed over.
   */
  const remainingOvers =
    remainingBalls / 6;

  const remainingResource =
    resourcePercentAtBalls(
      remainingBalls,
      second.wickets
    );

  const r1 = resourceAvailableForInnings(match, 1);
  const r2BeforeTermination = resourceAvailableForInnings(match, 2);
  const r2AtTermination = Number(
    Math.max(0, r2BeforeTermination - remainingResource).toFixed(1)
  );

  const first = inningsSnapshot(match, 1);
  const result = calculateTarget({
    team1Score: first.runs,
    r1,
    r2: r2AtTermination,
    g50,
  });

  return {
    ...result,
    r1,
    r2: r2AtTermination,
    score: second.runs,
    wickets: second.wickets,
    legalBalls: second.legalBalls,
    remainingResource,
  };
}
