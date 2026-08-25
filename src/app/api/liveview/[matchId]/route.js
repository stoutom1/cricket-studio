import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  ballShortText,
  getBattingTeamId,
  summarizeInningsDetailed,
  buildMatchStats
} from "@/lib/scoring";
import { buildSuperOverView } from "@/lib/super-over-view";
import {
  currentAllocation,
  latestDlsState,
} from "@/lib/dls-standard";

function normalizeLiveWicketType(
  value
) {
  return String(
    value ||
    ""
  )
    .trim()
    .toUpperCase();
}

function isBowlerCreditedLiveWicket(
  ball
) {
  if (!ball?.isWicket) {
    return false;
  }

  const wicketType =
    normalizeLiveWicketType(
      ball.wicketType
    );

  if (
    [
      "RUN_OUT",
      "RETIRED_OUT",
      "RETIRED_HURT",
    ].includes(
      wicketType
    )
  ) {
    return false;
  }

  return (
    String(
      ball.extraType ||
      ""
    )
      .trim()
      .toUpperCase() !==
    "NOBALL"
  );
}

function buildLiveBroadcastIntelligence({
  currentInningsBalls,
  currentSummary,
  playerMap,
}) {
  const currentState =
    currentSummary?.currentState ||
    null;

  if (
    !currentState ||
    !currentInningsBalls?.length
  ) {
    return null;
  }

  const strikerId =
    Number(
      currentState.strikerId
    ) ||
    null;

  const bowlerId =
    Number(
      currentState.bowlerId
    ) ||
    null;

  const currentPartnership =
    [
      ...(currentSummary?.partnerships ||
        []),
    ]
      .reverse()
      .find(
        (row) =>
          row?.ongoing
      ) ||
    null;

  let matchupRuns =
    0;
  let matchupBalls =
    0;
  let matchupDismissals =
    0;

  if (
    strikerId &&
    bowlerId
  ) {
    for (
      const ball
      of currentInningsBalls
    ) {
      if (
        Number(
          ball.strikerId
        ) !==
          strikerId ||
        Number(
          ball.bowlerId
        ) !==
          bowlerId
      ) {
        continue;
      }

      matchupRuns +=
        Number(
          ball.runsOffBat ||
          0
        );

      if (
        Boolean(
          ball.legalDelivery
        ) &&
        String(
          ball.extraType ||
          ""
        )
          .trim()
          .toUpperCase() !==
          "WIDE" &&
        String(
          ball.extraType ||
          ""
        )
          .trim()
          .toUpperCase() !==
          "NOBALL"
      ) {
        matchupBalls +=
          1;
      }

      if (
        Number(
          ball.dismissedPlayerId
        ) ===
          strikerId &&
        isBowlerCreditedLiveWicket(
          ball
        )
      ) {
        matchupDismissals +=
          1;
      }
    }
  }

  const legalRecent =
    [
      ...currentInningsBalls,
    ]
      .reverse()
      .filter(
        (ball) =>
          Boolean(
            ball.legalDelivery
          )
      )
      .slice(
        0,
        18
      );

  const phaseRuns =
    legalRecent.reduce(
      (sum, ball) =>
        sum +
        Number(
          ball.totalRuns ||
          0
        ),
      0
    );

  const phaseWickets =
    legalRecent.reduce(
      (sum, ball) =>
        sum +
        (
          ball.isWicket &&
          normalizeLiveWicketType(
            ball.wicketType
          ) !==
            "RETIRED_HURT"
            ? 1
            : 0
        ),
      0
    );

  const phaseBoundaries =
    legalRecent.reduce(
      (sum, ball) =>
        sum +
        (
          [
            4,
            6,
          ].includes(
            Number(
              ball.runsOffBat ||
              0
            )
          )
            ? 1
            : 0
        ),
      0
    );

  let phaseLabel =
    "Balanced phase";
  let phaseTone =
    "balanced";

  if (
    legalRecent.length >=
      6 &&
    (
      phaseWickets >=
        2 ||
      phaseRuns <=
        Math.ceil(
          legalRecent.length *
            0.65
        )
    )
  ) {
    phaseLabel =
      "Bowling pressure";
    phaseTone =
      "bowling";
  } else if (
    legalRecent.length >=
      6 &&
    (
      phaseRuns >=
        Math.ceil(
          legalRecent.length *
            1.35
        ) ||
      phaseBoundaries >=
        3
    )
  ) {
    phaseLabel =
      "Batting surge";
    phaseTone =
      "batting";
  }

  function nextBattingMilestone(
    runs
  ) {
    const milestones =
      [
        50,
        100,
        150,
        200,
      ];

    return milestones.find(
      (target) =>
        Number(
          runs ||
          0
        ) <
        target
    ) ||
    null;
  }

  function nextBowlingMilestone(
    wickets
  ) {
    const milestones =
      [
        3,
        5,
      ];

    return milestones.find(
      (target) =>
        Number(
          wickets ||
          0
        ) <
        target
    ) ||
    null;
  }

  const milestoneCandidates =
    [];

  const strikerRuns =
    Number(
      currentState
        ?.strikerStats
        ?.runs ||
        0
    );

  const strikerTarget =
    nextBattingMilestone(
      strikerRuns
    );

  if (
    strikerId &&
    strikerTarget &&
    strikerTarget -
      strikerRuns <=
      15
  ) {
    milestoneCandidates.push({
      type:
        "batting",
      icon:
        "🏏",
      playerId:
        strikerId,
      playerName:
        currentState.strikerName ||
        playerMap
          ?.get(
            strikerId
          )
          ?.name ||
        "Batter",
      current:
        strikerRuns,
      target:
        strikerTarget,
      remaining:
        strikerTarget -
        strikerRuns,
      label:
        `${strikerTarget} runs`,
    });
  }

  const nonStrikerId =
    Number(
      currentState.nonStrikerId
    ) ||
    null;

  const nonStrikerRuns =
    Number(
      currentState
        ?.nonStrikerStats
        ?.runs ||
        0
    );

  const nonStrikerTarget =
    nextBattingMilestone(
      nonStrikerRuns
    );

  if (
    nonStrikerId &&
    nonStrikerTarget &&
    nonStrikerTarget -
      nonStrikerRuns <=
      15
  ) {
    milestoneCandidates.push({
      type:
        "batting",
      icon:
        "🏏",
      playerId:
        nonStrikerId,
      playerName:
        currentState.nonStrikerName ||
        playerMap
          ?.get(
            nonStrikerId
          )
          ?.name ||
        "Batter",
      current:
        nonStrikerRuns,
      target:
        nonStrikerTarget,
      remaining:
        nonStrikerTarget -
        nonStrikerRuns,
      label:
        `${nonStrikerTarget} runs`,
    });
  }

  const bowlerWickets =
    Number(
      currentState
        ?.bowlerStats
        ?.wickets ||
        0
    );

  const bowlerTarget =
    nextBowlingMilestone(
      bowlerWickets
    );

  if (
    bowlerId &&
    bowlerTarget &&
    bowlerTarget -
      bowlerWickets <=
      2
  ) {
    milestoneCandidates.push({
      type:
        "bowling",
      icon:
        "🎯",
      playerId:
        bowlerId,
      playerName:
        currentState.bowlerName ||
        playerMap
          ?.get(
            bowlerId
          )
          ?.name ||
        "Bowler",
      current:
        bowlerWickets,
      target:
        bowlerTarget,
      remaining:
        bowlerTarget -
        bowlerWickets,
      label:
        `${bowlerTarget} wickets`,
    });
  }

  milestoneCandidates.sort(
    (a, b) =>
      a.remaining -
        b.remaining ||
      a.playerName.localeCompare(
        b.playerName
      )
  );

  return {
    partnership:
      currentPartnership
        ? {
            batter1:
              currentPartnership.batter1,
            batter2:
              currentPartnership.batter2,
            runs:
              Number(
                currentPartnership.runs ||
                0
              ),
            balls:
              Number(
                currentPartnership.balls ||
                0
              ),
          }
        : null,

    matchup:
      strikerId &&
      bowlerId
        ? {
            batterId:
              strikerId,
            batterName:
              currentState.strikerName ||
              playerMap
                ?.get(
                  strikerId
                )
                ?.name ||
              "Batter",
            bowlerId,
            bowlerName:
              currentState.bowlerName ||
              playerMap
                ?.get(
                  bowlerId
                )
                ?.name ||
              "Bowler",
            runs:
              matchupRuns,
            balls:
              matchupBalls,
            dismissals:
              matchupDismissals,
            strikeRate:
              matchupBalls >
              0
                ? (
                    (
                      matchupRuns /
                      matchupBalls
                    ) *
                    100
                  ).toFixed(
                    1
                  )
                : "0.0",
          }
        : null,

    phase: {
      legalBalls:
        legalRecent.length,
      runs:
        phaseRuns,
      wickets:
        phaseWickets,
      boundaries:
        phaseBoundaries,
      label:
        phaseLabel,
      tone:
        phaseTone,
    },

    milestone:
      milestoneCandidates[0] ||
      null,
  };
}

function normalizeBattingStatsForRetiredHurt(battingStats, balls) {
  const retiredHurtIds = new Set();

  for (const ball of balls || []) {
    const wicketType = String(ball.wicketType || "")
      .trim()
      .toUpperCase();

    if (wicketType === "RETIRED_HURT" && ball.dismissedPlayerId) {
      retiredHurtIds.add(Number(ball.dismissedPlayerId));
    }

    // If the same retired-hurt player bats again later, remove retired hurt status
    if (ball.strikerId) {
      retiredHurtIds.delete(Number(ball.strikerId));
    }

    if (ball.nonStrikerId) {
      retiredHurtIds.delete(Number(ball.nonStrikerId));
    }

    if (ball.newBatterId) {
      retiredHurtIds.delete(Number(ball.newBatterId));
    }
  }

  return (battingStats || []).map((row) => {
    const isRetiredHurt = retiredHurtIds.has(Number(row.playerId));

    return {
      ...row,
      isRetiredHurt,
      dismissal: isRetiredHurt
        ? "Retired hurt"
        : row.dismissal || "not out",
    };
  });
}

export async function GET(request, { params }) {
const { matchId: matchIdParam } = await params;

const numericMatchId = Number(matchIdParam);

  const match = await prisma.match.findFirst({
    where: {
      OR: [
        {
          shareCode: matchIdParam,
        },
        ...(!Number.isNaN(numericMatchId)
          ? [
              {
                id: numericMatchId,
              },
            ]
          : []),
      ],
    },
    include: {
      teamA: {
        include: {
          players: true,
        },
      },
      teamB: {
        include: {
          players: true,
        },
      },
      balls: {
        orderBy: {
          sequence: "asc",
        },
      },
      events: {
        orderBy: {
          id: "asc",
        },
      },
    },
  });

  if (!match) {
    return NextResponse.json(
      { error: "Match not found" },
      { status: 404 }
    );
  }

  const superOver = buildSuperOverView(match);

  const playerMap = new Map();

  [
    ...(match.teamA.players || []),
    ...(match.teamB.players || []),
  ].forEach((player) => {
    playerMap.set(player.id, player);
  });

  const innings1Balls = match.balls.filter(
    (b) => b.inningsNo === 1
  );

  const innings2Balls = match.balls.filter(
    (b) => b.inningsNo === 2
  );

/*
 * LIVE VIEW MUST READ THE SAME PERSISTED DLS STATE AS SCORER MODE
 * ===============================================================
 * Do not reimplement DLS math here. The DLS API already persists revisions
 * as MatchEvent rows and src/lib/dls-standard.js is the shared reader.
 */
const latestDls =
  latestDlsState(
    match
  );

const innings1Allocation =
  Number(
    currentAllocation(
      match,
      1
    ) ||
    match.oversPerInnings ||
    0
  );

const innings2Allocation =
  Number(
    currentAllocation(
      match,
      2
    ) ||
    match.oversPerInnings ||
    0
  );

const innings1Summary =
  summarizeInningsDetailed(
    innings1Balls,
    playerMap,
    innings1Allocation
  );

const innings2Summary =
  summarizeInningsDetailed(
    innings2Balls,
    playerMap,
    innings2Allocation
  );

const innings1MatchStats = buildMatchStats({
  ...match,
  balls: innings1Balls
});

const innings2MatchStats = buildMatchStats({
  ...match,
  balls: innings2Balls
});
const innings1TeamId = getBattingTeamId(match, 1);
const innings2TeamId = getBattingTeamId(match, 2);

const innings1TeamName =
  innings1TeamId === match.teamAId
    ? match.teamA.name
    : match.teamB.name;

const innings2TeamName =
  innings2TeamId === match.teamAId
    ? match.teamA.name
    : match.teamB.name;

const inningsData = [
  {
    number: 1,
    teamName: innings1TeamName,
    ...innings1Summary,
    battingStats: normalizeBattingStatsForRetiredHurt(
      innings1MatchStats.batting,
      innings1Balls
    ),
    bowlingStats: innings1MatchStats.bowling
  },
  {
    number: 2,
    teamName: innings2TeamName,
    ...innings2Summary,
    battingStats: normalizeBattingStatsForRetiredHurt(
      innings2MatchStats.batting,
      innings2Balls
    ),
    bowlingStats: innings2MatchStats.bowling
  }
];
 const currentInningsNo =
  match.innings1EndedManually ||
  innings2Summary.legalBalls > 0 ||
  match.status === "COMPLETED" ||
  match.status === "COMPLETED_CORRECTED" ||
  match.status === "COMPLETED_LOCKED"
    ? 2
    : 1;

const currentInningsBalls = match.balls.filter(
  (b) => b.inningsNo === currentInningsNo
);

  const recentBalls = currentInningsBalls
    .slice(-12)
    .reverse()
    .map((ball) => ({
      id: ball.id,
      label: ballShortText(ball)
  }));

  const innings1MaxLegalBalls =
    innings1Allocation > 0
      ? Math.round(
          innings1Allocation *
            6
        )
      : Infinity;

  const innings2MaxLegalBalls =
    innings2Allocation > 0
      ? Math.round(
          innings2Allocation *
            6
        )
      : Infinity;

  const innings1Complete =
    match.innings1EndedManually ||
    innings1Summary.legalBalls >=
      innings1MaxLegalBalls ||
    innings2Balls.length > 0 ||
    [
      "COMPLETED",
      "COMPLETED_CORRECTED",
      "COMPLETED_LOCKED",
    ].includes(
      String(
        match.status ||
        ""
      ).toUpperCase()
    );

  const normalTarget =
    innings1Complete
      ? innings1Summary.runs +
        1
      : null;

  /*
   * If a DLS event has supplied a revised innings-2 target, that is the
   * authoritative chase target. Otherwise preserve normal cricket behavior.
   */
  const persistedDlsTarget =
    Number(
      latestDls
        ?.inningsNo ===
        2
        ? latestDls
            ?.target
        : 0
    );

  const dlsActive =
    Boolean(
      latestDls &&
      (
        Number(
          latestDls
            ?.revisedOvers ||
          0
        ) > 0 ||
        persistedDlsTarget >
          0 ||
        latestDls
          ?.terminated
      )
    );

  const dlsMode =
    String(
      latestDls
        ?.mode ||
      ""
    )
      .trim()
      .toUpperCase();

  const dlsMethodLabel =
    dlsMode ===
    "OFFICIAL_OVERRIDE"
      ? "DLS"
      : dlsActive
        ? "D/L Standard"
        : "";

  const target =
    innings1Complete
      ? (
          persistedDlsTarget >
          0
            ? persistedDlsTarget
            : normalTarget
        )
      : null;

  const remainingBalls =
    innings1Complete
      ? Math.max(
          innings2MaxLegalBalls -
            innings2Summary
              .legalBalls,
          0
        )
      : null;

  const innings2Complete =
    innings2Summary
      .legalBalls >=
    innings2MaxLegalBalls;

  const chaseCompleted =
    Boolean(
      target &&
      innings2Summary.runs >=
        target
    );

  /*
   * Unlimited-wicket matches are valid Cric4All matches. Do not invent an
   * all-out threshold when maxWicketsPerInnings is null.
   */
  const configuredMaxWickets =
    Number(
      match
        .maxWicketsPerInnings
    );

  const hasFiniteWicketLimit =
    Number.isInteger(
      configuredMaxWickets
    ) &&
    configuredMaxWickets >
      0;

  const allOut =
    hasFiniteWicketLimit &&
    innings2Summary.wickets >=
      configuredMaxWickets;

  const persistedStatus =
    String(
      match.status ||
      ""
    ).toUpperCase();

  const persistedFinalStatus =
    [
      "COMPLETED",
      "COMPLETED_CORRECTED",
      "COMPLETED_LOCKED",
    ].includes(
      persistedStatus
    );

  const isCompleted =
    innings1Complete &&
    (
      innings2Complete ||
      chaseCompleted ||
      allOut ||
      persistedFinalStatus
    );

  /*
   * NORMAL fallback result is retained for older/non-DLS records whose
   * match.statusText is generic. New completed DLS matches should already
   * carry the authoritative result saved by /api/balls or /end.
   */
  function buildFallbackCompletedResult() {
    if (
      target &&
      innings2Summary.runs >=
        target
    ) {
      if (
        hasFiniteWicketLimit
      ) {
        const wicketsRemaining =
          Math.max(
            configuredMaxWickets -
              innings2Summary
                .wickets,
            0
          );

        if (
          wicketsRemaining >
          0
        ) {
          return `${innings2TeamName} won by ${wicketsRemaining} wicket${
            wicketsRemaining ===
            1
              ? ""
              : "s"
          }${
            dlsActive
              ? ` (${dlsMethodLabel})`
              : ""
          }`;
        }
      }

      return `${innings2TeamName} won by chasing the target${
        dlsActive
          ? ` (${dlsMethodLabel})`
          : ""
      }`;
    }

    const tieScore =
      dlsActive &&
      target
        ? Math.max(
            Number(target) -
              1,
            0
          )
        : innings1Summary.runs;

    if (
      innings2Summary.runs ===
      tieScore
    ) {
      return `Match tied${
        dlsActive
          ? ` (${dlsMethodLabel})`
          : ""
      }`;
    }

    if (
      innings2Summary.runs <
      tieScore
    ) {
      const margin =
        tieScore -
        innings2Summary.runs;

      return `${innings1TeamName} won by ${margin} run${
        margin === 1
          ? ""
          : "s"
      }${
        dlsActive
          ? ` (${dlsMethodLabel})`
          : ""
      }`;
    }

    const margin =
      innings2Summary.runs -
      tieScore;

    return `${innings2TeamName} won by ${margin} run${
      margin === 1
        ? ""
        : "s"
    }${
      dlsActive
        ? ` (${dlsMethodLabel})`
        : ""
    }`;
  }

  const storedStatusText =
    String(
      match.statusText ||
      ""
    ).trim();

  const storedStatusIsUseful =
    Boolean(
      storedStatusText &&
      ![
        "MATCH COMPLETED",
        "COMPLETED",
        "SCHEDULED",
        "IN_PROGRESS",
        "LIVE",
      ].includes(
        storedStatusText
          .toUpperCase()
      )
    );

  let responseStatus =
    persistedStatus ||
    "SCHEDULED";

  let statusText =
    "Match in progress";

  let resultText =
    null;

  if (
    persistedStatus ===
    "ABANDONED"
  ) {
    responseStatus =
      "ABANDONED";
    statusText =
      storedStatusIsUseful
        ? storedStatusText
        : "Match is Abandoned";
  } else if (
    isCompleted
  ) {
    responseStatus =
      persistedFinalStatus
        ? persistedStatus
        : "COMPLETED";

    resultText =
      storedStatusIsUseful
        ? storedStatusText
        : buildFallbackCompletedResult();

    statusText =
      resultText;
  } else if (
    dlsActive &&
    currentInningsNo ===
      2 &&
    target
  ) {
    const revisedLabel =
      innings2Allocation >
      0
        ? ` · ${innings2Allocation} over${
            innings2Allocation ===
            1
              ? ""
              : "s"
          }`
        : "";

    statusText =
      `🌧 ${dlsMethodLabel} · Revised target ${target}${revisedLabel}`;
  } else if (
    dlsActive
  ) {
    statusText =
      `🌧 ${dlsMethodLabel} adjustment active`;
  }

  /*
   * Super Over remains the final override. DLS applies to the regulation
   * match; once a Super Over is active/completed its own result/status wins.
   */
  if (
    superOver.completed
  ) {
    responseStatus =
      persistedFinalStatus
        ? persistedStatus
        : "COMPLETED";

    resultText =
      superOver.resultText ||
      storedStatusText ||
      resultText ||
      "Match completed via Super Over";

    statusText =
      resultText;
  } else if (
    superOver.active
  ) {
    statusText =
      `Super Over ${superOver.round} in progress`;
  } else if (
    superOver.tied
  ) {
    statusText =
      `Super Over ${superOver.round} tied — another Super Over required`;
  }

  const dlsSummary = {
    active:
      dlsActive,
    mode:
      dlsMode ||
      null,
    methodLabel:
      dlsMethodLabel ||
      null,
    target:
      dlsActive &&
      target
        ? Number(
            target
          )
        : null,
    par:
      latestDls
        ?.par != null
        ? Number(
            latestDls.par
          )
        : latestDls
            ?.parScore !=
          null
          ? Number(
              latestDls
                .parScore
            )
          : null,
    innings1Allocation,
    innings2Allocation,
    revisedOvers:
      Number(
        latestDls
          ?.revisedOvers ||
        0
      ) ||
      null,
    terminated:
      Boolean(
        latestDls
          ?.terminated
      ),
    eventId:
      latestDls
        ?.eventId ||
      null,
  };

const broadcast =
  buildLiveBroadcastIntelligence({
    currentInningsBalls,
    currentSummary:
      currentInningsNo === 2
        ? innings2Summary
        : innings1Summary,
    playerMap,
  });

return NextResponse.json({
  match: {
    id: match.id,
    shareCode: match.shareCode,
    leagueId: match.leagueId,
    teamAName: match.teamA.name,
    teamBName: match.teamB.name,
    battingFirstTeamId: match.battingFirstTeamId,
    oversPerInnings: match.oversPerInnings,
    powerplayOversInnings: match.powerplayOversInnings,

    venueName:
      match.venueName ||
      "",
    venueAddress:
      match.venueAddress ||
      "",

    status:
      responseStatus,
    statusText,
    resultText,
    dls:
      dlsSummary,
  },

  summary: {
    target:
      superOver.exists
        ? null
        : target,
    remainingBalls:
      superOver.exists
        ? null
        : remainingBalls,
    statusText,
    resultText,
    dls:
      dlsSummary,
  },

  superOver,

  innings: inningsData,

  currentInnings: currentInningsNo,

  currentState:
    innings2Summary.legalBalls > 0
      ? innings2Summary.currentState
      : innings1Summary.currentState,

  broadcast,

  recentBalls,

  stats: buildMatchStats(match),
});
}