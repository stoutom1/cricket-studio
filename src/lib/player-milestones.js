import prisma from "@/lib/prisma";
import { shouldExcludePlayerFromLeagueAnalytics } from "@/lib/player-analytics-exclusions";

const SHARED_TEAM_TOKENS =
  new Set([
    "surprise1",
    "surprise2",
  ]);

const BOWLER_WICKET_EXCLUSIONS =
  new Set([
    "RUN_OUT",
    "RETIRED_OUT",
    "RETIRED_HURT",
  ]);

const RUN_THRESHOLDS = [
  100,
  250,
  500,
  1000,
  2000,
  3000,
  5000,
];

const WICKET_THRESHOLDS = [
  10,
  25,
  50,
  100,
  150,
  200,
];

const APPEARANCE_THRESHOLDS = [
  10,
  25,
  50,
  100,
  150,
  200,
];

const SIX_THRESHOLDS = [
  10,
  25,
  50,
  100,
  150,
  200,
];

function number(value) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}

function token(value) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      ""
    );
}

function isSharedTeamName(
  teamName
) {
  return SHARED_TEAM_TOKENS.has(
    token(teamName)
  );
}

function isLegalBallFaced(
  ball
) {
  return (
    ball.extraType !==
      "WIDE" &&
    ball.extraType !==
      "NOBALL" &&
    ball.wicketType !==
      "RETIRED_HURT"
  );
}

function isBowlerWicket(
  ball
) {
  return (
    Boolean(
      ball.isWicket
    ) &&
    !BOWLER_WICKET_EXCLUSIONS.has(
      ball.wicketType
    ) &&
    ball.extraType !==
      "NOBALL"
  );
}

function createMilestone({
  identity,
  matchId,
  ballId,
  milestoneType,
  milestoneValue,
  title,
  description,
  icon,
  achievedAt,
  metadata,
}) {
  return {
    leagueId:
      identity.leagueId,

    matchId:
      matchId ||
      null,

    ballId:
      ballId ||
      null,

    representativePlayerId:
      identity.representativePlayerId,

    identityKey:
      identity.identityKey,

    playerName:
      identity.playerName,

    playerIds:
      identity.playerIds,

    milestoneType,
    milestoneValue,
    title,
    description,
    icon,
    achievedAt:
      achievedAt ||
      new Date(),

    metadata:
      metadata ||
      undefined,

    dedupeKey:
      [
        identity.leagueId,
        identity.identityKey,
        milestoneType,
        milestoneValue,
      ].join(":"),
  };
}

export async function resolvePlayerIdentity({
  leagueId,
  playerId,
}) {
  if (
    !leagueId ||
    !playerId
  ) {
    return null;
  }

  const selected =
    await prisma.player.findFirst({
      where: {
        id:
          number(
            playerId
          ),

        team: {
          leagueId:
            number(
              leagueId
            ),
        },
      },

      include: {
        team: {
          include: {
            league: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

  if (!selected) {
    return null;
  }

  if (
    shouldExcludePlayerFromLeagueAnalytics(
      selected.team?.league,
      selected
    )
  ) {
    return null;
  }

  const selectedNameToken =
    token(
      selected.name
    );

  let players = [
    selected,
  ];

  if (
    isSharedTeamName(
      selected.team?.name
    ) &&
    selectedNameToken
  ) {
    const sharedCandidates =
      await prisma.player.findMany({
        where: {
          team: {
            leagueId:
              number(
                leagueId
              ),

            name: {
              in: [
                "Surprise 1",
                "Surprise1",
                "Surprise 2",
                "Surprise2",
              ],
            },
          },
        },

        include: {
          team: true,
        },
      });

    players =
      sharedCandidates.filter(
        (candidate) =>
          token(
            candidate.name
          ) ===
          selectedNameToken &&
          isSharedTeamName(
            candidate.team?.name
          )
      );
  }

  const playerIds =
    players
      .map(
        (player) =>
          number(
            player.id
          )
      )
      .filter(Boolean);

  const shared =
    players.length > 1;

  return {
    leagueId:
      number(
        leagueId
      ),

    identityKey:
      shared
        ? `shared:surprise-1-2:${selectedNameToken}`
        : `player:${number(
            selected.id
          )}`,

    playerName:
      selected.name,

    playerIds,

    representativePlayerId:
      playerIds[0],

    teamNames:
      players.map(
        (player) =>
          player.team?.name
      ),

    shared,
  };
}

async function loadIdentityHistory(
  identity
) {
  return prisma.ball.findMany({
    where: {
      match: {
        leagueId:
          identity.leagueId,
      },

      OR: [
        {
          strikerId: {
            in:
              identity.playerIds,
          },
        },
        {
          bowlerId: {
            in:
              identity.playerIds,
          },
        },
        {
          dismissedPlayerId: {
            in:
              identity.playerIds,
          },
        },
      ],
    },

    include: {
      match: {
        include: {
          teamA: true,
          teamB: true,
        },
      },
    },

    orderBy: [
      {
        createdAt:
          "asc",
      },
      {
        id:
          "asc",
      },
    ],
  });
}

function buildDesiredMilestones({
  identity,
  balls,
}) {
  const ids =
    new Set(
      identity.playerIds
    );

  const desired = [];
  const matchAppearances =
    new Map();

  const battingInnings =
    new Map();

  const bowlingMatches =
    new Map();

  let careerRuns = 0;
  let careerWickets = 0;
  let careerSixes = 0;
  let appearances = 0;
  let previousBestScore = 0;
  let previousBestWickets = 0;

  function matchLabel(
    ball
  ) {
    return `${
      ball.match?.teamA
        ?.name ||
      "Team A"
    } vs ${
      ball.match?.teamB
        ?.name ||
      "Team B"
    }`;
  }

  function rememberAppearance(
    ball
  ) {
    const matchId =
      number(
        ball.matchId
      );

    if (
      matchAppearances.has(
        matchId
      )
    ) {
      return;
    }

    matchAppearances.set(
      matchId,
      ball
    );

    appearances += 1;

    for (
      const threshold of
      APPEARANCE_THRESHOLDS
    ) {
      if (
        appearances ===
        threshold
      ) {
        desired.push(
          createMilestone({
            identity,
            matchId,
            ballId:
              ball.id,
            milestoneType:
              "CAREER_APPEARANCES",
            milestoneValue:
              threshold,
            title:
              `${threshold} Appearances`,
            description:
              `${identity.playerName} reached ${threshold} scored match appearances.`,
            icon:
              "🛡️",
            achievedAt:
              ball.createdAt,
            metadata: {
              matchLabel:
                matchLabel(
                  ball
                ),
            },
          })
        );
      }
    }
  }

  for (
    const ball of
    balls
  ) {
    rememberAppearance(
      ball
    );

    const isBatting =
      ids.has(
        number(
          ball.strikerId
        )
      );

    const isBowling =
      ids.has(
        number(
          ball.bowlerId
        )
      );

    if (isBatting) {
      const inningsKey =
        `${ball.matchId}:${ball.inningsNo}`;

      if (
        !battingInnings.has(
          inningsKey
        )
      ) {
        battingInnings.set(
          inningsKey,
          {
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,

            /*
             * Capture the career best before this innings started.
             * A new personal-best event is announced once when this
             * innings first crosses that value.
             */
            previousBestAtStart:
              previousBestScore,

            personalBestAnnounced:
              false,

            firstBall:
              ball,
            lastBall:
              ball,
          }
        );
      }

      const innings =
        battingInnings.get(
          inningsKey
        );

      const runs =
        number(
          ball.runsOffBat
        );

      innings.runs +=
        runs;

      if (
        isLegalBallFaced(
          ball
        )
      ) {
        innings.balls +=
          1;
      }

      if (runs === 4) {
        innings.fours +=
          1;
      }

      if (runs === 6) {
        innings.sixes +=
          1;

        careerSixes +=
          1;

        for (
          const threshold of
          SIX_THRESHOLDS
        ) {
          if (
            careerSixes ===
            threshold
          ) {
            desired.push(
              createMilestone({
                identity,
                matchId:
                  ball.matchId,
                ballId:
                  ball.id,
                milestoneType:
                  "CAREER_SIXES",
                milestoneValue:
                  threshold,
                title:
                  `${threshold} Career Sixes`,
                description:
                  `${identity.playerName} launched career six number ${threshold}.`,
                icon:
                  "💥",
                achievedAt:
                  ball.createdAt,
                metadata: {
                  matchLabel:
                    matchLabel(
                      ball
                    ),
                },
              })
            );
          }
        }
      }

      innings.lastBall =
        ball;

      const beforeRuns =
        careerRuns;

      careerRuns +=
        runs;

      for (
        const threshold of
        RUN_THRESHOLDS
      ) {
        if (
          beforeRuns <
            threshold &&
          careerRuns >=
            threshold
        ) {
          desired.push(
            createMilestone({
              identity,
              matchId:
                ball.matchId,
              ballId:
                ball.id,
              milestoneType:
                "CAREER_RUNS",
              milestoneValue:
                threshold,
              title:
                `${threshold.toLocaleString()} Career Runs`,
              description:
                `${identity.playerName} reached ${threshold.toLocaleString()} career runs.`,
              icon:
                "🏏",
              achievedAt:
                ball.createdAt,
              metadata: {
                careerRuns,
                matchLabel:
                  matchLabel(
                    ball
                  ),
              },
            })
          );
        }
      }

      if (
        innings.runs ===
        50
      ) {
        desired.push(
          createMilestone({
            identity,
            matchId:
              ball.matchId,
            ballId:
              ball.id,
            milestoneType:
              "INNINGS_FIFTY",
            milestoneValue:
              number(
                ball.matchId
              ) *
                10 +
              number(
                ball.inningsNo
              ),
            title:
              "Half Century",
            description:
              `${identity.playerName} completed a fifty in ${matchLabel(
                ball
              )}.`,
            icon:
              "⚡",
            achievedAt:
              ball.createdAt,
            metadata: {
              inningsRuns:
                innings.runs,
              inningsNo:
                ball.inningsNo,
              balls:
                innings.balls,
              matchLabel:
                matchLabel(
                  ball
                ),
            },
          })
        );
      }

      if (
        innings.runs ===
        100
      ) {
        desired.push(
          createMilestone({
            identity,
            matchId:
              ball.matchId,
            ballId:
              ball.id,
            milestoneType:
              "INNINGS_HUNDRED",
            milestoneValue:
              number(
                ball.matchId
              ) *
                10 +
              number(
                ball.inningsNo
              ),
            title:
              "Century",
            description:
              `${identity.playerName} completed a century in ${matchLabel(
                ball
              )}.`,
            icon:
              "💯",
            achievedAt:
              ball.createdAt,
            metadata: {
              inningsRuns:
                innings.runs,
              inningsNo:
                ball.inningsNo,
              balls:
                innings.balls,
              matchLabel:
                matchLabel(
                  ball
                ),
            },
          })
        );
      }

      if (
        innings.runs >
          innings.previousBestAtStart &&
        innings.runs >=
          25
      ) {
        /*
         * One stable key per innings prevents 36, 37, 38... from
         * becoming separate milestone records. Reconciliation updates
         * the same record to the final best reached in the innings.
         */
        desired.push(
          createMilestone({
            identity,
            matchId:
              ball.matchId,
            ballId:
              ball.id,
            milestoneType:
              "PERSONAL_BEST_SCORE",
            milestoneValue:
              number(
                ball.matchId
              ) *
                10 +
              number(
                ball.inningsNo
              ),
            title:
              `New Personal Best: ${innings.runs}`,
            description:
              `${identity.playerName} set a new highest score of ${innings.runs}.`,
            icon:
              "📈",
            achievedAt:
              innings.personalBestAnnounced
                ? innings.firstBall
                    .createdAt
                : ball.createdAt,
            metadata: {
              inningsRuns:
                innings.runs,
              inningsNo:
                ball.inningsNo,
              balls:
                innings.balls,
              previousBest:
                innings.previousBestAtStart,
              matchLabel:
                matchLabel(
                  ball
                ),
            },
          })
        );

        innings.personalBestAnnounced =
          true;
      }

      previousBestScore =
        Math.max(
          previousBestScore,
          innings.runs
        );
    }

    if (isBowling) {
      const matchKey =
        String(
          ball.matchId
        );

      if (
        !bowlingMatches.has(
          matchKey
        )
      ) {
        bowlingMatches.set(
          matchKey,
          {
            wickets: 0,
            firstBall:
              ball,
            lastBall:
              ball,
          }
        );
      }

      const spell =
        bowlingMatches.get(
          matchKey
        );

      spell.lastBall =
        ball;

      if (
        isBowlerWicket(
          ball
        )
      ) {
        spell.wickets +=
          1;

        const beforeWickets =
          careerWickets;

        careerWickets +=
          1;

        for (
          const threshold of
          WICKET_THRESHOLDS
        ) {
          if (
            beforeWickets <
              threshold &&
            careerWickets >=
              threshold
          ) {
            desired.push(
              createMilestone({
                identity,
                matchId:
                  ball.matchId,
                ballId:
                  ball.id,
                milestoneType:
                  "CAREER_WICKETS",
                milestoneValue:
                  threshold,
                title:
                  `${threshold} Career Wickets`,
                description:
                  `${identity.playerName} claimed career wicket number ${threshold}.`,
                icon:
                  "🎯",
                achievedAt:
                  ball.createdAt,
                metadata: {
                  careerWickets,
                  matchLabel:
                    matchLabel(
                      ball
                    ),
                },
              })
            );
          }
        }

        if (
          spell.wickets ===
          5
        ) {
          desired.push(
            createMilestone({
              identity,
              matchId:
                ball.matchId,
              ballId:
                ball.id,
              milestoneType:
                "FIVE_WICKET_HAUL",
              milestoneValue:
                number(
                  ball.matchId
                ),
              title:
                "Five-Wicket Haul",
              description:
                `${identity.playerName} completed a five-wicket haul.`,
              icon:
                "🔥",
              achievedAt:
                ball.createdAt,
              metadata: {
                wickets:
                  spell.wickets,
                matchLabel:
                  matchLabel(
                    ball
                  ),
              },
            })
          );
        }

        if (
          spell.wickets >
            previousBestWickets &&
          spell.wickets >=
            2
        ) {
          desired.push(
            createMilestone({
              identity,
              matchId:
                ball.matchId,
              ballId:
                ball.id,
              milestoneType:
                "PERSONAL_BEST_WICKETS",
              milestoneValue:
                number(
                  ball.matchId
                ),
              title:
                `New Bowling Best: ${spell.wickets} Wickets`,
              description:
                `${identity.playerName} set a new personal bowling best of ${spell.wickets} wickets in a match.`,
              icon:
                "🚀",
              achievedAt:
                ball.createdAt,
              metadata: {
                wickets:
                  spell.wickets,
                previousBest:
                  previousBestWickets,
                matchLabel:
                  matchLabel(
                    ball
                  ),
              },
            })
          );

          previousBestWickets =
            Math.max(
              previousBestWickets,
              spell.wickets
            );
        }
      }
    }
  }

  return desired;
}

export async function reconcileIdentityMilestones({
  identity,
}) {
  if (!identity) {
    return {
      milestones: [],
      newMilestones: [],
    };
  }

  const balls =
    await loadIdentityHistory(
      identity
    );

  const desired =
    buildDesiredMilestones({
      identity,
      balls,
    });

  const existing =
    await prisma.playerMilestone.findMany({
      where: {
        leagueId:
          identity.leagueId,

        identityKey:
          identity.identityKey,
      },

      select: {
        dedupeKey: true,
      },
    });

  const existingKeys =
    new Set(
      existing.map(
        (row) =>
          row.dedupeKey
      )
    );

  await prisma.playerMilestone.updateMany({
    where: {
      leagueId:
        identity.leagueId,

      identityKey:
        identity.identityKey,

      isActive:
        true,
    },

    data: {
      isActive:
        false,
    },
  });

  const saved = [];

  for (
    const milestone of
    desired
  ) {
    const row =
      await prisma.playerMilestone.upsert({
        where: {
          dedupeKey:
            milestone.dedupeKey,
        },

        update: {
          matchId:
            milestone.matchId,

          ballId:
            milestone.ballId,

          representativePlayerId:
            milestone.representativePlayerId,

          playerName:
            milestone.playerName,

          playerIds:
            milestone.playerIds,

          title:
            milestone.title,

          description:
            milestone.description,

          icon:
            milestone.icon,

          achievedAt:
            milestone.achievedAt,

          isActive:
            true,

          metadata:
            milestone.metadata,
        },

        create: {
          ...milestone,

          isActive:
            true,
        },
      });

    saved.push(
      row
    );
  }

  const newMilestones =
    saved.filter(
      (row) =>
        !existingKeys.has(
          row.dedupeKey
        )
    );

  return {
    milestones:
      saved,

    newMilestones,
  };
}

export async function reconcileMilestonesForPlayers({
  leagueId,
  playerIds,
}) {
  if (!leagueId) {
    return {
      milestones: [],
      newMilestones: [],
    };
  }

  const identities =
    new Map();

  for (
    const playerId of
    Array.from(
      new Set(
        (
          playerIds ||
          []
        )
          .map(number)
          .filter(Boolean)
      )
    )
  ) {
    const identity =
      await resolvePlayerIdentity({
        leagueId,
        playerId,
      });

    if (identity) {
      identities.set(
        identity.identityKey,
        identity
      );
    }
  }

  const milestones = [];
  const newMilestones = [];

  for (
    const identity of
    identities.values()
  ) {
    const result =
      await reconcileIdentityMilestones({
        identity,
      });

    milestones.push(
      ...result.milestones
    );

    newMilestones.push(
      ...result.newMilestones
    );
  }

  return {
    milestones,
    newMilestones,
  };
}

export async function reconcileMilestonesForMatch({
  matchId,
}) {
  const match =
    await prisma.match.findUnique({
      where: {
        id:
          number(
            matchId
          ),
      },

      select: {
        id: true,
        leagueId: true,

        balls: {
          select: {
            strikerId: true,
            bowlerId: true,
            dismissedPlayerId: true,
          },
        },
      },
    });

  if (
    !match ||
    !match.leagueId
  ) {
    return {
      milestones: [],
      newMilestones: [],
    };
  }

  const playerIds =
    match.balls.flatMap(
      (ball) => [
        ball.strikerId,
        ball.bowlerId,
        ball.dismissedPlayerId,
      ]
    );

  return reconcileMilestonesForPlayers({
    leagueId:
      match.leagueId,

    playerIds,
  });
}

function crossedThreshold({
  before,
  after,
  threshold,
}) {
  return (
    number(before) <
      number(threshold) &&
    number(after) >=
      number(threshold)
  );
}

async function getIdentityCareerSnapshot({
  identity,
  matchId,
  inningsNo,
  currentBallId,
}) {
  const ids =
    identity.playerIds;

  const wicketWhere = {
    match: {
      leagueId:
        identity.leagueId,
    },

    bowlerId: {
      in: ids,
    },

    isWicket: 1,

    wicketType: {
      notIn:
        Array.from(
          BOWLER_WICKET_EXCLUSIONS
        ),
    },

    extraType: {
      not:
        "NOBALL",
    },
  };

  const [
    battingCareer,
    battingInnings,
    bowlingCareerWickets,
    bowlingMatchWickets,
    battingGroups,
    bowlingGroups,
    priorMatchInvolvement,
    appearanceRows,
  ] =
    await Promise.all([
      prisma.ball.aggregate({
        where: {
          match: {
            leagueId:
              identity.leagueId,
          },

          strikerId: {
            in: ids,
          },
        },

        _sum: {
          runsOffBat:
            true,
        },

        _count: {
          id:
            true,
        },
      }),

      prisma.ball.aggregate({
        where: {
          matchId:
            number(
              matchId
            ),

          inningsNo:
            number(
              inningsNo
            ),

          strikerId: {
            in: ids,
          },
        },

        _sum: {
          runsOffBat:
            true,
        },

        _count: {
          id:
            true,
        },
      }),

      prisma.ball.count({
        where:
          wicketWhere,
      }),

      prisma.ball.count({
        where: {
          ...wicketWhere,

          matchId:
            number(
              matchId
            ),
        },
      }),

      prisma.ball.groupBy({
        by: [
          "matchId",
          "inningsNo",
        ],

        where: {
          match: {
            leagueId:
              identity.leagueId,
          },

          strikerId: {
            in: ids,
          },
        },

        _sum: {
          runsOffBat:
            true,
        },
      }),

      prisma.ball.groupBy({
        by: [
          "matchId",
        ],

        where:
          wicketWhere,

        _count: {
          id:
            true,
        },
      }),

      prisma.ball.count({
        where: {
          id: {
            not:
              number(
                currentBallId
              ),
          },

          matchId:
            number(
              matchId
            ),

          OR: [
            {
              strikerId: {
                in: ids,
              },
            },
            {
              bowlerId: {
                in: ids,
              },
            },
            {
              dismissedPlayerId: {
                in: ids,
              },
            },
          ],
        },
      }),

      prisma.ball.findMany({
        where: {
          match: {
            leagueId:
              identity.leagueId,
          },

          OR: [
            {
              strikerId: {
                in: ids,
              },
            },
            {
              bowlerId: {
                in: ids,
              },
            },
            {
              dismissedPlayerId: {
                in: ids,
              },
            },
          ],
        },

        distinct: [
          "matchId",
        ],

        select: {
          matchId: true,
        },
      }),
    ]);

  const currentInningsRuns =
    number(
      battingInnings
        ._sum
        .runsOffBat
    );

  const previousBestScore =
    battingGroups.reduce(
      (
        highest,
        group
      ) => {
        if (
          number(
            group.matchId
          ) ===
            number(
              matchId
            ) &&
          number(
            group.inningsNo
          ) ===
            number(
              inningsNo
            )
        ) {
          return highest;
        }

        return Math.max(
          highest,
          number(
            group._sum
              .runsOffBat
          )
        );
      },
      0
    );

  const previousBestWickets =
    bowlingGroups.reduce(
      (
        highest,
        group
      ) => {
        if (
          number(
            group.matchId
          ) ===
          number(
            matchId
          )
        ) {
          return highest;
        }

        return Math.max(
          highest,
          number(
            group._count
              .id
          )
        );
      },
      0
    );

  return {
    careerRuns:
      number(
        battingCareer
          ._sum
          .runsOffBat
      ),

    currentInningsRuns,

    careerWickets:
      number(
        bowlingCareerWickets
      ),

    currentMatchWickets:
      number(
        bowlingMatchWickets
      ),

    previousBestScore,
    previousBestWickets,

    isFirstAppearanceBall:
      number(
        priorMatchInvolvement
      ) === 0,

    appearances:
      appearanceRows.length,
  };
}

async function persistLiveMilestone(
  milestone
) {
  const existing =
    await prisma.playerMilestone.findUnique({
      where: {
        dedupeKey:
          milestone.dedupeKey,
      },
    });

  const row =
    await prisma.playerMilestone.upsert({
      where: {
        dedupeKey:
          milestone.dedupeKey,
      },

      update: {
        matchId:
          milestone.matchId,

        ballId:
          milestone.ballId,

        representativePlayerId:
          milestone.representativePlayerId,

        playerName:
          milestone.playerName,

        playerIds:
          milestone.playerIds,

        title:
          milestone.title,

        description:
          milestone.description,

        icon:
          milestone.icon,

        achievedAt:
          milestone.achievedAt,

        isActive:
          true,

        metadata:
          milestone.metadata,
      },

      create: {
        ...milestone,

        isActive:
          true,
      },
    });

  return {
    row,

    isNew:
      !existing ||
      !existing.isActive,
  };
}

/*
 * FAST PATH FOR NORMAL SCORING
 *
 * This function does not load every historical delivery and does not rewrite
 * every old milestone. It asks PostgreSQL for compact aggregates, detects only
 * thresholds crossed by the newly saved ball, and upserts only those events.
 *
 * Full reconcileMilestonesForPlayers remains available for Undo Ball,
 * corrections, rollback and historical backfill.
 */
export async function detectLiveMilestonesForBall({
  leagueId,
  ball,
}) {
  if (
    !leagueId ||
    !ball?.id
  ) {
    return {
      milestones: [],
      newMilestones: [],
    };
  }

  const participantIds =
    [
      ball.strikerId,
      ball.bowlerId,
    ]
      .map(number)
      .filter(Boolean);

  const identities =
    new Map();

  for (
    const playerId of
    participantIds
  ) {
    const identity =
      await resolvePlayerIdentity({
        leagueId,
        playerId,
      });

    if (identity) {
      identities.set(
        identity.identityKey,
        identity
      );
    }
  }

  const desired = [];

  for (
    const identity of
    identities.values()
  ) {
    const snapshot =
      await getIdentityCareerSnapshot({
        identity,
        matchId:
          ball.matchId,
        inningsNo:
          ball.inningsNo,
        currentBallId:
          ball.id,
      });

    const isStriker =
      identity.playerIds.includes(
        number(
          ball.strikerId
        )
      );

    const isBowler =
      identity.playerIds.includes(
        number(
          ball.bowlerId
        )
      );

    const matchLabel =
      ball.matchLabel ||
      `Match #${ball.matchId}`;

    if (isStriker) {
      const ballRuns =
        number(
          ball.runsOffBat
        );

      const beforeCareerRuns =
        snapshot.careerRuns -
        ballRuns;

      for (
        const threshold of
        RUN_THRESHOLDS
      ) {
        if (
          crossedThreshold({
            before:
              beforeCareerRuns,
            after:
              snapshot.careerRuns,
            threshold,
          })
        ) {
          desired.push(
            createMilestone({
              identity,
              matchId:
                ball.matchId,
              ballId:
                ball.id,
              milestoneType:
                "CAREER_RUNS",
              milestoneValue:
                threshold,
              title:
                `${threshold.toLocaleString()} Career Runs`,
              description:
                `${identity.playerName} reached ${threshold.toLocaleString()} career runs.`,
              icon:
                "🏏",
              achievedAt:
                ball.createdAt,
              metadata: {
                careerRuns:
                  snapshot.careerRuns,
                matchLabel,
              },
            })
          );
        }
      }

      if (
        number(
          ball.runsOffBat
        ) === 6
      ) {
        const careerSixes =
          await prisma.ball.count({
            where: {
              match: {
                leagueId:
                  identity.leagueId,
              },

              strikerId: {
                in:
                  identity.playerIds,
              },

              runsOffBat:
                6,
            },
          });

        const beforeSixes =
          careerSixes -
          1;

        for (
          const threshold of
          SIX_THRESHOLDS
        ) {
          if (
            crossedThreshold({
              before:
                beforeSixes,
              after:
                careerSixes,
              threshold,
            })
          ) {
            desired.push(
              createMilestone({
                identity,
                matchId:
                  ball.matchId,
                ballId:
                  ball.id,
                milestoneType:
                  "CAREER_SIXES",
                milestoneValue:
                  threshold,
                title:
                  `${threshold} Career Sixes`,
                description:
                  `${identity.playerName} launched career six number ${threshold}.`,
                icon:
                  "💥",
                achievedAt:
                  ball.createdAt,
                metadata: {
                  careerSixes,
                  matchLabel,
                },
              })
            );
          }
        }
      }

      const beforeInningsRuns =
        snapshot.currentInningsRuns -
        ballRuns;

      for (
        const milestone of
        [
          {
            threshold:
              50,
            type:
              "INNINGS_FIFTY",
            title:
              "Half Century",
            icon:
              "⚡",
          },
          {
            threshold:
              100,
            type:
              "INNINGS_HUNDRED",
            title:
              "Century",
            icon:
              "💯",
          },
        ]
      ) {
        if (
          crossedThreshold({
            before:
              beforeInningsRuns,
            after:
              snapshot.currentInningsRuns,
            threshold:
              milestone.threshold,
          })
        ) {
          desired.push(
            createMilestone({
              identity,
              matchId:
                ball.matchId,
              ballId:
                ball.id,
              milestoneType:
                milestone.type,
              milestoneValue:
                number(
                  ball.matchId
                ) *
                  10 +
                number(
                  ball.inningsNo
                ),
              title:
                milestone.title,
              description:
                `${identity.playerName} completed a ${milestone.title.toLowerCase()} in ${matchLabel}.`,
              icon:
                milestone.icon,
              achievedAt:
                ball.createdAt,
              metadata: {
                inningsRuns:
                  snapshot.currentInningsRuns,
                inningsNo:
                  ball.inningsNo,
                matchLabel,
              },
            })
          );
        }
      }

      if (
        snapshot.currentInningsRuns >=
          25 &&
        snapshot.currentInningsRuns >
          snapshot.previousBestScore
      ) {
        desired.push(
          createMilestone({
            identity,
            matchId:
              ball.matchId,
            ballId:
              ball.id,
            milestoneType:
              "PERSONAL_BEST_SCORE",

            /*
             * Stable one-per-innings value. Later runs update this same
             * record but persistLiveMilestone() reports isNew=false, so
             * the scorer sees the popup only on the first crossing.
             */
            milestoneValue:
              number(
                ball.matchId
              ) *
                10 +
              number(
                ball.inningsNo
              ),

            title:
              `New Personal Best: ${snapshot.currentInningsRuns}`,
            description:
              `${identity.playerName} set a new highest score of ${snapshot.currentInningsRuns}.`,
            icon:
              "📈",
            achievedAt:
              ball.createdAt,
            metadata: {
              inningsRuns:
                snapshot.currentInningsRuns,
              inningsNo:
                ball.inningsNo,
              previousBest:
                snapshot.previousBestScore,
              matchLabel,
            },
          })
        );
      }
    }

    if (
      isBowler &&
      isBowlerWicket(
        ball
      )
    ) {
      const beforeCareerWickets =
        snapshot.careerWickets -
        1;

      for (
        const threshold of
        WICKET_THRESHOLDS
      ) {
        if (
          crossedThreshold({
            before:
              beforeCareerWickets,
            after:
              snapshot.careerWickets,
            threshold,
          })
        ) {
          desired.push(
            createMilestone({
              identity,
              matchId:
                ball.matchId,
              ballId:
                ball.id,
              milestoneType:
                "CAREER_WICKETS",
              milestoneValue:
                threshold,
              title:
                `${threshold} Career Wickets`,
              description:
                `${identity.playerName} claimed career wicket number ${threshold}.`,
              icon:
                "🎯",
              achievedAt:
                ball.createdAt,
              metadata: {
                careerWickets:
                  snapshot.careerWickets,
                matchLabel,
              },
            })
          );
        }
      }

      if (
        snapshot.currentMatchWickets ===
        5
      ) {
        desired.push(
          createMilestone({
            identity,
            matchId:
              ball.matchId,
            ballId:
              ball.id,
            milestoneType:
              "FIVE_WICKET_HAUL",
            milestoneValue:
              number(
                ball.matchId
              ),
            title:
              "Five-Wicket Haul",
            description:
              `${identity.playerName} completed a five-wicket haul.`,
            icon:
              "🔥",
            achievedAt:
              ball.createdAt,
            metadata: {
              wickets:
                snapshot.currentMatchWickets,
              matchLabel,
            },
          })
        );
      }

      if (
        snapshot.currentMatchWickets >=
          2 &&
        snapshot.currentMatchWickets >
          snapshot.previousBestWickets
      ) {
        desired.push(
          createMilestone({
            identity,
            matchId:
              ball.matchId,
            ballId:
              ball.id,
            milestoneType:
              "PERSONAL_BEST_WICKETS",

            /*
             * Stable one-per-match value prevents a new popup at the
             * third, fourth and fifth wicket in the same record spell.
             */
            milestoneValue:
              number(
                ball.matchId
              ),

            title:
              `New Bowling Best: ${snapshot.currentMatchWickets} Wickets`,
            description:
              `${identity.playerName} set a new personal bowling best of ${snapshot.currentMatchWickets} wickets in a match.`,
            icon:
              "🚀",
            achievedAt:
              ball.createdAt,
            metadata: {
              wickets:
                snapshot.currentMatchWickets,
              previousBest:
                snapshot.previousBestWickets,
              matchLabel,
            },
          })
        );
      }
    }

    if (
      snapshot.isFirstAppearanceBall
    ) {
      const beforeAppearances =
        snapshot.appearances -
        1;

      for (
        const threshold of
        APPEARANCE_THRESHOLDS
      ) {
        if (
          crossedThreshold({
            before:
              beforeAppearances,
            after:
              snapshot.appearances,
            threshold,
          })
        ) {
          desired.push(
            createMilestone({
              identity,
              matchId:
                ball.matchId,
              ballId:
                ball.id,
              milestoneType:
                "CAREER_APPEARANCES",
              milestoneValue:
                threshold,
              title:
                `${threshold} Appearances`,
              description:
                `${identity.playerName} reached ${threshold} scored match appearances.`,
              icon:
                "🛡️",
              achievedAt:
                ball.createdAt,
              metadata: {
                matchLabel,
              },
            })
          );
        }
      }
    }
  }

  const saved = [];
  const newMilestones = [];

  for (
    const milestone of
    desired
  ) {
    const result =
      await persistLiveMilestone(
        milestone
      );

    saved.push(
      result.row
    );

    if (
      result.isNew
    ) {
      newMilestones.push(
        result.row
      );
    }
  }

  return {
    milestones:
      saved,
    newMilestones,
  };
}

