function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentage(part, total) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

function safeDivide(first, second) {
  if (!second) return 0;
  return first / second;
}

function isLegalBall(ball) {
  const extraType = String(
    ball?.extraType || "NONE"
  ).toUpperCase();

  return (
    extraType !== "WIDE" &&
    extraType !== "NOBALL" &&
    extraType !== "NO_BALL"
  );
}

function isBowlerWicket(ball) {
  if (!ball?.isWicket) return false;

  const wicketType = String(
    ball?.wicketType || ""
  ).toUpperCase();

  return ![
    "RUN_OUT",
    "RETIRED_OUT",
    "RETIRED_HURT",
    "OBSTRUCTING_THE_FIELD",
  ].includes(wicketType);
}

function runsChargedToBowler(ball) {
  const extraType = String(
    ball?.extraType || "NONE"
  ).toUpperCase();

  if (
    extraType === "BYE" ||
    extraType === "LEGBYE" ||
    extraType === "LEG_BYE"
  ) {
    return number(ball?.runsOffBat);
  }

  return (
    number(ball?.runsOffBat) +
    number(ball?.extras)
  );
}

function getPhase(overNumber, oversPerInnings) {
  const overs = Math.max(
    1,
    number(oversPerInnings)
  );

  const over = Math.max(
    1,
    number(overNumber)
  );

  const powerplayEnd = Math.max(
    1,
    Math.ceil(overs * 0.3)
  );

  const deathStart = Math.max(
    powerplayEnd + 1,
    Math.floor(overs * 0.75) + 1
  );

  if (over <= powerplayEnd) {
    return "POWERPLAY";
  }

  if (over >= deathStart) {
    return "DEATH";
  }

  return "MIDDLE";
}

function newBattingMetrics(player) {
  return {
    playerId: Number(player.id),
    playerName: player.playerName || player.name,

    innings: 0,
    runs: 0,
    balls: 0,
    dismissals: 0,
    fours: 0,
    sixes: 0,
    dots: 0,

    powerplayRuns: 0,
    powerplayBalls: 0,
    middleRuns: 0,
    middleBalls: 0,
    deathRuns: 0,
    deathBalls: 0,

    recentRuns: 0,
    recentBalls: 0,
    recentDismissals: 0,
  };
}

function newBowlingMetrics(player) {
  return {
    playerId: Number(player.id),
    playerName: player.playerName || player.name,

    legalBalls: 0,
    runsConceded: 0,
    wickets: 0,
    dots: 0,
    wides: 0,
    noBalls: 0,

    powerplayBalls: 0,
    powerplayRuns: 0,
    powerplayWickets: 0,

    middleBalls: 0,
    middleRuns: 0,
    middleWickets: 0,

    deathBalls: 0,
    deathRuns: 0,
    deathWickets: 0,

    recentBalls: 0,
    recentRuns: 0,
    recentWickets: 0,
  };
}

export function buildStrategyMetrics({
  players,
  balls,
  oversPerInnings,
  recentMatchIds = [],
}) {
  const batting = new Map();
  const bowling = new Map();

  for (const player of players) {
    const id = Number(player.id);

    batting.set(
      id,
      newBattingMetrics(player)
    );

    bowling.set(
      id,
      newBowlingMetrics(player)
    );
  }

  const inningsSeen = new Map();
  const recentIds = new Set(
    recentMatchIds.map(Number)
  );

  for (const ball of balls) {
    const strikerId = Number(ball.strikerId);
    const bowlerId = Number(ball.bowlerId);
    const matchId = Number(ball.matchId);
    const inningsNo = Number(ball.inningsNo || 1);
    const legal = isLegalBall(ball);

    const overNumber =
      Number(ball.overNumber) ||
      Number(ball.overNo) ||
      Math.floor(number(ball.sequence) / 6) + 1;

    const phase = getPhase(
      overNumber,
      oversPerInnings
    );

    const batter = batting.get(strikerId);

    if (batter) {
      const inningsKey =
        `${matchId}:${inningsNo}:${strikerId}`;

      if (!inningsSeen.has(inningsKey)) {
        inningsSeen.set(inningsKey, true);
        batter.innings += 1;
      }

      const runs = number(ball.runsOffBat);

      batter.runs += runs;

      if (legal) {
        batter.balls += 1;

        if (runs === 0) {
          batter.dots += 1;
        }
      }

      if (runs === 4) {
        batter.fours += 1;
      }

      if (runs === 6) {
        batter.sixes += 1;
      }

      if (phase === "POWERPLAY") {
        batter.powerplayRuns += runs;
        if (legal) batter.powerplayBalls += 1;
      }

      if (phase === "MIDDLE") {
        batter.middleRuns += runs;
        if (legal) batter.middleBalls += 1;
      }

      if (phase === "DEATH") {
        batter.deathRuns += runs;
        if (legal) batter.deathBalls += 1;
      }

      if (recentIds.has(matchId)) {
        batter.recentRuns += runs;
        if (legal) batter.recentBalls += 1;
      }
    }

    const dismissedPlayerId = Number(
      ball.dismissedPlayerId
    );

    const dismissedBatter =
      batting.get(dismissedPlayerId);

    if (
      ball.isWicket &&
      dismissedBatter &&
      String(ball.wicketType || "").toUpperCase() !==
        "RETIRED_HURT"
    ) {
      dismissedBatter.dismissals += 1;

      if (recentIds.has(matchId)) {
        dismissedBatter.recentDismissals += 1;
      }
    }

    const bowler = bowling.get(bowlerId);

    if (bowler) {
      const chargedRuns =
        runsChargedToBowler(ball);

      bowler.runsConceded += chargedRuns;

      if (legal) {
        bowler.legalBalls += 1;

        if (chargedRuns === 0) {
          bowler.dots += 1;
        }
      }

      const extraType = String(
        ball.extraType || "NONE"
      ).toUpperCase();

      if (extraType === "WIDE") {
        bowler.wides += number(ball.extras) || 1;
      }

      if (
        extraType === "NOBALL" ||
        extraType === "NO_BALL"
      ) {
        bowler.noBalls += 1;
      }

      const bowlerWicket =
        isBowlerWicket(ball);

      if (bowlerWicket) {
        bowler.wickets += 1;
      }

      if (phase === "POWERPLAY") {
        if (legal) bowler.powerplayBalls += 1;
        bowler.powerplayRuns += chargedRuns;
        if (bowlerWicket) {
          bowler.powerplayWickets += 1;
        }
      }

      if (phase === "MIDDLE") {
        if (legal) bowler.middleBalls += 1;
        bowler.middleRuns += chargedRuns;
        if (bowlerWicket) {
          bowler.middleWickets += 1;
        }
      }

      if (phase === "DEATH") {
        if (legal) bowler.deathBalls += 1;
        bowler.deathRuns += chargedRuns;
        if (bowlerWicket) {
          bowler.deathWickets += 1;
        }
      }

      if (recentIds.has(matchId)) {
        if (legal) bowler.recentBalls += 1;
        bowler.recentRuns += chargedRuns;

        if (bowlerWicket) {
          bowler.recentWickets += 1;
        }
      }
    }
  }

  const battingRows = [...batting.values()].map(
    (row) => ({
      ...row,

      average: Number(
        safeDivide(
          row.runs,
          row.dismissals || row.innings || 1
        ).toFixed(2)
      ),

      strikeRate: Number(
        (
          safeDivide(row.runs, row.balls) * 100
        ).toFixed(2)
      ),

      dotBallPct: percentage(
        row.dots,
        row.balls
      ),

      boundaryPct: percentage(
        row.fours + row.sixes,
        row.balls
      ),

      powerplayStrikeRate: Number(
        (
          safeDivide(
            row.powerplayRuns,
            row.powerplayBalls
          ) * 100
        ).toFixed(2)
      ),

      middleStrikeRate: Number(
        (
          safeDivide(
            row.middleRuns,
            row.middleBalls
          ) * 100
        ).toFixed(2)
      ),

      deathStrikeRate: Number(
        (
          safeDivide(
            row.deathRuns,
            row.deathBalls
          ) * 100
        ).toFixed(2)
      ),

      recentStrikeRate: Number(
        (
          safeDivide(
            row.recentRuns,
            row.recentBalls
          ) * 100
        ).toFixed(2)
      ),
    })
  );

  const bowlingRows = [...bowling.values()].map(
    (row) => {
      const overs =
        row.legalBalls / 6;

      return {
        ...row,

        overs: Number(overs.toFixed(1)),

        economy: Number(
          safeDivide(
            row.runsConceded,
            overs
          ).toFixed(2)
        ),

        bowlingAverage: Number(
          safeDivide(
            row.runsConceded,
            row.wickets
          ).toFixed(2)
        ),

        strikeRate: Number(
          safeDivide(
            row.legalBalls,
            row.wickets
          ).toFixed(2)
        ),

        dotBallPct: percentage(
          row.dots,
          row.legalBalls
        ),

        powerplayEconomy: Number(
          safeDivide(
            row.powerplayRuns,
            row.powerplayBalls / 6
          ).toFixed(2)
        ),

        middleEconomy: Number(
          safeDivide(
            row.middleRuns,
            row.middleBalls / 6
          ).toFixed(2)
        ),

        deathEconomy: Number(
          safeDivide(
            row.deathRuns,
            row.deathBalls / 6
          ).toFixed(2)
        ),

        recentEconomy: Number(
          safeDivide(
            row.recentRuns,
            row.recentBalls / 6
          ).toFixed(2)
        ),

        disciplinePct: percentage(
          row.wides + row.noBalls,
          Math.max(row.legalBalls, 1)
        ),
      };
    }
  );

  return {
    batting: battingRows,
    bowling: bowlingRows,
  };
}