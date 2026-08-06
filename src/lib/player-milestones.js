import prisma from "@/lib/prisma";

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
        team: true,
      },
    });

  if (!selected) {
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
          previousBestScore &&
        innings.runs >=
          25
      ) {
        previousBestScore =
          innings.runs;

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
              innings.runs,
            title:
              `New Personal Best: ${innings.runs}`,
            description:
              `${identity.playerName} set a new highest score of ${innings.runs}.`,
            icon:
              "📈",
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
          previousBestWickets =
            spell.wickets;

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
                spell.wickets,
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
