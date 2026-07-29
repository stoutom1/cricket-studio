function clamp(value, minimum = 0, maximum = 100) {
  return Math.min(
    maximum,
    Math.max(minimum, value)
  );
}

function lowerIsBetter(
  value,
  ideal,
  worst
) {
  if (!Number.isFinite(Number(value))) {
    return 0;
  }

  if (value <= ideal) return 100;
  if (value >= worst) return 0;

  return (
    ((worst - value) /
      (worst - ideal)) *
    100
  );
}

function higherIsBetter(
  value,
  minimum,
  excellent
) {
  if (!Number.isFinite(Number(value))) {
    return 0;
  }

  if (value <= minimum) return 0;
  if (value >= excellent) return 100;

  return (
    ((value - minimum) /
      (excellent - minimum)) *
    100
  );
}

function weightedScore(items) {
  const totalWeight = items.reduce(
    (sum, item) => sum + item.weight,
    0
  );

  if (!totalWeight) return 0;

  const total = items.reduce(
    (sum, item) =>
      sum + item.score * item.weight,
    0
  );

  return Number(
    (total / totalWeight).toFixed(2)
  );
}

function battingScores(row) {
  const sampleConfidence = clamp(
    higherIsBetter(row.balls, 12, 100)
  );

  const opener = weightedScore([
    {
      score: higherIsBetter(
        row.powerplayStrikeRate,
        65,
        150
      ),
      weight: 25,
    },
    {
      score: higherIsBetter(
        row.average,
        5,
        35
      ),
      weight: 20,
    },
    {
      score: lowerIsBetter(
        row.dotBallPct,
        20,
        70
      ),
      weight: 18,
    },
    {
      score: higherIsBetter(
        row.boundaryPct,
        3,
        25
      ),
      weight: 15,
    },
    {
      score: higherIsBetter(
        row.recentStrikeRate,
        60,
        155
      ),
      weight: 12,
    },
    {
      score: sampleConfidence,
      weight: 10,
    },
  ]);

  const anchor = weightedScore([
    {
      score: higherIsBetter(
        row.average,
        5,
        40
      ),
      weight: 35,
    },
    {
      score: higherIsBetter(
        row.middleStrikeRate,
        60,
        135
      ),
      weight: 18,
    },
    {
      score: lowerIsBetter(
        row.dotBallPct,
        18,
        65
      ),
      weight: 17,
    },
    {
      score: higherIsBetter(
        row.innings,
        2,
        18
      ),
      weight: 15,
    },
    {
      score: sampleConfidence,
      weight: 15,
    },
  ]);

  const finisher = weightedScore([
    {
      score: higherIsBetter(
        row.deathStrikeRate,
        70,
        190
      ),
      weight: 38,
    },
    {
      score: higherIsBetter(
        row.boundaryPct,
        4,
        30
      ),
      weight: 22,
    },
    {
      score: lowerIsBetter(
        row.dotBallPct,
        15,
        65
      ),
      weight: 18,
    },
    {
      score: higherIsBetter(
        row.recentStrikeRate,
        65,
        180
      ),
      weight: 12,
    },
    {
      score: sampleConfidence,
      weight: 10,
    },
  ]);

  return {
    opener,
    anchor,
    finisher,
    confidence: sampleConfidence,
  };
}

function bowlingScores(row) {
  const sampleConfidence = clamp(
    higherIsBetter(
      row.legalBalls,
      12,
      120
    )
  );

  const control = lowerIsBetter(
    row.disciplinePct,
    1,
    18
  );

  const powerplay = weightedScore([
    {
      score: lowerIsBetter(
        row.powerplayEconomy || row.economy,
        4,
        12
      ),
      weight: 30,
    },
    {
      score: higherIsBetter(
        row.powerplayWickets,
        0,
        8
      ),
      weight: 23,
    },
    {
      score: higherIsBetter(
        row.dotBallPct,
        20,
        65
      ),
      weight: 22,
    },
    {
      score: control,
      weight: 15,
    },
    {
      score: sampleConfidence,
      weight: 10,
    },
  ]);

  const middle = weightedScore([
    {
      score: lowerIsBetter(
        row.middleEconomy || row.economy,
        4,
        11
      ),
      weight: 30,
    },
    {
      score: higherIsBetter(
        row.middleWickets,
        0,
        10
      ),
      weight: 28,
    },
    {
      score: higherIsBetter(
        row.dotBallPct,
        20,
        65
      ),
      weight: 20,
    },
    {
      score: control,
      weight: 12,
    },
    {
      score: sampleConfidence,
      weight: 10,
    },
  ]);

  const death = weightedScore([
    {
      score: lowerIsBetter(
        row.deathEconomy || row.economy,
        5,
        15
      ),
      weight: 37,
    },
    {
      score: higherIsBetter(
        row.deathWickets,
        0,
        8
      ),
      weight: 25,
    },
    {
      score: higherIsBetter(
        row.dotBallPct,
        15,
        55
      ),
      weight: 15,
    },
    {
      score: control,
      weight: 15,
    },
    {
      score: sampleConfidence,
      weight: 8,
    },
  ]);

  return {
    powerplay,
    middle,
    death,
    confidence: sampleConfidence,
  };
}

function explainBatter(player, role) {
  const metrics = player.metrics;

  if (role === "Opener") {
    return [
      `Powerplay strike rate ${metrics.powerplayStrikeRate}`,
      `Overall average ${metrics.average}`,
      `Dot-ball rate ${metrics.dotBallPct}%`,
    ];
  }

  if (role === "Anchor") {
    return [
      `Batting average ${metrics.average}`,
      `Middle-overs strike rate ${metrics.middleStrikeRate}`,
      `${metrics.innings} recorded innings`,
    ];
  }

  if (role === "Finisher") {
    return [
      `Death-overs strike rate ${metrics.deathStrikeRate}`,
      `Boundary rate ${metrics.boundaryPct}%`,
      `Recent strike rate ${metrics.recentStrikeRate}`,
    ];
  }

  return [
    `Strike rate ${metrics.strikeRate}`,
    `Average ${metrics.average}`,
  ];
}

function explainBowler(player, phase) {
  const metrics = player.metrics;

  if (phase === "POWERPLAY") {
    return [
      `Powerplay economy ${metrics.powerplayEconomy}`,
      `${metrics.powerplayWickets} powerplay wickets`,
      `Dot-ball rate ${metrics.dotBallPct}%`,
    ];
  }

  if (phase === "DEATH") {
    return [
      `Death economy ${metrics.deathEconomy}`,
      `${metrics.deathWickets} death-over wickets`,
      `Discipline rate ${metrics.disciplinePct}%`,
    ];
  }

  return [
    `Middle-overs economy ${metrics.middleEconomy}`,
    `${metrics.middleWickets} middle-over wickets`,
    `Overall economy ${metrics.economy}`,
  ];
}

function assignBattingOrder(battingMetrics) {
  const evaluated = battingMetrics.map(
    (metrics) => ({
      playerId: metrics.playerId,
      playerName: metrics.playerName,
      metrics,
      ...battingScores(metrics),
    })
  );

  const unused = new Map(
    evaluated.map((item) => [
      item.playerId,
      item,
    ])
  );

  const order = [];

  function takeBest(scoreName, role) {
    const candidate = [...unused.values()]
      .sort(
        (first, second) =>
          second[scoreName] -
          first[scoreName]
      )[0];

    if (!candidate) return;

    unused.delete(candidate.playerId);

    order.push({
      playerId: candidate.playerId,
      playerName: candidate.playerName,
      position: order.length + 1,
      role,
      score: candidate[scoreName],
      confidence: candidate.confidence,
      reasons: explainBatter(
        candidate,
        role
      ),
    });
  }

  takeBest("opener", "Opener");
  takeBest("opener", "Opener");
  takeBest("anchor", "Top-order anchor");

  if (unused.size) {
    takeBest("anchor", "Middle-order anchor");
  }

  const remaining = [...unused.values()].sort(
    (first, second) =>
      second.finisher - first.finisher
  );

  for (const candidate of remaining) {
    order.push({
      playerId: candidate.playerId,
      playerName: candidate.playerName,
      position: order.length + 1,
      role:
        order.length >= battingMetrics.length - 2
          ? "Finisher"
          : "Middle-order aggressor",
      score:
        order.length >= battingMetrics.length - 2
          ? candidate.finisher
          : Math.max(
              candidate.anchor,
              candidate.finisher
            ),
      confidence: candidate.confidence,
      reasons: explainBatter(
        candidate,
        order.length >=
          battingMetrics.length - 2
          ? "Finisher"
          : "Flexible"
      ),
    });
  }

  return order;
}

function allocateBowlingOvers(
  bowlingMetrics,
  oversPerInnings
) {
  const maximumPerBowler = Math.max(
    1,
    Math.ceil(oversPerInnings / 5)
  );

  const evaluated = bowlingMetrics
    .map((metrics) => ({
      playerId: metrics.playerId,
      playerName: metrics.playerName,
      metrics,
      ...bowlingScores(metrics),
    }))
    .filter(
      (player) =>
        player.metrics.legalBalls > 0
    );

  if (!evaluated.length) {
    return {
      overPlan: [],
      bowlers: [],
      warnings: [
        "No historical bowling data is available for the selected team.",
      ],
    };
  }

  const allocations = new Map(
    evaluated.map((player) => [
      player.playerId,
      0,
    ])
  );

  const overPlan = [];

  const powerplayEnd = Math.max(
    1,
    Math.ceil(oversPerInnings * 0.3)
  );

  const deathStart = Math.max(
    powerplayEnd + 1,
    Math.floor(oversPerInnings * 0.75) + 1
  );

  for (
    let over = 1;
    over <= oversPerInnings;
    over += 1
  ) {
    const phase =
      over <= powerplayEnd
        ? "POWERPLAY"
        : over >= deathStart
        ? "DEATH"
        : "MIDDLE";

    const scoreField =
      phase === "POWERPLAY"
        ? "powerplay"
        : phase === "DEATH"
        ? "death"
        : "middle";

    const candidates = evaluated
      .filter(
        (player) =>
          allocations.get(player.playerId) <
          maximumPerBowler
      )
      .filter((player) => {
        const previous =
          overPlan[overPlan.length - 1];

        if (!previous) return true;

        if (
          evaluated.length <= 2
        ) {
          return true;
        }

        return (
          previous.playerId !==
          player.playerId
        );
      })
      .sort((first, second) => {
        const allocationPenalty =
          (allocations.get(first.playerId) -
            allocations.get(second.playerId)) *
          8;

        return (
          second[scoreField] -
          first[scoreField] +
          allocationPenalty
        );
      });

    const selected =
      candidates[0] ||
      evaluated
        .filter(
          (player) =>
            allocations.get(
              player.playerId
            ) < maximumPerBowler
        )
        .sort(
          (first, second) =>
            second[scoreField] -
            first[scoreField]
        )[0];

    if (!selected) {
      break;
    }

    allocations.set(
      selected.playerId,
      allocations.get(selected.playerId) + 1
    );

    overPlan.push({
      over,
      phase,
      playerId: selected.playerId,
      playerName: selected.playerName,
      score: selected[scoreField],
      confidence: selected.confidence,
      reasons: explainBowler(
        selected,
        phase
      ),
    });
  }

  const bowlers = evaluated
    .map((player) => ({
      playerId: player.playerId,
      playerName: player.playerName,
      allocatedOvers:
        allocations.get(player.playerId),
      powerplayScore: player.powerplay,
      middleScore: player.middle,
      deathScore: player.death,
      confidence: player.confidence,
    }))
    .filter(
      (player) => player.allocatedOvers > 0
    )
    .sort(
      (first, second) =>
        second.allocatedOvers -
        first.allocatedOvers
    );

  const warnings = evaluated
    .filter(
      (player) =>
        player.metrics.legalBalls < 18
    )
    .map(
      (player) =>
        `${player.playerName} has fewer than 3 overs of historical bowling data.`
    );

  return {
    overPlan,
    bowlers,
    warnings,
  };
}

export function generateStrategy({
  battingMetrics,
  bowlingMetrics,
  oversPerInnings,
}) {
  const overs = Math.max(
    1,
    Number(oversPerInnings) || 20
  );

  const battingOrder =
    assignBattingOrder(battingMetrics);

  const bowling =
    allocateBowlingOvers(
      bowlingMetrics,
      overs
    );

  const weakBattingSamples =
    battingMetrics
      .filter((player) => player.balls < 12)
      .map(
        (player) =>
          `${player.playerName} has faced fewer than 12 recorded balls.`
      );

  return {
    battingOrder,
    bowlingPlan: bowling.overPlan,
    bowlingAllocations: bowling.bowlers,

    scenarioPlan: [
      {
        situation:
          "Early wicket in the first 30% of overs",
        recommendation:
          "Send the highest-ranked available anchor.",
      },
      {
        situation:
          "Required run rate becomes very high",
        recommendation:
          "Promote the highest-ranked available finisher.",
      },
      {
        situation:
          "Bowler takes a wicket while conceding six runs or fewer",
        recommendation:
          "Consider continuing the spell, subject to over limits.",
      },
      {
        situation:
          "Death overs begin",
        recommendation:
          "Preserve overs from the two highest-ranked death bowlers.",
      },
    ],

    warnings: [
      ...weakBattingSamples,
      ...bowling.warnings,
    ],

    generatedAt:
      new Date().toISOString(),
  };
}