import {
  shouldExcludePlayerFromLeagueAnalytics,
} from "@/lib/player-analytics-exclusions";

const COMPLETED_STATUSES =
  new Set([
    "COMPLETED",
    "COMPLETED_LOCKED",
    "COMPLETED_CORRECTED",
  ]);

const MILESTONE_GROUPS = {
  runs: {
    label: "Career runs",
    shortLabel: "runs",
    icon: "🏏",
    thresholds: [
      100,
      250,
      500,
      1000,
      1500,
      2000,
      3000,
      5000,
    ],
  },

  wickets: {
    label: "Career wickets",
    shortLabel: "wickets",
    icon: "🎯",
    thresholds: [
      10,
      25,
      50,
      100,
      150,
      200,
      300,
    ],
  },

  fielding: {
    label: "Fielding contributions",
    shortLabel: "fielding",
    icon: "🧤",
    thresholds: [
      10,
      25,
      50,
      100,
      150,
      200,
    ],
  },

  appearances: {
    label: "Match appearances",
    shortLabel: "matches",
    icon: "🎽",
    thresholds: [
      10,
      25,
      50,
      100,
      150,
      200,
      300,
    ],
  },
};

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

function safeDate(
  value
) {
  const date =
    value
      ? new Date(value)
      : null;

  return date &&
    !Number.isNaN(
      date.getTime()
    )
    ? date
    : null;
}

function matchDate(
  match
) {
  return (
    safeDate(
      match?.endedAt
    ) ||
    safeDate(
      match?.lockedAt
    ) ||
    safeDate(
      match?.startedAt
    ) ||
    safeDate(
      match?.scheduledAt
    ) ||
    safeDate(
      match?.createdAt
    ) ||
    new Date(0)
  );
}

function sortMatches(
  matches
) {
  return [
    ...(matches ||
      []),
  ].sort(
    (a, b) =>
      matchDate(a) -
        matchDate(b) ||
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

function playerIdentity(
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

function getRoster(
  league
) {
  const roster =
    new Map();

  for (
    const team
    of league?.teams ||
      []
  ) {
    for (
      const player
      of team?.players ||
        []
    ) {
      roster.set(
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
              team.id
            ),
          teamName:
            team.name ||
            "",
        }
      );
    }
  }

  return roster;
}

function getPlayer(
  roster,
  playerId,
  fallback = {}
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
        fallback
          ?.playerName ||
        (numericId
          ? `Player ${numericId}`
          : "Player"),
      teamId:
        Number(
          fallback?.teamId
        ) ||
        null,
      teamName:
        fallback
          ?.teamName ||
        "",
    }
  );
}

function shouldCountBowlerWicket(
  ball
) {
  if (!ball?.isWicket) {
    return false;
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

function getFieldingContribution(
  ball,
  playerId
) {
  const wicketType =
    String(
      ball?.wicketType ||
      ""
    )
      .trim()
      .toUpperCase();

  const numericPlayerId =
    Number(
      playerId
    );

  if (
    !numericPlayerId
  ) {
    return 0;
  }

  if (
    Number(
      ball?.fielderId
    ) ===
      numericPlayerId &&
    [
      "CAUGHT",
      "RUN_OUT",
      "STUMPED",
    ].includes(
      wicketType
    )
  ) {
    return 1;
  }

  if (
    wicketType ===
      "RUN_OUT" &&
    Number(
      ball
        ?.assistantFielderId
    ) ===
      numericPlayerId
  ) {
    return 1;
  }

  return 0;
}

function matchLabel(
  match
) {
  return `${match?.teamA?.name || "Team A"} vs ${match?.teamB?.name || "Team B"}`;
}

function matchHref(
  match,
  league
) {
  return match?.id &&
    league?.slug
    ? `/leagues/${league.slug}/matches/${match.id}`
    : "";
}

function formatDate(
  match
) {
  const date =
    matchDate(
      match
    );

  if (
    date.getTime() ===
    0
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",
      day:
        "numeric",
      year:
        "numeric",
    }
  ).format(
    date
  );
}

function ensureMatchPlayer({
  map,
  roster,
  league,
  playerId,
  fallback,
}) {
  const player =
    getPlayer(
      roster,
      playerId,
      fallback
    );

  if (
    !player.playerId ||
    shouldExcludePlayerFromLeagueAnalytics(
      league,
      player.playerName
    )
  ) {
    return null;
  }

  const key =
    playerIdentity(
      player.playerId,
      player.playerName
    );

  if (
    !map.has(
      key
    )
  ) {
    map.set(
      key,
      {
        ...player,
        key,
        runs:
          0,
        wickets:
          0,
        fielding:
          0,
        participated:
          false,
      }
    );
  }

  return map.get(
    key
  );
}

function buildMatchPlayerStats({
  match,
  roster,
  league,
}) {
  const players =
    new Map();

  const balls =
    sortBalls(
      match?.balls ||
      []
    );

  for (const ball of balls) {
    const striker =
      ensureMatchPlayer({
        map:
          players,
        roster,
        league,
        playerId:
          ball.strikerId,
        fallback: {
          playerName:
            ball
              ?.striker
              ?.name,
          teamName:
            ball
              ?.striker
              ?.team
              ?.name,
          teamId:
            ball
              ?.striker
              ?.team
              ?.id,
        },
      });

    if (striker) {
      striker.runs +=
        Number(
          ball.runsOffBat ||
            0
        );
      striker.participated =
        true;
    }

    const nonStriker =
      ensureMatchPlayer({
        map:
          players,
        roster,
        league,
        playerId:
          ball.nonStrikerId,
      });

    if (nonStriker) {
      nonStriker.participated =
        true;
    }

    const bowler =
      ensureMatchPlayer({
        map:
          players,
        roster,
        league,
        playerId:
          ball.bowlerId,
        fallback: {
          playerName:
            ball
              ?.bowler
              ?.name,
          teamName:
            ball
              ?.bowler
              ?.team
              ?.name,
          teamId:
            ball
              ?.bowler
              ?.team
              ?.id,
        },
      });

    if (bowler) {
      if (
        shouldCountBowlerWicket(
          ball
        )
      ) {
        bowler.wickets +=
          1;
      }

      bowler.participated =
        true;
    }

    for (
      const candidateId
      of [
        ball.fielderId,
        ball.assistantFielderId,
      ]
    ) {
      const fielder =
        ensureMatchPlayer({
          map:
            players,
          roster,
          league,
          playerId:
            candidateId,
        });

      if (fielder) {
        const contribution =
          getFieldingContribution(
            ball,
            candidateId
          );

        fielder.fielding +=
          contribution;

        if (
          contribution >
          0
        ) {
          fielder.participated =
            true;
        }
      }
    }
  }

  return [
    ...players.values(),
  ].filter(
    (player) =>
      player.participated
  );
}

function createCareerPlayer(
  row
) {
  return {
    key:
      row.key,
    playerId:
      row.playerId,
    playerName:
      row.playerName,
    teamName:
      row.teamName ||
      "",
    runs:
      0,
    wickets:
      0,
    fielding:
      0,
    appearances:
      0,
  };
}

function crossedThresholds({
  before,
  after,
  thresholds,
}) {
  return thresholds.filter(
    (threshold) =>
      before <
        threshold &&
      after >=
        threshold
  );
}

function milestoneTitle({
  metric,
  threshold,
}) {
  if (
    metric ===
    "runs"
  ) {
    return `${threshold} career runs`;
  }

  if (
    metric ===
    "wickets"
  ) {
    return `${threshold} career wickets`;
  }

  if (
    metric ===
    "fielding"
  ) {
    return `${threshold} fielding contributions`;
  }

  return `${threshold} match appearances`;
}

function nextThreshold(
  metric,
  value
) {
  const config =
    MILESTONE_GROUPS[
      metric
    ];

  return config
    ?.thresholds
    ?.find(
      (threshold) =>
        threshold >
        value
    ) ||
    null;
}

function previousThreshold(
  metric,
  next
) {
  const thresholds =
    MILESTONE_GROUPS[
      metric
    ]
      ?.thresholds ||
    [];

  const index =
    thresholds.indexOf(
      next
    );

  return index > 0
    ? thresholds[
        index - 1
      ]
    : 0;
}

export function buildLeagueMilestones(
  matches = [],
  league
) {
  const eligibleMatches =
    sortMatches(
      (matches ||
        []).filter(
        (match) =>
          COMPLETED_STATUSES.has(
            normalizeStatus(
              match?.status
            )
          )
      )
    );

  const roster =
    getRoster(
      league
    );
  const career =
    new Map();
  const achievements =
    [];

  for (
    const match
    of eligibleMatches
  ) {
    const matchPlayers =
      buildMatchPlayerStats({
        match,
        roster,
        league,
      });

    for (
      const matchPlayer
      of matchPlayers
    ) {
      if (
        !career.has(
          matchPlayer.key
        )
      ) {
        career.set(
          matchPlayer.key,
          createCareerPlayer(
            matchPlayer
          )
        );
      }

      const player =
        career.get(
          matchPlayer.key
        );

      if (
        !player.teamName &&
        matchPlayer.teamName
      ) {
        player.teamName =
          matchPlayer.teamName;
      }

      const before = {
        runs:
          player.runs,
        wickets:
          player.wickets,
        fielding:
          player.fielding,
        appearances:
          player.appearances,
      };

      player.runs +=
        Number(
          matchPlayer.runs ||
            0
        );
      player.wickets +=
        Number(
          matchPlayer.wickets ||
            0
        );
      player.fielding +=
        Number(
          matchPlayer.fielding ||
            0
        );
      player.appearances +=
        1;

      for (
        const metric
        of Object.keys(
          MILESTONE_GROUPS
        )
      ) {
        const config =
          MILESTONE_GROUPS[
            metric
          ];

        const crossed =
          crossedThresholds({
            before:
              before[
                metric
              ],
            after:
              player[
                metric
              ],
            thresholds:
              config.thresholds,
          });

        for (
          const threshold
          of crossed
        ) {
          achievements.push({
            id:
              `${matchPlayer.key}:${metric}:${threshold}`,
            metric,
            icon:
              config.icon,
            title:
              milestoneTitle({
                metric,
                threshold,
              }),
            threshold,
            playerId:
              player.playerId,
            playerName:
              player.playerName,
            teamName:
              player.teamName ||
              matchPlayer.teamName ||
              "",
            total:
              player[
                metric
              ],
            matchId:
              match.id,
            matchLabel:
              matchLabel(
                match
              ),
            href:
              matchHref(
                match,
                league
              ),
            dateLabel:
              formatDate(
                match
              ),
            sortTime:
              matchDate(
                match
              ).getTime(),
          });
        }
      }
    }
  }

  const players =
    [
      ...career.values(),
    ];

  const nextUp =
    [];

  for (
    const player
    of players
  ) {
    for (
      const metric
      of Object.keys(
        MILESTONE_GROUPS
      )
    ) {
      const current =
        Number(
          player[
            metric
          ] ||
            0
        );

      const next =
        nextThreshold(
          metric,
          current
        );

      if (!next) {
        continue;
      }

      const previous =
        previousThreshold(
          metric,
          next
        );

      const span =
        Math.max(
          next -
            previous,
          1
        );

      const progressed =
        Math.max(
          current -
            previous,
          0
        );

      const progress =
        Math.min(
          100,
          Math.max(
            0,
            (progressed /
              span) *
              100
          )
        );

      /*
       * Avoid filling the page with players who have barely begun a tier.
       * "Next Up" should feel genuinely close.
       */
      if (
        progress <
          35 &&
        current <
          next * 0.35
      ) {
        continue;
      }

      nextUp.push({
        id:
          `${player.key}:${metric}:${next}`,
        metric,
        icon:
          MILESTONE_GROUPS[
            metric
          ].icon,
        label:
          MILESTONE_GROUPS[
            metric
          ].label,
        shortLabel:
          MILESTONE_GROUPS[
            metric
          ].shortLabel,
        playerId:
          player.playerId,
        playerName:
          player.playerName,
        teamName:
          player.teamName ||
          "",
        current,
        target:
          next,
        remaining:
          Math.max(
            next -
              current,
            0
          ),
        progress:
          Number(
            progress.toFixed(
              1
            )
          ),
      });
    }
  }

  nextUp.sort(
    (a, b) =>
      b.progress -
        a.progress ||
      a.remaining -
        b.remaining ||
      a.playerName.localeCompare(
        b.playerName
      )
  );

  achievements.sort(
    (a, b) =>
      b.sortTime -
        a.sortTime ||
      b.threshold -
        a.threshold
  );

  const achievedByMetric =
    Object.fromEntries(
      Object.keys(
        MILESTONE_GROUPS
      ).map(
        (metric) => [
          metric,
          achievements.filter(
            (item) =>
              item.metric ===
              metric
          ).length,
        ]
      )
    );

  return {
    achievements,
    recentAchievements:
      achievements.slice(
        0,
        12
      ),
    nextUp:
      nextUp.slice(
        0,
        12
      ),
    players,
    achievedByMetric,
    completedMatches:
      eligibleMatches.length,
    playerCount:
      players.length,
  };
}
