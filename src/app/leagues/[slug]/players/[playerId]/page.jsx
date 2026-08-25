import prisma from "@/lib/prisma";
import {
  isMatchEligibleForStats,
  filterMilestonesForEligibleMatches,
} from "@/lib/stat-match";
import {
  notFound,
} from "next/navigation";
import Link from "next/link";
import {
  getServerSession,
} from "next-auth";

import {
  authOptions,
} from "@/lib/auth";
import PlayerCardActions from "./PlayerCardActions";
import SeoJsonLd from "@/components/seo-json-ld";
import { shouldExcludePlayerFromLeagueAnalytics } from "@/lib/player-analytics-exclusions";
import {
  getSurpriseIdentityKey,
  isSurpriseCricketLeague,
} from "@/lib/surprise-player-identity";
import {
  absoluteCric4AllUrl,
  publicPageRobots,
} from "@/lib/seo";
import "@/app/spectator-player-final.css";
import "@/app/player-milestones-final.css";

const COMPLETED_STATUSES = new Set([
  "COMPLETED",
  "COMPLETED_LOCKED",
  "COMPLETED_CORRECTED",
]);

const BOWLER_WICKET_EXCLUSIONS =
  new Set([
    "RUN_OUT",
    "RETIRED_OUT",
    "RETIRED_HURT",
  ]);

function number(value) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


function buildLeagueRouteWhere(
  routeValue
) {
  const normalizedValue =
    String(
      routeValue ||
        ""
    ).trim();

  const numericLeagueId =
    Number(
      normalizedValue
    );

  const isNumericLeagueId =
    Number.isInteger(
      numericLeagueId
    ) &&
    numericLeagueId > 0;

  return isNumericLeagueId
    ? {
        OR: [
          {
            slug:
              normalizedValue,
          },
          {
            id:
              numericLeagueId,
          },
        ],
      }
    : {
        slug:
          normalizedValue,
      };
}

async function getSessionUserId(
  session
) {
  const directUserId =
    String(
      session?.user?.id ||
        ""
    ).trim();

  if (directUserId) {
    return directUserId;
  }

  const email =
    String(
      session?.user?.email ||
        ""
    )
      .trim()
      .toLowerCase();

  if (!email) {
    return "";
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email,
      },

      select: {
        id: true,
      },
    });

  return user?.id || "";
}

async function canOpenPlayerCard({
  league,
  session,
}) {
  if (!league) {
    return false;
  }

  if (
    [
      "PUBLIC",
      "UNLISTED",
    ].includes(
      String(
        league.visibility ||
          ""
      ).toUpperCase()
    )
  ) {
    return true;
  }

  const userId =
    await getSessionUserId(
      session
    );

  if (!userId) {
    return false;
  }

  if (
    String(
      league.ownerId ||
        ""
    ) === userId
  ) {
    return true;
  }

  return Boolean(
    league.members?.some(
      (member) =>
        String(
          member.userId
        ) === userId
    )
  );
}

function safeDivide(
  numerator,
  denominator,
  fallback = 0
) {
  return denominator > 0
    ? numerator / denominator
    : fallback;
}

/*
 * Surprise Cricket League uses one player identity across every team in the
 * league. Other leagues keep Player.id identities unchanged.
 */
function getPlayerIdentityKey(player, league) {
  return getSurpriseIdentityKey(player, league);
}

function buildPlayerIdentityGroups(rosterPlayers, league) {
  const groups = new Map();

  for (const rosterPlayer of rosterPlayers) {
    const key = getPlayerIdentityKey(rosterPlayer, league);
    const existing = groups.get(key);

    if (existing) {
      existing.players.push(rosterPlayer);
      continue;
    }

    groups.set(key, {
      key,
      players: [rosterPlayer],
    });
  }

  return [...groups.values()].map((group) => {
    const primaryPlayer = group.players[0];
    const teamMemberships = group.players.map((item) => ({
      teamId: item.teamId,
      teamName: item.teamName,
    }));

    return {
      key: group.key,
      playerIds: group.players.map((item) => number(item.id)),
      players: group.players,
      player: {
        ...primaryPlayer,
        teamId: primaryPlayer.teamId,
        teamName: teamMemberships
          .map((item) => item.teamName)
          .join(" & "),
        teamMemberships,
        combinedProfile: group.players.length > 1,
      },
    };
  });
}

function normalizeStatus(status) {
  return String(
    status ||
      "SCHEDULED"
  ).toUpperCase();
}

function formatStatus(status) {
  return normalizeStatus(
    status
  ).replaceAll(
    "_",
    " "
  );
}

function getStatusClass(status) {
  const value =
    normalizeStatus(
      status
    );

  if (
    [
      "LIVE",
      "IN_PROGRESS",
    ].includes(value)
  ) {
    return "is-live";
  }

  if (
    value ===
    "SCHEDULED"
  ) {
    return "is-scheduled";
  }

  if (
    COMPLETED_STATUSES.has(
      value
    )
  ) {
    return "is-completed";
  }

  if (
    value ===
    "ABANDONED"
  ) {
    return "is-abandoned";
  }

  return "is-neutral";
}

function getInitials(name) {
  return (
    String(
      name ||
        "Player"
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (part) =>
          part[0]
            ?.toUpperCase()
      )
      .join("") ||
    "PL"
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

function isLegalBowlingBall(
  ball
) {
  return (
    Boolean(
      ball.legalDelivery
    ) &&
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

function runsChargedToBowler(
  ball
) {
  if (
    [
      "BYE",
      "LEGBYE",
    ].includes(
      ball.extraType
    )
  ) {
    return 0;
  }

  return number(
    ball.totalRuns
  );
}

function percentileRank(
  values,
  value,
  lowerIsBetter = false
) {
  const usable =
    values.filter(
      Number.isFinite
    );

  if (
    usable.length <= 1
  ) {
    return 50;
  }

  const betterOrEqual =
    usable.filter(
      (candidate) =>
        lowerIsBetter
          ? candidate >= value
          : candidate <= value
    ).length;

  return Math.round(
    (
      (
        betterOrEqual -
        1
      ) /
      (
        usable.length -
        1
      )
    ) *
      100
  );
}

function ratingFromPercentile(
  percentile
) {
  return Number(
    (
      5 +
      Math.max(
        0,
        Math.min(
          100,
          percentile
        )
      ) *
        0.045
    ).toFixed(1)
  );
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  try {
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
      new Date(value)
    );
  } catch {
    return "";
  }
}

function buildPlayerMatch({
  match,
  playerIds,
}) {
  const playerIdSet = new Set(
    (playerIds || []).map(number)
  );
  const matchBalls =
    match.balls ||
    [];

  const batting =
    matchBalls.filter(
      (ball) =>
        playerIdSet.has(
          number(
            ball.strikerId
          )
        )
    );

  const bowling =
    matchBalls.filter(
      (ball) =>
        playerIdSet.has(
          number(
            ball.bowlerId
          )
        )
    );

  const dismissed =
    matchBalls.some(
      (ball) =>
        Boolean(
          ball.isWicket
        ) &&
        playerIdSet.has(
          number(
            ball.dismissedPlayerId
          )
        ) &&
        ball.wicketType !==
          "RETIRED_HURT"
    );

  if (
    !batting.length &&
    !bowling.length &&
    !dismissed
  ) {
    return null;
  }

  const runs =
    batting.reduce(
      (sum, ball) =>
        sum +
        number(
          ball.runsOffBat
        ),
      0
    );

  const balls =
    batting.filter(
      isLegalBallFaced
    ).length;

  const fours =
    batting.filter(
      (ball) =>
        number(
          ball.runsOffBat
        ) === 4
    ).length;

  const sixes =
    batting.filter(
      (ball) =>
        number(
          ball.runsOffBat
        ) === 6
    ).length;

  const wickets =
    bowling.filter(
      isBowlerWicket
    ).length;

  const legalBowls =
    bowling.filter(
      isLegalBowlingBall
    ).length;

  const conceded =
    bowling.reduce(
      (
        sum,
        ball
      ) =>
        sum +
        runsChargedToBowler(
          ball
        ),
      0
    );

  const impact =
    runs +
    wickets * 22 +
    fours * 1.5 +
    sixes * 3 +
    (
      balls >= 8
        ? Math.max(
            0,
            safeDivide(
              runs,
              balls
            ) *
              100 -
              100
          ) *
          0.08
        : 0
    ) +
    (
      legalBowls >= 6
        ? Math.max(
            0,
            8 -
              safeDivide(
                conceded,
                legalBowls
              ) *
                6
          ) *
          3
        : 0
    );

  return {
    id:
      match.id,

    shareCode:
      match.shareCode,

    title:
      `${
        match.teamA
          ?.name ||
        "Team A"
      } vs ${
        match.teamB
          ?.name ||
        "Team B"
      }`,

    status:
      match.status,

    date:
      match.scheduledAt ||
      match.matchDate ||
      match.createdAt,

    runs,
    balls,
    fours,
    sixes,
    dismissed,
    wickets,
    legalBowls,
    conceded,

    strikeRate:
      balls
        ? (
            runs /
            balls *
            100
          ).toFixed(1)
        : "0.0",

    economy:
      legalBowls
        ? (
            conceded /
            legalBowls *
            6
          ).toFixed(1)
        : "0.0",

    impact:
      Math.round(
        impact
      ),
  };
}

function aggregatePlayer({
  playerIds,
  matches,
}) {
  const performances =
    matches
      .filter(
        isMatchEligibleForStats
      )
      .map(
        (match) =>
          buildPlayerMatch({
            match,
            playerIds,
          })
      )
      .filter(Boolean);

  const runs =
    performances.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.runs,
      0
    );

  const balls =
    performances.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.balls,
      0
    );

  const fours =
    performances.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.fours,
      0
    );

  const sixes =
    performances.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.sixes,
      0
    );

  const dismissals =
    performances.filter(
      (item) =>
        item.dismissed
    ).length;

  const wickets =
    performances.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.wickets,
      0
    );

  const legalBowls =
    performances.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.legalBowls,
      0
    );

  const conceded =
    performances.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.conceded,
      0
    );

  const highestScore =
    performances.reduce(
      (
        highest,
        item
      ) =>
        Math.max(
          highest,
          item.runs
        ),
      0
    );

  const bestBowling =
    performances.reduce(
      (
        best,
        item
      ) => {
        if (
          item.wickets >
          best.wickets
        ) {
          return {
            wickets:
              item.wickets,
            runs:
              item.conceded,
          };
        }

        if (
          item.wickets ===
            best.wickets &&
          item.wickets > 0 &&
          item.conceded <
            best.runs
        ) {
          return {
            wickets:
              item.wickets,
            runs:
              item.conceded,
          };
        }

        return best;
      },
      {
        wickets: 0,
        runs: 0,
      }
    );

  const completedMatches =
    performances.filter(
      (item) =>
        COMPLETED_STATUSES.has(
          normalizeStatus(
            item.status
          )
        )
    );

  return {
    appearances:
      performances.length,

    completed:
      completedMatches.length,

    runs,
    balls,
    fours,
    sixes,
    dismissals,
    wickets,
    legalBowls,
    conceded,
    highestScore,

    average:
      dismissals
        ? (
            runs /
            dismissals
          ).toFixed(2)
        : runs
          ? runs.toFixed(
              2
            )
          : "0.00",

    strikeRate:
      balls
        ? (
            runs /
            balls *
            100
          ).toFixed(2)
        : "0.00",

    economy:
      legalBowls
        ? (
            conceded /
            legalBowls *
            6
          ).toFixed(2)
        : "0.00",

    overs:
      `${Math.floor(
        legalBowls /
          6
      )}.${legalBowls % 6}`,

    fifties:
      performances.filter(
        (item) =>
          item.runs >=
            50 &&
          item.runs <
            100
      ).length,

    hundreds:
      performances.filter(
        (item) =>
          item.runs >=
          100
      ).length,

    threeWickets:
      performances.filter(
        (item) =>
          item.wickets >=
            3 &&
          item.wickets <
            5
      ).length,

    fiveWickets:
      performances.filter(
        (item) =>
          item.wickets >=
          5
      ).length,

    bestBowling,

    performances,
  };
}

function buildAchievements(
  stats
) {
  const badges = [];

  function unlock({
    key,
    icon,
    title,
    description,
    unlocked,
    progress,
  }) {
    badges.push({
      key,
      icon,
      title,
      description,
      unlocked,
      progress:
        Math.max(
          0,
          Math.min(
            100,
            progress
          )
        ),
    });
  }

  unlock({
    key:
      "CENTURY_CLUB",
    icon:
      "💯",
    title:
      "Century Club",
    description:
      "Score 100 runs in one innings.",
    unlocked:
      stats.hundreds >
      0,
    progress:
      stats.highestScore,
  });

  unlock({
    key:
      "HALF_CENTURY",
    icon:
      "⚡",
    title:
      "Fifty Maker",
    description:
      "Score 50 runs in one innings.",
    unlocked:
      stats.highestScore >=
      50,
    progress:
      stats.highestScore *
      2,
  });

  unlock({
    key:
      "FIVE_WICKET",
    icon:
      "🎯",
    title:
      "Five-Star Spell",
    description:
      "Take five wickets in one match.",
    unlocked:
      stats.fiveWickets >
      0,
    progress:
      stats.bestBowling
        .wickets *
      20,
  });

  unlock({
    key:
      "SIX_HITTER",
    icon:
      "💥",
    title:
      "Six Hitter",
    description:
      "Hit 25 career sixes.",
    unlocked:
      stats.sixes >=
      25,
    progress:
      stats.sixes *
      4,
  });

  unlock({
    key:
      "RUN_MACHINE",
    icon:
      "🏏",
    title:
      "Run Machine",
    description:
      "Reach 1,000 career runs.",
    unlocked:
      stats.runs >=
      1000,
    progress:
      stats.runs /
      10,
  });

  unlock({
    key:
      "WICKET_HUNTER",
    icon:
      "🔥",
    title:
      "Wicket Hunter",
    description:
      "Reach 50 career wickets.",
    unlocked:
      stats.wickets >=
      50,
    progress:
      stats.wickets *
      2,
  });

  unlock({
    key:
      "IRON_PLAYER",
    icon:
      "🛡️",
    title:
      "Iron Player",
    description:
      "Appear in 50 scored matches.",
    unlocked:
      stats.appearances >=
      50,
    progress:
      stats.appearances *
      2,
  });

  unlock({
    key:
      "ALL_ROUNDER",
    icon:
      "🌟",
    title:
      "All-Round Force",
    description:
      "Score 500 runs and take 25 wickets.",
    unlocked:
      stats.runs >=
        500 &&
      stats.wickets >=
        25,
    progress:
      Math.min(
        safeDivide(
          stats.runs,
          500
        ) *
          50 +
          safeDivide(
            stats.wickets,
            25
          ) *
          50,
        100
      ),
  });

  return badges;
}

function nextMilestone(
  value,
  steps
) {
  const target =
    steps.find(
      (step) =>
        step > value
    ) ||
    steps[
      steps.length -
        1
    ];

  const previous =
    [
      0,
      ...steps,
    ]
      .filter(
        (step) =>
          step <= value
      )
      .at(-1) ||
    0;

  const range =
    Math.max(
      1,
      target -
        previous
    );

  return {
    target,
    remaining:
      Math.max(
        0,
        target -
          value
      ),
    progress:
      Math.min(
        100,
        Math.round(
          (
            (
              value -
              previous
            ) /
            range
          ) *
            100
        )
      ),
  };
}

export async function generateMetadata({
  params,
}) {
  const {
    slug,
    playerId,
  } = await params;

  const league =
    await prisma.league
      .findFirst({
        where:
          buildLeagueRouteWhere(
            slug
          ),

        include: {
          members: {
            select: {
              userId: true,
            },
          },

          teams: {
            include: {
              players: true,
            },
          },
        },
      });

  const metadataSession =
    await getServerSession(
      authOptions
    );

  const canViewMetadata =
    await canOpenPlayerCard({
      league,
      session:
        metadataSession,
    });

  if (
    !league ||
    !canViewMetadata
  ) {
    return {
      title:
        "Player Not Found | Cric4All",
    };
  }

  const metadataRosterPlayers =
    league?.teams
      ?.flatMap(
        (team) =>
          team.players.map(
            (item) => ({
              ...item,
              teamId:
                team.id,
              teamName:
                team.name,
            })
          )
      ) || [];

  const metadataGroup =
    buildPlayerIdentityGroups(
      metadataRosterPlayers,
      league
    ).find((group) =>
      group.playerIds.includes(
        number(playerId)
      )
    );

  const player =
    metadataGroup?.player || null;

  if (
    !league ||
    !player ||
    shouldExcludePlayerFromLeagueAnalytics(
      league,
      player
    )
  ) {
    return {
      title:
        "Player Not Found | Cric4All",
    };
  }

  const isPublic =
    String(
      league.visibility ||
      ""
    ).toUpperCase() ===
    "PUBLIC";

  const canonical =
    absoluteCric4AllUrl(
      `/leagues/${league.slug}/players/${player.id}`
    );

  const description =
    `View ${player.name}'s cricket player profile for ${player.teamName} in ${league.name}: batting, bowling, fielding, achievements, form and match history on Cric4All.`;

  return {
    title:
      `${player.name} Cricket Player Profile | ${player.teamName} | Cric4All`,
    description,
    alternates: {
      canonical,
    },
    robots:
      publicPageRobots(
        isPublic
      ),
    openGraph: {
      title:
        `${player.name} Cricket Player Profile | Cric4All`,
      description,
      url:
        canonical,
      type:
        "profile",
      siteName:
        "Cric4All",
    },
    twitter: {
      card:
        "summary",
      title:
        `${player.name} Cricket Player Profile | Cric4All`,
      description,
    },
  };
}

export default async function PublicPlayerPage({
  params,
  searchParams,
}) {
  const {
    slug,
    playerId,
  } = await params;

  const resolvedSearchParams =
    await searchParams;

  const returnToRaw =
    String(
      resolvedSearchParams
        ?.returnTo ||
        ""
    );

  const returnTo =
    returnToRaw.startsWith(
      "/"
    ) &&
    !returnToRaw.startsWith(
      "//"
    )
      ? returnToRaw
      : "";

  const launchedFromPlayers =
    resolvedSearchParams
      ?.from ===
      "players" &&
    returnTo.includes(
      "section=players"
    );

  const backHref =
    launchedFromPlayers
      ? returnTo
      : "/explore";

  const backLabel =
    launchedFromPlayers
      ? "Back to Players"
      : "Explore";

  const league =
    await prisma.league
      .findFirst({
        where:
          buildLeagueRouteWhere(
            slug
          ),

        include: {
          members: {
            select: {
              userId: true,
            },
          },

          teams: {
            include: {
              players: true,
            },
          },

          matches: {
            include: {
              teamA: true,
              teamB: true,
              balls: true,
            },

            orderBy: [
              {
                createdAt:
                  "desc",
              },
            ],
          },
        },
      });

  const session =
    await getServerSession(
      authOptions
    );

  const canViewLeague =
    await canOpenPlayerCard({
      league,
      session,
    });

  if (
    !league ||
    !canViewLeague
  ) {
    notFound();
  }

  const rosterPlayers =
    league.teams.flatMap(
      (team) =>
        team.players.map(
          (item) => ({
            ...item,
            teamId:
              team.id,
            teamName:
              team.name,
          })
        )
    );

  const identityGroups =
    buildPlayerIdentityGroups(
      rosterPlayers,
      league
    ).filter(
      (group) =>
        !shouldExcludePlayerFromLeagueAnalytics(
          league,
          group.player
        )
    );

  const selectedIdentityGroup =
    identityGroups.find(
      (group) =>
        group.playerIds.includes(
          number(playerId)
        )
    );

  if (
    !selectedIdentityGroup ||
    shouldExcludePlayerFromLeagueAnalytics(
      league,
      selectedIdentityGroup.player
    )
  ) {
    notFound();
  }

  /*
   * Rankings also use identity groups. This prevents players shared by
   * Surprise 1 and Surprise 2 from appearing twice or having their separate
   * roster rows compete against each other.
   */
  const allProfiles =
    identityGroups.map(
      (group) => ({
        player:
          group.player,
        playerIds:
          group.playerIds,

        stats:
          aggregatePlayer({
            playerIds:
              group.playerIds,
            matches:
              league.matches,
          }),
      })
    );

  const profile =
    allProfiles.find(
      (item) =>
        item.playerIds.includes(
          number(playerId)
        )
    );

  const player =
    profile.player;

  const stats =
    profile.stats;

  const milestoneRows =
    await prisma.playerMilestone.findMany({
      where: {
        leagueId:
          league.id,

        identityKey:
          selectedIdentityGroup.key,

        isActive:
          true,
      },

      orderBy: [
        {
          achievedAt:
            "desc",
        },
        {
          id:
            "desc",
        },
      ],

      /*
       * Fetch extra rows first because abandoned-match milestones must be
       * removed before enforcing the visible 20-item limit.
       */
      take: 60,
    });

  const milestoneTimeline =
    filterMilestonesForEligibleMatches(
      milestoneRows,
      league.matches
    ).slice(
      0,
      20
    );

  const battingScores =
    allProfiles.map(
      ({ stats: item }) =>
        item.runs +
        item.fours * 2 +
        item.sixes * 4 +
        number(
          item.strikeRate
        ) *
          1.4 +
        item.hundreds *
          80 +
        item.fifties *
          30
    );

  const bowlingScores =
    allProfiles.map(
      ({ stats: item }) =>
        item.wickets *
          30 +
        item.fiveWickets *
          100 +
        item.threeWickets *
          35 +
        (
          item.legalBowls >=
          12
            ? Math.max(
                0,
                9 -
                  number(
                    item.economy
                  )
              ) *
              18
            : 0
        )
    );

  const formScores =
    allProfiles.map(
      ({ stats: item }) =>
        item.performances
          .slice(0, 5)
          .reduce(
            (
              sum,
              performance
            ) =>
              sum +
              performance.impact,
            0
          )
    );

  const battingValue =
    stats.runs +
    stats.fours * 2 +
    stats.sixes * 4 +
    number(
      stats.strikeRate
    ) *
      1.4 +
    stats.hundreds *
      80 +
    stats.fifties *
      30;

  const bowlingValue =
    stats.wickets *
      30 +
    stats.fiveWickets *
      100 +
    stats.threeWickets *
      35 +
    (
      stats.legalBowls >=
      12
        ? Math.max(
            0,
            9 -
              number(
                stats.economy
              )
          ) *
          18
        : 0
    );

  const formValue =
    stats.performances
      .slice(0, 5)
      .reduce(
        (
          sum,
          performance
        ) =>
          sum +
          performance.impact,
        0
      );

  const hasRatedAppearance =
    Number(stats.appearances || 0) > 0;

  const hasBattingSample =
    Number(stats.balls || 0) > 0;

  const hasBowlingSample =
    Number(stats.legalBowls || 0) > 0;

  // Each discipline is ranked only against players who actually participated
  // in that discipline. A rostered player with 0 balls faced or 0 legal balls
  // must not receive a percentile-derived 5.x/6.x rating.
  const activeBattingProfiles =
    allProfiles.filter(
      ({ stats: item }) =>
        Number(item.balls || 0) > 0
    );

  const activeBowlingProfiles =
    allProfiles.filter(
      ({ stats: item }) =>
        Number(item.legalBowls || 0) > 0
    );

  const activeFormProfiles =
    allProfiles.filter(
      ({ stats: item }) =>
        Number(item.appearances || 0) > 0
    );

  const activeBattingScores =
    activeBattingProfiles.map(
      ({ stats: item }) =>
        item.runs +
        item.fours * 2 +
        item.sixes * 4 +
        number(item.strikeRate) * 1.4 +
        item.hundreds * 80 +
        item.fifties * 30
    );

  const activeBowlingScores =
    activeBowlingProfiles.map(
      ({ stats: item }) =>
        item.wickets * 30 +
        item.fiveWickets * 100 +
        item.threeWickets * 35 +
        (
          item.legalBowls >= 12
            ? Math.max(
                0,
                9 - number(item.economy)
              ) * 18
            : 0
        )
    );

  const activeFormScores =
    activeFormProfiles.map(
      ({ stats: item }) =>
        item.performances
          .slice(0, 5)
          .reduce(
            (sum, performance) =>
              sum + performance.impact,
            0
          )
    );

  const battingPercentile =
    hasBattingSample
      ? percentileRank(
          activeBattingScores,
          battingValue
        )
      : null;

  const bowlingPercentile =
    hasBowlingSample
      ? percentileRank(
          activeBowlingScores,
          bowlingValue
        )
      : null;

  const formPercentile =
    hasRatedAppearance
      ? percentileRank(
          activeFormScores,
          formValue
        )
      : null;

  const battingRating =
    hasBattingSample
      ? ratingFromPercentile(
          battingPercentile
        )
      : null;

  const bowlingRating =
    hasBowlingSample
      ? ratingFromPercentile(
          bowlingPercentile
        )
      : null;

  const formRating =
    hasRatedAppearance
      ? ratingFromPercentile(
          formPercentile
        )
      : null;

  const ratingComponents = [
    {
      value: battingRating,
      percentile: battingPercentile,
      weight: 0.42,
    },
    {
      value: bowlingRating,
      percentile: bowlingPercentile,
      weight: 0.38,
    },
    {
      value: formRating,
      percentile: formPercentile,
      weight: 0.2,
    },
  ].filter(
    (component) =>
      Number.isFinite(component.value) &&
      Number.isFinite(component.percentile)
  );

  const ratingWeight =
    ratingComponents.reduce(
      (sum, component) =>
        sum + component.weight,
      0
    );

  const overallRating =
    ratingWeight > 0
      ? Number(
          (
            ratingComponents.reduce(
              (sum, component) =>
                sum +
                component.value *
                  component.weight,
              0
            ) /
            ratingWeight
          ).toFixed(1)
        )
      : null;

  const overallPercentile =
    ratingWeight > 0
      ? Math.round(
          ratingComponents.reduce(
            (sum, component) =>
              sum +
              component.percentile *
                component.weight,
            0
          ) /
            ratingWeight
        )
      : null;

  function calculateProfileOverallRating(
    itemStats
  ) {
    const itemBattingValue =
      itemStats.runs +
      itemStats.fours * 2 +
      itemStats.sixes * 4 +
      number(itemStats.strikeRate) * 1.4 +
      itemStats.hundreds * 80 +
      itemStats.fifties * 30;

    const itemBowlingValue =
      itemStats.wickets * 30 +
      itemStats.fiveWickets * 100 +
      itemStats.threeWickets * 35 +
      (
        itemStats.legalBowls >= 12
          ? Math.max(
              0,
              9 - number(itemStats.economy)
            ) * 18
          : 0
      );

    const itemFormValue =
      itemStats.performances
        .slice(0, 5)
        .reduce(
          (sum, performance) =>
            sum + performance.impact,
          0
        );

    const parts = [];

    if (
      Number(itemStats.balls || 0) > 0
    ) {
      parts.push({
        rating: ratingFromPercentile(
          percentileRank(
            activeBattingScores,
            itemBattingValue
          )
        ),
        weight: 0.42,
      });
    }

    if (
      Number(itemStats.legalBowls || 0) > 0
    ) {
      parts.push({
        rating: ratingFromPercentile(
          percentileRank(
            activeBowlingScores,
            itemBowlingValue
          )
        ),
        weight: 0.38,
      });
    }

    if (
      Number(itemStats.appearances || 0) > 0
    ) {
      parts.push({
        rating: ratingFromPercentile(
          percentileRank(
            activeFormScores,
            itemFormValue
          )
        ),
        weight: 0.2,
      });
    }

    const weight = parts.reduce(
      (sum, part) =>
        sum + part.weight,
      0
    );

    if (!weight) {
      return null;
    }

    return Number(
      (
        parts.reduce(
          (sum, part) =>
            sum +
            part.rating *
              part.weight,
          0
        ) /
        weight
      ).toFixed(1)
    );
  }

  const leagueRank =
    overallRating == null
      ? null
      : allProfiles
          .map(
            (item) => ({
              playerIds:
                item.playerIds,
              score:
                calculateProfileOverallRating(
                  item.stats
                ),
            })
          )
          .filter(
            (item) =>
              Number.isFinite(
                item.score
              )
          )
          .sort(
            (left, right) =>
              right.score -
              left.score
          )
          .findIndex(
            (item) =>
              item.playerIds.includes(
                number(playerId)
              )
          ) + 1;

  const achievements =
    buildAchievements(
      stats
    );

  const unlocked =
    achievements.filter(
      (item) =>
        item.unlocked
    );

  const recentForm =
    stats.performances.slice(
      0,
      5
    );

  const formDirection =
    recentForm.length >=
      2 &&
    recentForm[0].impact >
      recentForm.at(-1)
        .impact
      ? "Improving"
      : recentForm.length >=
            2 &&
          recentForm[0]
            .impact <
            recentForm.at(-1)
              .impact
        ? "Cooling"
        : "Steady";

  const insight =
    stats.runs === 0 &&
    stats.wickets === 0
      ? "A new Cric4All profile. Match performances will unlock ratings, badges and form insights."
      : stats.runs >=
          stats.wickets *
            20
        ? `Batting drives this profile. ${player.name} has scored ${stats.runs} runs at a strike rate of ${stats.strikeRate}.`
        : stats.wickets >
            0 &&
          stats.wickets *
            20 >
            stats.runs
          ? `Bowling is the strongest discipline. ${player.name} has ${stats.wickets} wickets at an economy of ${stats.economy}.`
          : `A balanced contribution profile with ${stats.runs} runs and ${stats.wickets} wickets across ${stats.appearances} appearances.`;

  const runMilestone =
    nextMilestone(
      stats.runs,
      [
        100,
        250,
        500,
        1000,
        2000,
        3000,
        5000,
      ]
    );

  const wicketMilestone =
    nextMilestone(
      stats.wickets,
      [
        10,
        25,
        50,
        100,
        150,
        200,
      ]
    );

  const matchMilestone =
    nextMilestone(
      stats.appearances,
      [
        10,
        25,
        50,
        100,
        150,
        200,
      ]
    );

  const bestBowling =
    stats.bestBowling
      .wickets > 0
      ? `${stats.bestBowling.wickets}/${stats.bestBowling.runs}`
      : "—";

  const shareText =
    `${player.name} on Cric4All: ${stats.runs} runs, ${stats.wickets} wickets, ${hasRatedAppearance ? `${overallRating}/10 rating` : "not yet rated"} and ${unlocked.length} achievements.`;

  const isPublicForSeo =
    String(
      league.visibility ||
      ""
    ).toUpperCase() ===
    "PUBLIC";

  const playerJsonLd =
    isPublicForSeo
      ? {
          "@context":
            "https://schema.org",
          "@type":
            "Person",
          name:
            player.name,
          url:
            absoluteCric4AllUrl(
              `/leagues/${league.slug}/players/${player.id}`
            ),
          memberOf: {
            "@type":
              "SportsTeam",
            name:
              player.teamName,
            sport:
              "Cricket",
            url:
              player.teamId
                ? absoluteCric4AllUrl(
                    `/leagues/${league.slug}/teams/${player.teamId}`
                  )
                : undefined,
          },
        }
      : null;

  return (
    <>
      <SeoJsonLd data={playerJsonLd} />

      <main className="spf-page">
      <section className="spf-shell">
        <header className="spf-hero">
          <div className="spf-topbar">
            <nav
              className="spf-back-nav"
              aria-label="Player navigation"
            >
              <Link
                href={
                  backHref
                }
                className="spf-back-button"
              >
                <span aria-hidden="true">
                  ←
                </span>

                {backLabel}
              </Link>

              <Link
                href={`/leagues/${league.slug}`}
                className="spf-context-link"
              >
                {league.name}
              </Link>

              {player.teamMemberships.map(
                (membership) => (
                  <Link
                    key={membership.teamId}
                    href={`/leagues/${league.slug}/teams/${membership.teamId}`}
                    className="spf-context-link"
                  >
                    {membership.teamName}
                  </Link>
                )
              )}

              <strong>
                {player.name}
              </strong>
            </nav>

            <span className="spf-public-badge">
              <span aria-hidden="true" />
              Interactive player card
            </span>
          </div>

          <div className="spf-hero-main">
            <div className="spf-player-identity">
              <div
                className="spf-player-avatar"
                aria-hidden="true"
              >
                {getInitials(
                  player.name
                )}
              </div>

              <div className="spf-player-copy">
                <p className="spf-eyebrow">
                  Cric4All player card
                  {player.combinedProfile && (
                    <span className="spf-combined-profile-badge">
                      Combined Surprise Cricket League
                    </span>
                  )}
                </p>

                <h1>
                  {player.name}
                </h1>

                <p className="spf-subtitle">
                  <span className="spf-team-memberships">
                    {player.teamMemberships.map(
                      (membership, index) => (
                        <span key={membership.teamId}>
                          {index > 0 && (
                            <span aria-hidden="true">
                              {" & "}
                            </span>
                          )}

                          <Link
                            href={`/leagues/${league.slug}/teams/${membership.teamId}`}
                          >
                            {membership.teamName}
                          </Link>
                        </span>
                      )
                    )}
                  </span>

                  <span aria-hidden="true">
                    •
                  </span>

                  <Link
                    href={`/leagues/${league.slug}`}
                  >
                    {league.name}
                  </Link>
                </p>
              </div>
            </div>

            <div className="spf-rating-card">
              <div className="spf-rating-ring">
                <strong>
                  {hasRatedAppearance ? overallRating : "—"}
                </strong>
                <span>
                  {hasRatedAppearance ? "/10" : ""}
                </span>
              </div>

              <div>
                <small>
                  CRIC4ALL RATING
                </small>

                <strong>
                  {hasRatedAppearance
                    ? `League rank #${leagueRank}`
                    : "Not rated"}
                </strong>

                <span>
                  {hasRatedAppearance
                    ? `Top ${Math.max(
                        1,
                        100 - overallPercentile
                      )}%`
                    : "Complete a scored appearance"}
                </span>
              </div>
            </div>
          </div>

          <div className="spf-hero-dashboard">
            <div>
              <span>
                Appearances
              </span>
              <strong>
                {stats.appearances}
              </strong>
            </div>

            <div>
              <span>
                Runs
              </span>
              <strong>
                {stats.runs}
              </strong>
            </div>

            <div>
              <span>
                Wickets
              </span>
              <strong>
                {stats.wickets}
              </strong>
            </div>

            <div>
              <span>
                Achievements
              </span>
              <strong>
                {unlocked.length}
              </strong>
            </div>

            <PlayerCardActions
              playerName={
                player.name
              }
              shareText={
                shareText
              }
              compareHref={
                `/leagues/${league.slug}/compare?playerA=${player.id}`
              }
              journeyHref={
                `/leagues/${league.slug}/players/${player.id}/journey`
              }
              feedHref={
                `/leagues/${league.slug}/players/${player.id}/feed`
              }
            />
          </div>

          <div className="spf-profile-note">
            <span aria-hidden="true">
              ✦
            </span>

            <div>
              <strong>
                Performance insight
              </strong>

              <p>
                {insight}
              </p>
            </div>
          </div>
        </header>

        <div className="spf-content">
          <section className="spf-rating-section">
            <div className="spf-section-heading">
              <div>
                <p>
                  Player DNA
                </p>

                <h2>
                  Rating breakdown
                </h2>
              </div>

              <span>
                League-relative
              </span>
            </div>

            <div className="spf-rating-grid">
              {[
                {
                  icon:
                    "🏏",
                  label:
                    "Batting",
                  value:
                    battingRating,
                  percentile:
                    battingPercentile,
                },
                {
                  icon:
                    "🎯",
                  label:
                    "Bowling",
                  value:
                    bowlingRating,
                  percentile:
                    bowlingPercentile,
                },
                {
                  icon:
                    "🔥",
                  label:
                    "Current form",
                  value:
                    formRating,
                  percentile:
                    formPercentile,
                },
              ].map(
                (rating) => (
                  <article
                    key={
                      rating.label
                    }
                    className="spf-rating-detail"
                  >
                    <div>
                      <span aria-hidden="true">
                        {rating.icon}
                      </span>

                      <strong>
                        {rating.label}
                      </strong>

                      <b>
                        {rating.value ?? "—"}
                      </b>
                    </div>

                    <div className="spf-meter">
                      <span
                        style={{
                          width:
                            `${rating.percentile ?? 0}%`,
                        }}
                      />
                    </div>

                    <small>
                      {rating.percentile == null
                        ? "Not rated until first scored appearance"
                        : <>
                            Better than{" "}
                            {rating.percentile}%{" "}
                            of active league profiles
                          </>}
                    </small>
                  </article>
                )
              )}
            </div>

            <p className="spf-rating-method">
              Ratings are calculated from scored league deliveries, career production and the latest five appearances. They update automatically and are not manually assigned.
            </p>
          </section>

          <section className="spf-performance-section">
            <div className="spf-section-heading">
              <div>
                <p>
                  Performance overview
                </p>

                <h2>
                  Career statistics
                </h2>
              </div>

              <span>
                {stats.appearances}{" "}
                {stats.appearances ===
                1
                  ? "appearance"
                  : "appearances"}
              </span>
            </div>

            <div className="spf-discipline-grid">
              <article className="spf-discipline-card spf-batting-card">
                <header>
                  <div
                    className="spf-discipline-icon"
                    aria-hidden="true"
                  >
                    🏏
                  </div>

                  <div>
                    <span>
                      Batting
                    </span>

                    <h3>
                      Batting record
                    </h3>
                  </div>
                </header>

                <div className="spf-stat-grid">
                  <div className="spf-stat-primary">
                    <span>
                      Runs
                    </span>

                    <strong>
                      {stats.runs}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Average
                    </span>

                    <strong>
                      {stats.average}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Strike rate
                    </span>

                    <strong>
                      {stats.strikeRate}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Highest
                    </span>

                    <strong>
                      {stats.highestScore}
                    </strong>
                  </div>

                  <div>
                    <span>
                      50s / 100s
                    </span>

                    <strong>
                      {stats.fifties} / {stats.hundreds}
                    </strong>
                  </div>

                  <div>
                    <span>
                      4s / 6s
                    </span>

                    <strong>
                      {stats.fours} / {stats.sixes}
                    </strong>
                  </div>
                </div>
              </article>

              <article className="spf-discipline-card spf-bowling-card">
                <header>
                  <div
                    className="spf-discipline-icon"
                    aria-hidden="true"
                  >
                    🎯
                  </div>

                  <div>
                    <span>
                      Bowling
                    </span>

                    <h3>
                      Bowling record
                    </h3>
                  </div>
                </header>

                <div className="spf-stat-grid">
                  <div className="spf-stat-primary">
                    <span>
                      Wickets
                    </span>

                    <strong>
                      {stats.wickets}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Overs
                    </span>

                    <strong>
                      {stats.overs}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Economy
                    </span>

                    <strong>
                      {stats.economy}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Best
                    </span>

                    <strong>
                      {bestBowling}
                    </strong>
                  </div>

                  <div>
                    <span>
                      3W / 5W
                    </span>

                    <strong>
                      {stats.threeWickets} / {stats.fiveWickets}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Runs conceded
                    </span>

                    <strong>
                      {stats.conceded}
                    </strong>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section className="spf-form-section">
            <div className="spf-section-heading">
              <div>
                <p>
                  Momentum
                </p>

                <h2>
                  Current form
                </h2>
              </div>

              <span
                className={`spf-form-label is-${formDirection.toLowerCase()}`}
              >
                {formDirection}
              </span>
            </div>

            {recentForm.length ? (
              <div className="spf-form-card">
                <div className="spf-form-dots">
                  {recentForm.map(
                    (
                      performance,
                      index
                    ) => {
                      const level =
                        performance.impact >=
                        80
                          ? "elite"
                          : performance.impact >=
                              45
                            ? "strong"
                            : performance.impact >=
                                20
                              ? "steady"
                              : "quiet";

                      return (
                        <div
                          key={
                            performance.id
                          }
                          className={`spf-form-dot is-${level}`}
                          title={`${performance.runs} runs, ${performance.wickets} wickets`}
                        >
                          <span>
                            {index + 1}
                          </span>

                          <strong>
                            {performance.impact}
                          </strong>

                          <small>
                            Impact
                          </small>
                        </div>
                      );
                    }
                  )}
                </div>

                <div className="spf-form-summary">
                  <div>
                    <span>
                      Last 5 runs
                    </span>

                    <strong>
                      {recentForm.reduce(
                        (
                          sum,
                          item
                        ) =>
                          sum +
                          item.runs,
                        0
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Last 5 wickets
                    </span>

                    <strong>
                      {recentForm.reduce(
                        (
                          sum,
                          item
                        ) =>
                          sum +
                          item.wickets,
                        0
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Best recent impact
                    </span>

                    <strong>
                      {Math.max(
                        ...recentForm.map(
                          (item) =>
                            item.impact
                        )
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="spf-empty-state">
                <span aria-hidden="true">
                  ◌
                </span>

                <div>
                  <strong>
                    Form will appear after scoring
                  </strong>

                  <p>
                    The latest five scored appearances create this player&apos;s form line.
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="spf-achievements-section">
            <div className="spf-section-heading">
              <div>
                <p>
                  Unlockable
                </p>

                <h2>
                  Achievements
                </h2>
              </div>

              <span>
                {unlocked.length}/{achievements.length} unlocked
              </span>
            </div>

            <div className="spf-achievement-grid">
              {achievements.map(
                (achievement) => (
                  <article
                    key={
                      achievement.key
                    }
                    className={`spf-achievement ${
                      achievement.unlocked
                        ? "is-unlocked"
                        : "is-locked"
                    }`}
                  >
                    <div className="spf-achievement-icon">
                      {achievement.unlocked
                        ? achievement.icon
                        : "🔒"}
                    </div>

                    <div>
                      <span>
                        {achievement.unlocked
                          ? "Unlocked"
                          : `${achievement.progress}%`}
                      </span>

                      <h3>
                        {achievement.title}
                      </h3>

                      <p>
                        {achievement.description}
                      </p>
                    </div>

                    {!achievement.unlocked && (
                      <div className="spf-achievement-progress">
                        <span
                          style={{
                            width:
                              `${achievement.progress}%`,
                          }}
                        />
                      </div>
                    )}
                  </article>
                )
              )}
            </div>
          </section>

          <section className="spf-milestone-section">
            <div className="spf-section-heading">
              <div>
                <p>
                  What&apos;s next
                </p>

                <h2>
                  Milestone chase
                </h2>
              </div>

              <span>
                Live progress
              </span>
            </div>

            <div className="spf-milestone-grid">
              {[
                {
                  icon:
                    "🏏",
                  label:
                    `${runMilestone.target} career runs`,
                  value:
                    stats.runs,
                  remaining:
                    runMilestone.remaining,
                  progress:
                    runMilestone.progress,
                  unit:
                    "runs",
                },
                {
                  icon:
                    "🎯",
                  label:
                    `${wicketMilestone.target} career wickets`,
                  value:
                    stats.wickets,
                  remaining:
                    wicketMilestone.remaining,
                  progress:
                    wicketMilestone.progress,
                  unit:
                    "wickets",
                },
                {
                  icon:
                    "🛡️",
                  label:
                    `${matchMilestone.target} appearances`,
                  value:
                    stats.appearances,
                  remaining:
                    matchMilestone.remaining,
                  progress:
                    matchMilestone.progress,
                  unit:
                    "matches",
                },
              ].map(
                (milestone) => (
                  <article
                    key={
                      milestone.label
                    }
                    className="spf-milestone"
                  >
                    <span
                      className="spf-milestone-icon"
                      aria-hidden="true"
                    >
                      {milestone.icon}
                    </span>

                    <div>
                      <small>
                        NEXT MILESTONE
                      </small>

                      <h3>
                        {milestone.label}
                      </h3>

                      <p>
                        {milestone.remaining > 0
                          ? `${milestone.remaining} ${milestone.unit} to go`
                          : "Milestone reached"}
                      </p>
                    </div>

                    <strong>
                      {milestone.value}
                    </strong>

                    <div className="spf-milestone-track">
                      <span
                        style={{
                          width:
                            `${milestone.progress}%`,
                        }}
                      />
                    </div>
                  </article>
                )
              )}
            </div>
          </section>


          <section className="spf-earned-milestones-section">
            <div className="spf-section-heading">
              <div>
                <p>
                  Career moments
                </p>

                <h2>
                  Milestone timeline
                </h2>
              </div>

              <span>
                {milestoneTimeline.length} recorded
              </span>
            </div>

            {milestoneTimeline.length ? (
              <div className="spf-earned-milestone-list">
                {milestoneTimeline.map(
                  (milestone) => {
                    const metadata =
                      milestone.metadata &&
                      typeof milestone.metadata ===
                        "object"
                        ? milestone.metadata
                        : {};

                    return (
                      <article
                        key={
                          milestone.id
                        }
                        className="spf-earned-milestone"
                      >
                        <div
                          className="spf-earned-milestone-icon"
                          aria-hidden="true"
                        >
                          {milestone.icon ||
                            "🏆"}
                        </div>

                        <div className="spf-earned-milestone-copy">
                          <small>
                            {new Intl.DateTimeFormat(
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
                              new Date(
                                milestone.achievedAt
                              )
                            )}
                          </small>

                          <h3>
                            {milestone.title}
                          </h3>

                          <p>
                            {milestone.description}
                          </p>

                          {metadata.matchLabel && (
                            <span>
                              {metadata.matchLabel}
                            </span>
                          )}
                        </div>

                        {milestone.matchId && (
                          <strong>
                            Match #{milestone.matchId}
                          </strong>
                        )}
                      </article>
                    );
                  }
                )}
              </div>
            ) : (
              <div className="spf-empty-state">
                <span aria-hidden="true">
                  🏆
                </span>

                <div>
                  <strong>
                    Milestones will appear here
                  </strong>

                  <p>
                    Career milestones are recorded automatically as new deliveries are scored.
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="spf-history-section">
            <div className="spf-section-heading">
              <div>
                <p>
                  Recent appearances
                </p>

                <h2>
                  Match history
                </h2>
              </div>

              <span>
                Latest{" "}
                {Math.min(
                  stats.performances.length,
                  10
                )}{" "}
                matches
              </span>
            </div>

            {stats.performances.length ===
            0 ? (
              <div className="spf-empty-state">
                <span aria-hidden="true">
                  ◌
                </span>

                <div>
                  <strong>
                    No match history yet
                  </strong>

                  <p>
                    This player has not appeared in any scored matches.
                  </p>
                </div>
              </div>
            ) : (
              <div className="spf-match-list">
                {stats.performances
                  .slice(0, 10)
                  .map(
                    (
                      match,
                      index
                    ) => {
                      const statusClass =
                        getStatusClass(
                          match.status
                        );

                      return (
                        <article
                          className="spf-match-row"
                          key={
                            match.id
                          }
                        >
                          <span
                            className="spf-match-number"
                            aria-hidden="true"
                          >
                            {String(
                              index +
                                1
                            ).padStart(
                              2,
                              "0"
                            )}
                          </span>

                          <div className="spf-match-main">
                            <div className="spf-match-title">
                              <span
                                className={`spf-status ${statusClass}`}
                              >
                                <span aria-hidden="true" />

                                {formatStatus(
                                  match.status
                                )}
                              </span>

                              <strong>
                                {match.title}
                              </strong>

                              {match.date && (
                                <small>
                                  {formatDate(
                                    match.date
                                  )}
                                </small>
                              )}
                            </div>

                            <div className="spf-match-performance">
                              <span>
                                <b>
                                  {match.runs}
                                </b>
                                runs
                              </span>

                              <span>
                                <b>
                                  {match.strikeRate}
                                </b>
                                SR
                              </span>

                              <span>
                                <b>
                                  {match.wickets}
                                </b>
                                wickets
                              </span>

                              <span>
                                <b>
                                  {match.impact}
                                </b>
                                impact
                              </span>
                            </div>
                          </div>

                          {match.shareCode ? (
                            <a
                              className="spf-scorecard-link"
                              href={`/live/${match.shareCode}`}
                            >
                              Scorecard

                              <span aria-hidden="true">
                                →
                              </span>
                            </a>
                          ) : (
                            <span className="spf-unavailable">
                              No scorecard
                            </span>
                          )}
                        </article>
                      );
                    }
                  )}
              </div>
            )}
          </section>

          <footer className="spf-footer-note">
            <span aria-hidden="true">
              ↻
            </span>

            This public player card updates automatically as new league deliveries are scored.
          </footer>
        </div>
      </section>
      </main>
    </>
  );
}
