import prisma from "@/lib/prisma";
import {
  isMatchEligibleForStats,
  filterMilestonesForEligibleMatches,
} from "@/lib/stat-match";
import Link from "next/link";
import {
  getServerSession,
} from "next-auth";
import {
  notFound,
} from "next/navigation";

import {
  authOptions,
} from "@/lib/auth";

import {
  selectTopEstablishedRival,
} from "@/lib/player-rivalry";
import { shouldExcludePlayerFromLeagueAnalytics } from "@/lib/player-analytics-exclusions";
import { getSurpriseIdentityKey } from "@/lib/surprise-player-identity";

import FeedShareButton from "./FeedShareButton";
import "@/app/player-home-feed.css";

const BOWLER_WICKET_EXCLUSIONS =
  new Set([
    "RUN_OUT",
    "RETIRED_OUT",
    "RETIRED_HURT",
  ]);

const RUN_MILESTONES = [
  100,
  250,
  500,
  1000,
  2000,
  3000,
  5000,
];

const WICKET_MILESTONES = [
  10,
  25,
  50,
  100,
  150,
  200,
];

const SIX_MILESTONES = [
  10,
  25,
  50,
  100,
  150,
  200,
];

const APPEARANCE_MILESTONES = [
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

function buildLeagueWhere(
  routeValue
) {
  const value =
    String(
      routeValue ||
        ""
    ).trim();

  const numericId =
    Number(value);

  if (
    Number.isInteger(
      numericId
    ) &&
    numericId > 0
  ) {
    return {
      OR: [
        {
          slug: value,
        },
        {
          id: numericId,
        },
      ],
    };
  }

  return {
    slug: value,
  };
}

async function getSessionUserId(
  session
) {
  const directId =
    String(
      session?.user?.id ||
        ""
    ).trim();

  if (directId) {
    return directId;
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

async function canViewLeague({
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

function identityKey(
  player,
  league
) {
  return getSurpriseIdentityKey(
    player,
    league
  );
}

function resolveIdentity({
  rosterPlayers,
  selectedPlayerId,
  league,
}) {
  const selected =
    rosterPlayers.find(
      (player) =>
        number(
          player.id
        ) ===
        number(
          selectedPlayerId
        )
    );

  if (!selected) {
    return null;
  }

  const key =
    identityKey(
      selected,
      league
    );

  const players =
    rosterPlayers.filter(
      (player) =>
        identityKey(
          player,
          league
        ) === key
    );

  return {
    key,
    name:
      selected.name,
    representativePlayerId:
      number(
        selected.id
      ),
    playerIds:
      players.map(
        (player) =>
          number(
            player.id
          )
      ),
    teamIds:
      players.map(
        (player) =>
          number(
            player.teamId
          )
      ),
    teamNames:
      Array.from(
        new Set(
          players.map(
            (player) =>
              player.teamName
          )
        )
      ),
  };
}

function matchDate(
  match
) {
  return new Date(
    match.matchDate ||
      match.scheduledAt ||
      match.createdAt
  );
}

function formatDate(
  value
) {
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

function nextThreshold({
  current,
  thresholds,
}) {
  const next =
    thresholds.find(
      (value) =>
        value >
        current
    );

  if (!next) {
    return null;
  }

  return {
    target:
      next,
    remaining:
      next -
      current,
  };
}

function getOpponent({
  match,
  teamIds,
}) {
  const ids =
    new Set(
      teamIds
    );

  if (
    ids.has(
      number(
        match.teamAId
      )
    )
  ) {
    return match.teamB;
  }

  if (
    ids.has(
      number(
        match.teamBId
      )
    )
  ) {
    return match.teamA;
  }

  return null;
}

function buildFeed({
  identity,
  matches,
  milestones,
  league,
  excludePlayerName = () => false,
}) {
  const playerIds =
    new Set(
      identity.playerIds
    );

  const completed = [];
  const upcoming = [];
  const rivalryMap =
    new Map();

  let runs = 0;
  let wickets = 0;
  let sixes = 0;
  let appearances = 0;
  let highestScore = 0;
  let bestWickets = 0;

  const now =
    new Date();

  for (
    const match of
    matches
  ) {
    const balls =
      match.balls ||
      [];

    const battingBalls =
      balls.filter(
        (ball) =>
          playerIds.has(
            number(
              ball.strikerId
            )
          )
      );

    const bowlingBalls =
      balls.filter(
        (ball) =>
          playerIds.has(
            number(
              ball.bowlerId
            )
          )
      );

    const dismissed =
      balls.some(
        (ball) =>
          playerIds.has(
            number(
              ball.dismissedPlayerId
            )
          )
      );

    const participated =
      battingBalls.length >
        0 ||
      bowlingBalls.length >
        0 ||
      dismissed;

    const belongsToTeam =
      identity.teamIds.includes(
        number(
          match.teamAId
        )
      ) ||
      identity.teamIds.includes(
        number(
          match.teamBId
        )
      );

    const status =
      String(
        match.status ||
          ""
      )
        .trim()
        .toLowerCase();

    const date =
      matchDate(
        match
      );

    const isUpcoming =
      belongsToTeam &&
      (
        [
          "scheduled",
          "upcoming",
          "created",
        ].includes(
          status
        ) ||
        date >
          now
      );

    if (
      isUpcoming
    ) {
      upcoming.push({
        id:
          match.id,
        date,
        title:
          `${
            match.teamA?.name ||
            "Team A"
          } vs ${
            match.teamB?.name ||
            "Team B"
          }`,
        opponent:
          getOpponent({
            match,
            teamIds:
              identity.teamIds,
          }),
      });
    }

    // Abandoned matches may remain visible in match history, but they must
    // never contribute to player stats, form, momentum, milestones, or rivalry.
    if (
      !isMatchEligibleForStats(
        match
      )
    ) {
      continue;
    }

    if (
      !participated
    ) {
      continue;
    }

    appearances +=
      1;

    const matchRuns =
      battingBalls.reduce(
        (sum, ball) =>
          sum +
          number(
            ball.runsOffBat
          ),
        0
      );

    const matchBalls =
      battingBalls.filter(
        isLegalBallFaced
      ).length;

    const matchSixes =
      battingBalls.filter(
        (ball) =>
          number(
            ball.runsOffBat
          ) === 6
      ).length;

    const matchWickets =
      bowlingBalls.filter(
        isBowlerWicket
      ).length;

    runs +=
      matchRuns;
    wickets +=
      matchWickets;
    sixes +=
      matchSixes;
    highestScore =
      Math.max(
        highestScore,
        matchRuns
      );
    bestWickets =
      Math.max(
        bestWickets,
        matchWickets
      );

    const impact =
      Math.round(
        matchRuns +
        matchWickets *
          24 +
        matchSixes *
          3
      );

    completed.push({
      id:
        match.id,
      date,
      title:
        `${
          match.teamA?.name ||
          "Team A"
        } vs ${
          match.teamB?.name ||
          "Team B"
        }`,
      runs:
        matchRuns,
      balls:
        matchBalls,
      wickets:
        matchWickets,
      sixes:
        matchSixes,
      impact,
      opponent:
        getOpponent({
          match,
          teamIds:
            identity.teamIds,
        }),
    });

    for (
      const ball of
      balls
    ) {
      const strikerId =
        number(
          ball.strikerId
        );
      const bowlerId =
        number(
          ball.bowlerId
        );

      let opponentId =
        null;

      if (
        playerIds.has(
          strikerId
        ) &&
        bowlerId &&
        !playerIds.has(
          bowlerId
        )
      ) {
        opponentId =
          bowlerId;
      } else if (
        playerIds.has(
          bowlerId
        ) &&
        strikerId &&
        !playerIds.has(
          strikerId
        )
      ) {
        opponentId =
          strikerId;
      }

      if (!opponentId) {
        continue;
      }

      const key =
        String(
          opponentId
        );

      if (
        !rivalryMap.has(
          key
        )
      ) {
        rivalryMap.set(
          key,
          {
            playerId:
              opponentId,
            matches:
              new Set(),
            balls: 0,
            runs: 0,
            dismissals: 0,
          }
        );
      }

      const row =
        rivalryMap.get(
          key
        );

      row.matches.add(
        match.id
      );

      if (
        playerIds.has(
          strikerId
        )
      ) {
        row.runs +=
          number(
            ball.runsOffBat
          );

        if (
          isLegalBallFaced(
            ball
          )
        ) {
          row.balls +=
            1;
        }
      }

      if (
        playerIds.has(
          bowlerId
        ) &&
        isBowlerWicket(
          ball
        ) &&
        number(
          ball.dismissedPlayerId
        ) ===
          opponentId
      ) {
        row.dismissals +=
          1;
      }
    }
  }

  const recent =
    [...completed]
      .sort(
        (left, right) =>
          right.date -
          left.date
      )
      .slice(0, 5);

  const recentImpact =
    recent.reduce(
      (sum, row) =>
        sum +
        row.impact,
      0
    );

  const prior =
    [...completed]
      .sort(
        (left, right) =>
          right.date -
          left.date
      )
      .slice(5, 10);

  const priorImpact =
    prior.reduce(
      (sum, row) =>
        sum +
        row.impact,
      0
    );

  const recentAverage =
    recent.length
      ? recentImpact /
        recent.length
      : 0;

  const priorAverage =
    prior.length
      ? priorImpact /
        prior.length
      : 0;

  const trendDelta =
    recentAverage -
    priorAverage;

  const formLabel =
    recentAverage >=
    70
      ? "Red hot"
      : recentAverage >=
        45
        ? "Strong form"
        : recentAverage >=
          25
          ? "Building"
          : "Quiet spell";

  const trendLabel =
    trendDelta >
    8
      ? "Rising"
      : trendDelta <
        -8
        ? "Cooling"
        : "Steady";

  const playerLookup =
    new Map();

  for (
    const match of
    matches
  ) {
    for (
      const team of
      [
        match.teamA,
        match.teamB,
      ]
    ) {
      for (
        const player of
        team?.players ||
        []
      ) {
        playerLookup.set(
          number(
            player.id
          ),
          {
            id:
              player.id,
            name:
              player.name,
            teamName:
              team.name,
          }
        );
      }
    }
  }

  /*
   * Established Rivalry is now sourced from the same canonical engine as
   * Player Journey. Strong one-match batting spells remain Compare-only
   * Notable Matchups and cannot replace the career rival in My Feed.
   */
  const topRival =
    selectTopEstablishedRival({
      candidates:
        Array.from(
          rivalryMap.values()
        )
        .filter(
          (row) =>
            !excludePlayerName(
              playerLookup.get(row.playerId)?.name || ""
            )
        )
        .map(
          (row) => ({
            playerId:
              row.playerId,
            player:
              playerLookup.get(
                row.playerId
              ),
            matchIds:
              row.matches,
            balls:
              row.balls,
            runs:
              row.runs,
            dismissals:
              row.dismissals,
          })
        ),
      getIdentityKey:
        (player) =>
          identityKey(
            player,
            league
          ),
    });

  const nextMatch =
    [...upcoming].sort(
      (left, right) =>
        left.date -
        right.date
    )[0] ||
    null;

  const nextRun =
    nextThreshold({
      current:
        runs,
      thresholds:
        RUN_MILESTONES,
    });

  const nextWicket =
    nextThreshold({
      current:
        wickets,
      thresholds:
        WICKET_MILESTONES,
    });

  const nextSix =
    nextThreshold({
      current:
        sixes,
      thresholds:
        SIX_MILESTONES,
    });

  const nextAppearance =
    nextThreshold({
      current:
        appearances,
      thresholds:
        APPEARANCE_MILESTONES,
    });

  const milestoneCards =
    [
      nextRun &&
        {
          key:
            "runs",
          icon:
            "🏏",
          label:
            "Next batting milestone",
          title:
            `${nextRun.remaining} runs away`,
          description:
            `${nextRun.target.toLocaleString()} career runs`,
          progress:
            Math.round(
              runs /
                nextRun.target *
                100
            ),
        },

      nextWicket &&
        {
          key:
            "wickets",
          icon:
            "🎯",
          label:
            "Next bowling milestone",
          title:
            `${nextWicket.remaining} wickets away`,
          description:
            `${nextWicket.target} career wickets`,
          progress:
            Math.round(
              wickets /
                nextWicket.target *
                100
            ),
        },

      nextSix &&
        {
          key:
            "sixes",
          icon:
            "💥",
          label:
            "Power milestone",
          title:
            `${nextSix.remaining} sixes away`,
          description:
            `${nextSix.target} career sixes`,
          progress:
            Math.round(
              sixes /
                nextSix.target *
                100
            ),
        },

      nextAppearance &&
        {
          key:
            "appearances",
          icon:
            "🛡️",
          label:
            "Appearance milestone",
          title:
            `${nextAppearance.remaining} matches away`,
          description:
            `${nextAppearance.target} appearances`,
          progress:
            Math.round(
              appearances /
                nextAppearance.target *
                100
            ),
        },
    ].filter(Boolean);

  const feedItems = [];

  if (
    milestoneCards[0]
  ) {
    feedItems.push({
      key:
        `milestone-${milestoneCards[0].key}`,
      type:
        "MILESTONE",
      icon:
        milestoneCards[0].icon,
      kicker:
        "Within reach",
      title:
        milestoneCards[0].title,
      text:
        `You are closing in on ${milestoneCards[0].description}.`,
      actionLabel:
        "View journey",
      actionHref:
        "journey",
    });
  }

  if (
    topRival
  ) {
    feedItems.push({
      key:
        "rivalry",
      type:
        "RIVALRY",
      icon:
        "⚔",
      kicker:
        "Established rivalry",
      title:
        topRival.player
          .name,
      text:
        `${topRival.runs} runs in ${topRival.balls} legal balls · ${topRival.dismissals} direct dismissals · ${topRival.matchCount} ${topRival.matchCount === 1 ? "match" : "matches"}.`,
      actionLabel:
        "Compare players",
      actionHref:
        `compare:${topRival.playerId}`,
    });
  }

  if (
    recent[0]
  ) {
    feedItems.push({
      key:
        `recent-${recent[0].id}`,
      type:
        "FORM",
      icon:
        recent[0].impact >=
          70
          ? "🔥"
          : "📈",
      kicker:
        "Latest performance",
      title:
        `${recent[0].runs}R · ${recent[0].wickets}W`,
      text:
        `${recent[0].title} · impact ${recent[0].impact}.`,
      actionLabel:
        "Open match",
      actionHref:
        `match:${recent[0].id}`,
    });
  }

  if (
    milestones[0]
  ) {
    feedItems.push({
      key:
        `earned-${milestones[0].id}`,
      type:
        "ACHIEVEMENT",
      icon:
        milestones[0].icon ||
        "🏆",
      kicker:
        "Recent achievement",
      title:
        milestones[0].title,
      text:
        milestones[0].description ||
        "A new career milestone was recorded.",
      actionLabel:
        "View timeline",
      actionHref:
        "journey",
    });
  }

  if (
    nextMatch
  ) {
    feedItems.push({
      key:
        `next-${nextMatch.id}`,
      type:
        "NEXT_MATCH",
      icon:
        "📅",
      kicker:
        "Next match",
      title:
        nextMatch.title,
      text:
        `${formatDate(nextMatch.date)}${
          nextMatch.opponent
            ?.name
            ? ` · against ${nextMatch.opponent.name}`
            : ""
        }.`,
      actionLabel:
        "Match center",
      actionHref:
        `match:${nextMatch.id}`,
    });
  }

  return {
    stats: {
      runs,
      wickets,
      sixes,
      appearances,
      highestScore,
      bestWickets,
    },
    recent,
    nextMatch,
    formLabel,
    trendLabel,
    trendDelta,
    milestoneCards,
    topRival,
    feedItems,
  };
}

function actionHref({
  action,
  league,
  identity,
}) {
  if (
    action ===
    "journey"
  ) {
    return `/leagues/${league.slug}/players/${identity.representativePlayerId}/journey`;
  }

  if (
    action.startsWith(
      "compare:"
    )
  ) {
    const opponentId =
      action.split(
        ":"
      )[1];

    return `/leagues/${league.slug}/compare?playerA=${identity.representativePlayerId}&playerB=${opponentId}`;
  }

  if (
    action.startsWith(
      "match:"
    )
  ) {
    const matchId =
      action.split(
        ":"
      )[1];

    return `/live/${matchId}`;
  }

  return `/leagues/${league.slug}/players/${identity.representativePlayerId}`;
}

export async function generateMetadata({
  params,
}) {
  const {
    slug,
    playerId,
  } = await params;

  const league =
    await prisma.league.findFirst({
      where:
        buildLeagueWhere(
          slug
        ),

      include: {
        teams: {
          include: {
            players: true,
          },
        },
      },
    });

  const rosterPlayers =
    league?.teams.flatMap(
      (team) =>
        team.players.map(
          (player) => ({
            ...player,
            teamId:
              team.id,
            teamName:
              team.name,
          })
        )
    ) ||
    [];

  const identity =
    resolveIdentity({
      rosterPlayers,
      selectedPlayerId:
        playerId,
      league,
    });

  const visibleIdentity =
    identity &&
    !shouldExcludePlayerFromLeagueAnalytics(
      league,
      identity.name
    )
      ? identity
      : null;

  return {
    title:
      visibleIdentity
        ? `${visibleIdentity.name}'s Home Feed | Cric4All`
        : "Player Home Feed | Cric4All",
    description:
      visibleIdentity
        ? `Personal cricket feed for ${visibleIdentity.name}: milestones, form, rivalries, upcoming matches and recent achievements.`
        : "Personalized Cric4All player feed.",
  };
}

export default async function PlayerHomeFeedPage({
  params,
}) {
  const {
    slug,
    playerId,
  } = await params;

  const league =
    await prisma.league.findFirst({
      where:
        buildLeagueWhere(
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

  if (
    !league ||
    !await canViewLeague({
      league,
      session,
    })
  ) {
    notFound();
  }

  const rosterPlayers =
    league.teams.flatMap(
      (team) =>
        team.players.map(
          (player) => ({
            ...player,
            teamId:
              team.id,
            teamName:
              team.name,
          })
        )
    );

  const identity =
    resolveIdentity({
      rosterPlayers,
      selectedPlayerId:
        playerId,
      league,
    });

  if (
    !identity ||
    shouldExcludePlayerFromLeagueAnalytics(
      league,
      identity.name
    )
  ) {
    notFound();
  }

  const milestoneRows =
    await prisma.playerMilestone.findMany({
      where: {
        leagueId:
          league.id,
        identityKey:
          identity.key,
        isActive:
          true,
      },

      orderBy: [
        {
          achievedAt:
            "desc",
        },
      ],

      /*
       * Fetch a little extra before filtering because abandoned-match
       * milestone rows may occupy the newest slots.
       */
      take: 30,
    });

  const milestones =
    filterMilestonesForEligibleMatches(
      milestoneRows,
      league.matches
    ).slice(
      0,
      10
    );

  const feed =
    buildFeed({
      identity,
      matches:
        league.matches,
      milestones,
      league,
      excludePlayerName: (playerName) =>
        shouldExcludePlayerFromLeagueAnalytics(
          league,
          playerName
        ),
    });

  const shareText =
    `${identity.name}'s Cric4All feed: ${feed.stats.runs} career runs, ${feed.stats.wickets} wickets, ${feed.formLabel} form and ${feed.trendLabel.toLowerCase()} momentum.`;

  const primaryMilestone =
    feed.milestoneCards[0] ||
    null;

  return (
    <main className="phf-page">
      <section className="phf-shell">
        <header className="phf-header">
          <div className="phf-topline">
            <Link
              href={`/leagues/${league.slug}/players/${identity.representativePlayerId}`}
              className="phf-back"
            >
              ← Player card
            </Link>

            <span className="phf-live-pill">
              ✦ My Feed · NOW
            </span>
          </div>

          <div className="phf-welcome">
            <div>
              <p>
                What changed · what is next
              </p>

              <h1>
                Hi, {identity.name}
              </h1>

              <span>
                A short personal briefing — not another stats page.
              </span>
            </div>

            <FeedShareButton
              shareText={
                shareText
              }
            />
          </div>

          <div className="phf-now-grid">
            <NowCard
              eyebrow="Form now"
              title={
                feed.formLabel
              }
              note={`${feed.trendLabel} momentum`}
              icon="🔥"
            />

            <NowCard
              eyebrow="Closest milestone"
              title={
                primaryMilestone
                  ? primaryMilestone.title
                  : "No nearby milestone"
              }
              note={
                primaryMilestone
                  ? primaryMilestone.description
                  : "Your next major target will appear here."
              }
              icon="🎯"
            />

            <NowCard
              eyebrow="Next match"
              title={
                feed.nextMatch
                  ? feed.nextMatch.title
                  : "Nothing scheduled"
              }
              note={
                feed.nextMatch
                  ? formatDate(
                      feed.nextMatch.date
                    )
                  : "A scheduled match will appear automatically."
              }
              icon="📅"
            />
          </div>
        </header>

        <div className="phf-content">
          <section className="phf-section">
            <SectionHeading
              eyebrow="Your briefing"
              title="What matters right now"
              note="Recent changes and next actions only"
            />

            <div className="phf-feed-list phf-feed-list--focused">
              {feed.feedItems.length ? (
                feed.feedItems.map(
                  (item) => (
                    <article
                      key={
                        item.key
                      }
                      className={`phf-feed-card phf-feed-card--${item.type.toLowerCase()}`}
                    >
                      <div className="phf-feed-icon">
                        {item.icon}
                      </div>

                      <div className="phf-feed-copy">
                        <small>
                          {item.kicker}
                        </small>

                        <h2>
                          {item.title}
                        </h2>

                        <p>
                          {item.text}
                        </p>
                      </div>

                      <Link
                        href={actionHref({
                          action:
                            item.actionHref,
                          league,
                          identity,
                        })}
                        className="phf-feed-action"
                      >
                        {item.actionLabel} →
                      </Link>
                    </article>
                  )
                )
              ) : (
                <EmptyState
                  title="Your feed is getting ready"
                  text="New milestones, form changes, meaningful matchups and upcoming matches will appear here automatically."
                />
              )}
            </div>
          </section>

          <section className="phf-section phf-where-to-go">
            <SectionHeading
              eyebrow="Need more?"
              title="Choose the right view"
              note="Each page has one clear job"
            />

            <div className="phf-destination-grid">
              <Link
                href={`/leagues/${league.slug}/players/${identity.representativePlayerId}/journey`}
                className="phf-destination-card"
              >
                <span>
                  ✦
                </span>

                <div>
                  <small>
                    HISTORY
                  </small>

                  <strong>
                    Player Journey
                  </strong>

                  <p>
                    Open this when you want the permanent career story: seasons, milestones, peaks and progression.
                  </p>
                </div>

                <b>
                  →
                </b>
              </Link>

              <Link
                href={`/leagues/${league.slug}/compare?playerA=${identity.representativePlayerId}`}
                className="phf-destination-card"
              >
                <span>
                  ⚔
                </span>

                <div>
                  <small>
                    ANALYSIS
                  </small>

                  <strong>
                    Compare Players
                  </strong>

                  <p>
                    Open this when you want two-player career comparison, direct matchup evidence and rivalry analysis.
                  </p>
                </div>

                <b>
                  →
                </b>
              </Link>

              <Link
                href={`/leagues/${league.slug}/players/${identity.representativePlayerId}`}
                className="phf-destination-card"
              >
                <span>
                  🏏
                </span>

                <div>
                  <small>
                    PROFILE
                  </small>

                  <strong>
                    Player Card
                  </strong>

                  <p>
                    Open this for the current statistical identity: totals, ratings, records and match history.
                  </p>
                </div>

                <b>
                  →
                </b>
              </Link>
            </div>
          </section>

          <footer className="phf-footer">
            My Feed intentionally shows only recent, changing or actionable information. Permanent career history belongs in Player Journey; two-player analysis belongs in Compare Players.
          </footer>
        </div>
      </section>
    </main>
  );
}

function NowCard({
  eyebrow,
  title,
  note,
  icon,
}) {
  return (
    <article className="phf-now-card">
      <span className="phf-now-icon">
        {icon}
      </span>

      <div>
        <small>
          {eyebrow}
        </small>

        <strong>
          {title}
        </strong>

        <p>
          {note}
        </p>
      </div>
    </article>
  );
}

function SectionHeading({
  eyebrow,
  title,
  note,
}) {
  return (
    <div className="phf-section-heading">
      <div>
        <p>
          {eyebrow}
        </p>
        <h2>
          {title}
        </h2>
      </div>

      <span>
        {note}
      </span>
    </div>
  );
}

function EmptyState({
  title,
  text,
}) {
  return (
    <div className="phf-empty">
      <span>
        ✦
      </span>
      <div>
        <strong>
          {title}
        </strong>
        <p>
          {text}
        </p>
      </div>
    </div>
  );
}
