import {
  shouldExcludePlayerFromLeagueAnalytics,
} from "@/lib/player-analytics-exclusions";
import {
  buildPublicMatchResult,
} from "@/lib/public-match-result";

const COMPLETED_STATUSES =
  new Set([
    "COMPLETED",
    "COMPLETED_LOCKED",
    "COMPLETED_CORRECTED",
  ]);

function normalizeStatus(
  value
) {
  return String(
    value ||
    ""
  )
    .trim()
    .replace(
      /([a-z])([A-Z])/g,
      "$1_$2"
    )
    .replace(
      /[\s-]+/g,
      "_"
    )
    .toUpperCase();
}

function playerKey(
  playerId,
  playerName
) {
  const numericId =
    Number(
      playerId
    );

  if (
    Number.isInteger(
      numericId
    ) &&
    numericId > 0
  ) {
    return `id:${numericId}`;
  }

  return `name:${String(
    playerName ||
    ""
  )
    .trim()
    .toLowerCase()}`;
}

function wicketsForBowler(
  ball
) {
  if (!ball?.isWicket) {
    return 0;
  }

  const wicketType =
    String(
      ball.wicketType ||
      ""
    )
      .trim()
      .toUpperCase();

  if (
    [
      "RUN_OUT",
      "RETIRED_OUT",
      "RETIRED_HURT",
    ].includes(
      wicketType
    )
  ) {
    return 0;
  }

  if (
    String(
      ball.extraType ||
      ""
    )
      .trim()
      .toUpperCase() ===
    "NOBALL"
  ) {
    return 0;
  }

  return 1;
}

function runsChargedToBowler(
  ball
) {
  const extraType =
    String(
      ball?.extraType ||
      ""
    )
      .trim()
      .toUpperCase();

  if (
    [
      "BYE",
      "LEGBYE",
    ].includes(
      extraType
    )
  ) {
    return 0;
  }

  /*
   * totalRuns is the safest source when present because Cric4All already
   * records the no-ball/wide value there. Older balls can fall back to the
   * individual fields.
   */
  if (
    ball?.totalRuns !==
      null &&
    ball?.totalRuns !==
      undefined
  ) {
    return Number(
      ball.totalRuns ||
      0
    );
  }

  return (
    Number(
      ball?.runsOffBat ||
      0
    ) +
    Number(
      ball?.extras ||
      0
    )
  );
}

function createPlayerRow({
  playerId,
  playerName,
  teamId,
  teamName,
}) {
  return {
    playerId,
    playerName:
      playerName ||
      "Player",
    teamId:
      teamId ||
      null,
    teamName:
      teamName ||
      "",
    matches: 1,

    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,

    bowlingBalls: 0,
    bowlingRuns: 0,
    wickets: 0,
    dots: 0,

    catches: 0,
    runOuts: 0,
    stumpings: 0,
    assists: 0,

    lateRuns: 0,
    lateWickets: 0,
    lateFielding: 0,
  };
}

function getRoster(
  match
) {
  const players =
    [
      ...(match?.teamA?.players ||
        []),
      ...(match?.teamB?.players ||
        []),
    ];

  const map =
    new Map();

  players.forEach(
    (player) => {
      map.set(
        Number(
          player.id
        ),
        {
          playerId:
            Number(
              player.id
            ),
          playerName:
            player.name ||
            `Player ${player.id}`,
          teamId:
            Number(
              player.teamId
            ) ||
            null,
          teamName:
            Number(
              player.teamId
            ) ===
            Number(
              match?.teamA?.id
            )
              ? match
                  ?.teamA
                  ?.name ||
                ""
              : Number(
                    player.teamId
                  ) ===
                  Number(
                    match
                      ?.teamB
                      ?.id
                  )
                ? match
                    ?.teamB
                    ?.name ||
                  ""
                : player
                    ?.team
                    ?.name ||
                  "",
        }
      );
    }
  );

  return map;
}

function getPlayer(
  roster,
  playerId
) {
  const numericId =
    Number(
      playerId
    );

  return (
    roster.get(
      numericId
    ) || {
      playerId:
        numericId ||
        null,
      playerName:
        numericId
          ? `Player ${numericId}`
          : "Player",
      teamId:
        null,
      teamName:
        "",
    }
  );
}

function ensurePlayer(
  playerStats,
  roster,
  league,
  playerId
) {
  const player =
    getPlayer(
      roster,
      playerId
    );

  if (
    shouldExcludePlayerFromLeagueAnalytics(
      league,
      player.playerName
    )
  ) {
    return null;
  }

  const key =
    playerKey(
      player.playerId,
      player.playerName
    );

  if (
    !playerStats.has(
      key
    )
  ) {
    playerStats.set(
      key,
      createPlayerRow(
        player
      )
    );
  }

  return playerStats.get(
    key
  );
}

function sortBalls(
  balls
) {
  return [
    ...(balls ||
      []),
  ].sort(
    (a, b) =>
      Number(
        a.inningsNo ||
          0
      ) -
        Number(
          b.inningsNo ||
            0
        ) ||
      Number(
        a.sequence ||
          0
      ) -
        Number(
          b.sequence ||
            0
        ) ||
      Number(
        a.id ||
          0
      ) -
        Number(
          b.id ||
            0
        )
  );
}

function buildPartnerships({
  balls,
  roster,
  league,
}) {
  const partnerships =
    [];
  const currentByInnings =
    new Map();

  function finish(
    inningsNo
  ) {
    const current =
      currentByInnings.get(
        inningsNo
      );

    if (
      current &&
      current.runs > 0 &&
      current.playerNames
        .length === 2
    ) {
      partnerships.push(
        current
      );
    }

    currentByInnings.delete(
      inningsNo
    );
  }

  for (const ball of balls) {
    const inningsNo =
      Number(
        ball.inningsNo ||
          1
      );

    const striker =
      getPlayer(
        roster,
        ball.strikerId
      );
    const nonStriker =
      getPlayer(
        roster,
        ball.nonStrikerId
      );

    const names =
      [
        striker,
        nonStriker,
      ]
        .filter(
          (player) =>
            player?.playerId &&
            !shouldExcludePlayerFromLeagueAnalytics(
              league,
              player.playerName
            )
        )
        .map(
          (player) => ({
            id:
              Number(
                player.playerId
              ),
            name:
              player.playerName,
          })
        );

    if (
      names.length !== 2
    ) {
      continue;
    }

    const pairKey =
      names
        .map(
          (player) =>
            player.id
        )
        .sort(
          (a, b) =>
            a - b
        )
        .join(":");

    let current =
      currentByInnings.get(
        inningsNo
      );

    if (
      !current ||
      current.pairKey !==
        pairKey
    ) {
      finish(
        inningsNo
      );

      current = {
        inningsNo,
        pairKey,
        playerNames:
          names.map(
            (player) =>
              player.name
          ),
        teamName:
          striker.teamName ||
          nonStriker.teamName ||
          "",
        runs: 0,
        balls: 0,
      };

      currentByInnings.set(
        inningsNo,
        current
      );
    }

    current.runs +=
      Number(
        ball.totalRuns ||
          0
      );

    if (
      ball.legalDelivery
    ) {
      current.balls +=
        1;
    }

    if (
      ball.isWicket &&
      String(
        ball.wicketType ||
        ""
      )
        .trim()
        .toUpperCase() !==
        "RETIRED_HURT"
    ) {
      finish(
        inningsNo
      );
    }
  }

  for (
    const inningsNo
    of currentByInnings.keys()
  ) {
    finish(
      inningsNo
    );
  }

  return partnerships.sort(
    (a, b) =>
      b.runs -
        a.runs ||
      b.balls -
        a.balls
  );
}

function buildOverMoments(
  balls
) {
  const inningsState =
    new Map();
  const overs =
    new Map();

  for (const ball of balls) {
    const inningsNo =
      Number(
        ball.inningsNo ||
          1
      );

    if (
      !inningsState.has(
        inningsNo
      )
    ) {
      inningsState.set(
        inningsNo,
        {
          legalBalls:
            0,
        }
      );
    }

    const state =
      inningsState.get(
        inningsNo
      );

    const overNumber =
      Math.floor(
        state.legalBalls /
          6
      ) +
      1;

    const key =
      `${inningsNo}:${overNumber}`;

    if (
      !overs.has(
        key
      )
    ) {
      overs.set(
        key,
        {
          inningsNo,
          overNumber,
          runs: 0,
          wickets: 0,
          boundaries: 0,
        }
      );
    }

    const over =
      overs.get(
        key
      );

    over.runs +=
      Number(
        ball.totalRuns ||
          0
      );

    if (
      ball.isWicket &&
      String(
        ball.wicketType ||
        ""
      )
        .trim()
        .toUpperCase() !==
        "RETIRED_HURT"
    ) {
      over.wickets +=
        1;
    }

    if (
      [
        4,
        6,
      ].includes(
        Number(
          ball.runsOffBat ||
            0
        )
      )
    ) {
      over.boundaries +=
        1;
    }

    if (
      ball.legalDelivery
    ) {
      state.legalBalls +=
        1;
    }
  }

  return [
    ...overs.values(),
  ].sort(
    (a, b) => {
      const aScore =
        a.wickets *
          20 +
        a.boundaries *
          4 +
        a.runs;

      const bScore =
        b.wickets *
          20 +
        b.boundaries *
          4 +
        b.runs;

      return (
        bScore -
          aScore ||
        b.wickets -
          a.wickets ||
        b.runs -
          a.runs
      );
    }
  );
}

function buildStory({
  match,
  resultText,
  bestBatter,
  bestBowler,
  bestPartnership,
  turningPoint,
}) {
  const pieces =
    [];

  if (resultText) {
    pieces.push(
      resultText.endsWith(
        "."
      )
        ? resultText
        : `${resultText}.`
    );
  }

  if (
    bestBatter &&
    bestBatter.runs > 0
  ) {
    pieces.push(
      `${bestBatter.playerName} led the batting with ${bestBatter.runs} from ${bestBatter.balls} ball${
        bestBatter.balls ===
        1
          ? ""
          : "s"
      }.`
    );
  }

  if (
    bestBowler &&
    bestBowler.wickets > 0
  ) {
    pieces.push(
      `${bestBowler.playerName} made the biggest bowling impact with ${bestBowler.wickets}/${bestBowler.bowlingRuns}.`
    );
  }

  if (
    bestPartnership &&
    bestPartnership.runs > 0
  ) {
    pieces.push(
      `${bestPartnership.playerNames.join(
        " & "
      )} added the match's best partnership of ${bestPartnership.runs}.`
    );
  }

  if (
    turningPoint
  ) {
    const overLabel =
      `over ${turningPoint.overNumber}`;

    if (
      turningPoint.wickets >
      0
    ) {
      pieces.push(
        `A key passage came in ${overLabel} of innings ${turningPoint.inningsNo}, when ${turningPoint.wickets} wicket${
          turningPoint.wickets ===
          1
            ? ""
            : "s"
        } fell for ${turningPoint.runs} run${
          turningPoint.runs ===
          1
            ? ""
            : "s"
        }.`
      );
    } else if (
      turningPoint.runs >=
      12
    ) {
      pieces.push(
        `The scoring accelerated in ${overLabel} of innings ${turningPoint.inningsNo}, which produced ${turningPoint.runs} runs.`
      );
    }
  }

  if (
    pieces.length <= 1
  ) {
    pieces.push(
      `${match?.teamA?.name || "Team A"} and ${match?.teamB?.name || "Team B"} completed the match with the scorecard preserved in Cric4All.`
    );
  }

  return pieces.join(
    " "
  );
}

function award({
  key,
  icon,
  title,
  player,
  value,
  subtitle,
  explanation,
}) {
  return {
    key,
    icon,
    title,
    playerName:
      player?.playerName ||
      "",
    teamName:
      player?.teamName ||
      "",
    value:
      value ||
      "—",
    subtitle:
      subtitle ||
      "",
    explanation:
      explanation ||
      "",
    available:
      Boolean(
        player
      ),
  };
}

export function buildPostMatchExperience({
  match,
  league,
}) {
  const status =
    normalizeStatus(
      match?.status
    );

  if (
    !COMPLETED_STATUSES.has(
      status
    )
  ) {
    return null;
  }

  const balls =
    sortBalls(
      match?.balls ||
      []
    );

  if (!balls.length) {
    return null;
  }

  const roster =
    getRoster(
      match
    );
  const playerStats =
    new Map();

  /*
   * Mark the last 12 legal balls of each innings. This is used only for the
   * Clutch Performer award; it never changes career/player statistics.
   */
  const inningsLegalBallCounts =
    new Map();

  balls.forEach(
    (ball) => {
      if (
        ball.legalDelivery
      ) {
        const inningsNo =
          Number(
            ball.inningsNo ||
              1
          );

        inningsLegalBallCounts.set(
          inningsNo,
          Number(
            inningsLegalBallCounts.get(
              inningsNo
            ) ||
              0
          ) +
            1
        );
      }
    }
  );

  const legalSeen =
    new Map();

  for (const ball of balls) {
    const inningsNo =
      Number(
        ball.inningsNo ||
          1
      );

    const totalLegal =
      Number(
        inningsLegalBallCounts.get(
          inningsNo
        ) ||
          0
      );

    const beforeLegal =
      Number(
        legalSeen.get(
          inningsNo
        ) ||
          0
      );

    const lateWindow =
      totalLegal > 0 &&
      beforeLegal >=
        Math.max(
          totalLegal -
            12,
          0
        );

    const striker =
      ensurePlayer(
        playerStats,
        roster,
        league,
        ball.strikerId
      );

    if (striker) {
      const runs =
        Number(
          ball.runsOffBat ||
            0
        );

      striker.runs +=
        runs;

      if (
        ball.extraType !==
          "WIDE" &&
        ball.extraType !==
          "NOBALL" &&
        ball.wicketType !==
          "RETIRED_HURT"
      ) {
        striker.balls +=
          1;
      }

      if (
        runs === 4
      ) {
        striker.fours +=
          1;
      }

      if (
        runs === 6
      ) {
        striker.sixes +=
          1;
      }

      if (lateWindow) {
        striker.lateRuns +=
          runs;
      }
    }

    const bowler =
      ensurePlayer(
        playerStats,
        roster,
        league,
        ball.bowlerId
      );

    if (bowler) {
      const wicketCredit =
        wicketsForBowler(
          ball
        );

      bowler.bowlingRuns +=
        runsChargedToBowler(
          ball
        );
      bowler.wickets +=
        wicketCredit;

      if (
        ball.legalDelivery
      ) {
        bowler.bowlingBalls +=
          1;

        if (
          Number(
            ball.totalRuns ||
              0
          ) === 0
        ) {
          bowler.dots +=
            1;
        }
      }

      if (lateWindow) {
        bowler.lateWickets +=
          wicketCredit;
      }
    }

    const fielder =
      ensurePlayer(
        playerStats,
        roster,
        league,
        ball.fielderId
      );

    const wicketType =
      String(
        ball.wicketType ||
        ""
      )
        .trim()
        .toUpperCase();

    if (fielder) {
      let contribution =
        0;

      if (
        wicketType ===
        "CAUGHT"
      ) {
        fielder.catches +=
          1;
        contribution = 1;
      } else if (
        wicketType ===
        "RUN_OUT"
      ) {
        fielder.runOuts +=
          1;
        contribution = 1;
      } else if (
        wicketType ===
        "STUMPED"
      ) {
        fielder.stumpings +=
          1;
        contribution = 1;
      }

      if (
        lateWindow
      ) {
        fielder.lateFielding +=
          contribution;
      }
    }

    if (
      wicketType ===
      "RUN_OUT"
    ) {
      const assistant =
        ensurePlayer(
          playerStats,
          roster,
          league,
          ball.assistantFielderId
        );

      if (assistant) {
        assistant.assists +=
          1;

        if (
          lateWindow
        ) {
          assistant.lateFielding +=
            1;
        }
      }
    }

    if (
      ball.legalDelivery
    ) {
      legalSeen.set(
        inningsNo,
        beforeLegal +
          1
      );
    }
  }

  const rows =
    [
      ...playerStats.values(),
    ].map(
      (row) => {
        const fieldingTotal =
          Number(
            row.catches ||
              0
          ) +
          Number(
            row.runOuts ||
              0
          ) +
          Number(
            row.stumpings ||
              0
          ) +
          Number(
            row.assists ||
              0
          );

        const strikeRate =
          row.balls > 0
            ? (
                (row.runs /
                  row.balls) *
                100
              ).toFixed(
                1
              )
            : "0.0";

        const economy =
          row.bowlingBalls >
          0
            ? (
                (row.bowlingRuns /
                  row.bowlingBalls) *
                6
              ).toFixed(
                2
              )
            : "0.00";

        const impactScore =
          Number(
            row.runs ||
              0
          ) +
          Number(
            row.wickets ||
              0
          ) *
            25 +
          Number(
            row.catches ||
              0
          ) *
            10 +
          Number(
            row.runOuts ||
              0
          ) *
            10 +
          Number(
            row.stumpings ||
              0
          ) *
            10 +
          Number(
            row.assists ||
              0
          ) *
            5;

        const playerOfMatchScore =
          Number(
            row.runs ||
              0
          ) +
          Number(
            row.wickets ||
              0
          ) *
            25 +
          fieldingTotal *
            8 +
          Number(
            row.fours ||
              0
          ) *
            1 +
          Number(
            row.sixes ||
              0
          ) *
            2;

        const clutchScore =
          Number(
            row.lateRuns ||
              0
          ) +
          Number(
            row.lateWickets ||
              0
          ) *
            25 +
          Number(
            row.lateFielding ||
              0
          ) *
            10;

        return {
          ...row,
          fieldingTotal,
          strikeRate,
          economy,
          impactScore,
          playerOfMatchScore,
          clutchScore,
          overs:
            `${Math.floor(
              row.bowlingBalls /
                6
            )}.${row.bowlingBalls % 6}`,
        };
      }
    );

  const bestBatter =
    [...rows]
      .filter(
        (row) =>
          row.runs > 0
      )
      .sort(
        (a, b) =>
          b.runs -
            a.runs ||
          Number(
            b.strikeRate
          ) -
            Number(
              a.strikeRate
            )
      )[0] ||
    null;

  const bestBowler =
    [...rows]
      .filter(
        (row) =>
          row.wickets > 0
      )
      .sort(
        (a, b) =>
          b.wickets -
            a.wickets ||
          Number(
            a.economy
          ) -
            Number(
              b.economy
            )
      )[0] ||
    null;

  const bestFielder =
    [...rows]
      .filter(
        (row) =>
          row.fieldingTotal >
          0
      )
      .sort(
        (a, b) =>
          b.fieldingTotal -
            a.fieldingTotal ||
          b.catches -
            a.catches
      )[0] ||
    null;

  const impactPlayer =
    [...rows]
      .filter(
        (row) =>
          row.impactScore >
          0
      )
      .sort(
        (a, b) =>
          b.impactScore -
          a.impactScore
      )[0] ||
    null;

  const playerOfMatch =
    [...rows]
      .filter(
        (row) =>
          row.playerOfMatchScore >
          0
      )
      .sort(
        (a, b) =>
          b.playerOfMatchScore -
          a.playerOfMatchScore
      )[0] ||
    null;

  const clutchPerformer =
    [...rows]
      .filter(
        (row) =>
          row.clutchScore >
          0
      )
      .sort(
        (a, b) =>
          b.clutchScore -
          a.clutchScore
      )[0] ||
    null;

  const partnerships =
    buildPartnerships({
      balls,
      roster,
      league,
    });

  const bestPartnership =
    partnerships[0] ||
    null;

  const overMoments =
    buildOverMoments(
      balls
    );

  const turningPoint =
    overMoments.find(
      (over) =>
        over.wickets >
          0 ||
        over.runs >=
          12
    ) ||
    null;

  const resultText =
    buildPublicMatchResult(
      match
    );

  const story =
    buildStory({
      match,
      resultText,
      bestBatter,
      bestBowler,
      bestPartnership,
      turningPoint,
    });

  const awards =
    [
      award({
        key:
          "PLAYER_OF_MATCH",
        icon:
          "🏆",
        title:
          "Player of the Match",
        player:
          playerOfMatch,
        value:
          playerOfMatch
            ? `${playerOfMatch.playerOfMatchScore} impact`
            : "—",
        subtitle:
          playerOfMatch
            ? `${playerOfMatch.runs} runs · ${playerOfMatch.wickets} wickets · ${playerOfMatch.fieldingTotal} fielding`
            : "",
        explanation:
          "Match impact combines batting production, bowler-credited wickets, boundaries and fielding contributions.",
      }),

      award({
        key:
          "BEST_BATTER",
        icon:
          "🏏",
        title:
          "Best Batter",
        player:
          bestBatter,
        value:
          bestBatter
            ? `${bestBatter.runs} runs`
            : "—",
        subtitle:
          bestBatter
            ? `${bestBatter.balls} balls · SR ${bestBatter.strikeRate}`
            : "",
        explanation:
          "Highest run scorer, with strike rate used as the tie-breaker.",
      }),

      award({
        key:
          "BEST_BOWLER",
        icon:
          "🎯",
        title:
          "Best Bowler",
        player:
          bestBowler,
        value:
          bestBowler
            ? `${bestBowler.wickets}/${bestBowler.bowlingRuns}`
            : "—",
        subtitle:
          bestBowler
            ? `${bestBowler.overs} overs · Econ ${bestBowler.economy}`
            : "",
        explanation:
          "Most bowler-credited wickets, with economy used as the tie-breaker. Run-outs and retired dismissals are not credited to the bowler.",
      }),

      award({
        key:
          "BEST_FIELDER",
        icon:
          "🧤",
        title:
          "Best Fielder",
        player:
          bestFielder,
        value:
          bestFielder
            ? `${bestFielder.fieldingTotal} contributions`
            : "—",
        subtitle:
          bestFielder
            ? `${bestFielder.catches} catches · ${bestFielder.runOuts} run-outs · ${bestFielder.stumpings} stumpings · ${bestFielder.assists} assists`
            : "",
        explanation:
          "Total catches, run-outs, stumpings and recorded run-out assists.",
      }),

      award({
        key:
          "IMPACT_PLAYER",
        icon:
          "🌟",
        title:
          "Impact Player",
        player:
          impactPlayer,
        value:
          impactPlayer
            ? `${impactPlayer.impactScore} pts`
            : "—",
        subtitle:
          impactPlayer
            ? `${impactPlayer.runs} runs · ${impactPlayer.wickets} wickets · ${impactPlayer.fieldingTotal} fielding`
            : "",
        explanation:
          "Cric4All impact: runs + 25 per wicket + 10 per catch/run-out/stumping + 5 per assist.",
      }),

      award({
        key:
          "CLUTCH_PERFORMER",
        icon:
          "🔥",
        title:
          "Clutch Performer",
        player:
          clutchPerformer,
        value:
          clutchPerformer
            ? `${clutchPerformer.clutchScore} clutch pts`
            : "—",
        subtitle:
          clutchPerformer
            ? `${clutchPerformer.lateRuns} late runs · ${clutchPerformer.lateWickets} late wickets · ${clutchPerformer.lateFielding} late fielding`
            : "",
        explanation:
          "Impact recorded during the final 12 legal deliveries of each innings.",
      }),
    ].filter(
      (item) =>
        item.available
    );

  return {
    resultText,
    story,
    awards,
    bestPartnership,
    turningPoint,
  };
}
