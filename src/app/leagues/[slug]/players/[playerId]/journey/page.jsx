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

import JourneyShareButton from "./JourneyShareButton";
import "@/app/player-journey-final.css";

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

function initials(name) {
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
    ) ===
    userId
  ) {
    return true;
  }

  return Boolean(
    league.members?.some(
      (member) =>
        String(
          member.userId
        ) ===
        userId
    )
  );
}

function isSharedTeam(
  player
) {
  return SHARED_TEAM_TOKENS.has(
    token(
      player.teamName
    )
  );
}

function identityKey(
  player
) {
  const playerToken =
    token(
      player.name
    );

  if (
    isSharedTeam(
      player
    ) &&
    playerToken
  ) {
    return `shared:surprise-1-2:${playerToken}`;
  }

  return `player:${number(
    player.id
  )}`;
}

function resolveIdentity({
  rosterPlayers,
  selectedPlayerId,
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
      selected
    );

  const players =
    rosterPlayers.filter(
      (player) =>
        identityKey(
          player
        ) === key
    );

  return {
    key,
    name:
      selected.name,
    players,
    playerIds:
      players.map(
        (player) =>
          number(
            player.id
          )
      ),
    representativePlayerId:
      number(
        selected.id
      ),
    teams:
      players.map(
        (player) => ({
          id:
            player.teamId,
          name:
            player.teamName,
        })
      ),
    teamLabel:
      players
        .map(
          (player) =>
            player.teamName
        )
        .join(" + "),
  };
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

function chargedRuns(
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

function monthLabel(
  value
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",
      year:
        "numeric",
    }
  ).format(
    new Date(value)
  );
}

function buildJourney({
  identity,
  matches,
  milestones,
}) {
  const ids =
    new Set(
      identity.playerIds
    );

  const appearances = [];
  const yearly =
    new Map();
  const opponentMap =
    new Map();
  const rivalryMap =
    new Map();

  let careerRuns = 0;
  let careerBalls = 0;
  let careerDismissals = 0;
  let careerWickets = 0;
  let careerLegalBowls = 0;
  let careerConceded = 0;
  let careerFours = 0;
  let careerSixes = 0;
  let highestScore = 0;
  let bestWickets = 0;
  let bestRuns = 0;

  for (
    const match of
    [...matches].sort(
      (left, right) =>
        matchDate(left) -
        matchDate(right)
    )
  ) {
    if (
      !isMatchEligibleForStats(
        match
      )
    ) {
      continue;
    }

    const balls =
      match.balls ||
      [];

    const batting =
      balls.filter(
        (ball) =>
          ids.has(
            number(
              ball.strikerId
            )
          )
      );

    const bowling =
      balls.filter(
        (ball) =>
          ids.has(
            number(
              ball.bowlerId
            )
          )
      );

    const dismissed =
      balls.some(
        (ball) =>
          Boolean(
            ball.isWicket
          ) &&
          ids.has(
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
      continue;
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

    const ballsFaced =
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
        (sum, ball) =>
          sum +
          chargedRuns(
            ball
          ),
        0
      );

    const impact =
      Math.round(
        runs +
        wickets *
          22 +
        fours *
          1.5 +
        sixes *
          3
      );

    const ownTeamIds =
      new Set(
        identity.teams.map(
          (team) =>
            number(
              team.id
            )
        )
      );

    const opponent =
      ownTeamIds.has(
        number(
          match.teamAId
        )
      )
        ? match.teamB
        : match.teamA;

    const appearance = {
      id:
        match.id,
      date:
        matchDate(
          match
        ),
      title:
        `${
          match.teamA?.name ||
          "Team A"
        } vs ${
          match.teamB?.name ||
          "Team B"
        }`,
      opponentName:
        opponent?.name ||
        "Opponent",
      runs,
      balls:
        ballsFaced,
      wickets,
      legalBowls,
      conceded,
      fours,
      sixes,
      impact,
      status:
        match.status,
    };

    appearances.push(
      appearance
    );

    careerRuns +=
      runs;
    careerBalls +=
      ballsFaced;
    careerFours +=
      fours;
    careerSixes +=
      sixes;
    careerWickets +=
      wickets;
    careerLegalBowls +=
      legalBowls;
    careerConceded +=
      conceded;

    if (dismissed) {
      careerDismissals +=
        1;
    }

    highestScore =
      Math.max(
        highestScore,
        runs
      );

    if (
      wickets >
        bestWickets ||
      (
        wickets ===
          bestWickets &&
        wickets > 0 &&
        conceded <
          bestRuns
      )
    ) {
      bestWickets =
        wickets;
      bestRuns =
        conceded;
    }

    const year =
      appearance.date
        .getFullYear();

    if (
      !yearly.has(
        year
      )
    ) {
      yearly.set(
        year,
        {
          year,
          appearances: 0,
          runs: 0,
          wickets: 0,
          impact: 0,
        }
      );
    }

    const yearRow =
      yearly.get(
        year
      );

    yearRow.appearances +=
      1;
    yearRow.runs +=
      runs;
    yearRow.wickets +=
      wickets;
    yearRow.impact +=
      impact;

    const opponentKey =
      token(
        appearance.opponentName
      );

    if (
      !opponentMap.has(
        opponentKey
      )
    ) {
      opponentMap.set(
        opponentKey,
        {
          name:
            appearance.opponentName,
          matches: 0,
          runs: 0,
          wickets: 0,
          impact: 0,
        }
      );
    }

    const opponentRow =
      opponentMap.get(
        opponentKey
      );

    opponentRow.matches +=
      1;
    opponentRow.runs +=
      runs;
    opponentRow.wickets +=
      wickets;
    opponentRow.impact +=
      impact;

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

      let opponentPlayerId =
        null;
      let role =
        null;

      if (
        ids.has(
          strikerId
        ) &&
        bowlerId &&
        !ids.has(
          bowlerId
        )
      ) {
        opponentPlayerId =
          bowlerId;
        role =
          "batting";
      }

      if (
        ids.has(
          bowlerId
        ) &&
        strikerId &&
        !ids.has(
          strikerId
        )
      ) {
        opponentPlayerId =
          strikerId;
        role =
          "bowling";
      }

      if (
        !opponentPlayerId
      ) {
        continue;
      }

      const key =
        String(
          opponentPlayerId
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
              opponentPlayerId,
            balls: 0,
            runs: 0,
            wickets: 0,
            encounters:
              new Set(),
          }
        );
      }

      const row =
        rivalryMap.get(
          key
        );

      row.encounters.add(
        match.id
      );

      if (
        role ===
        "batting"
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
      } else if (
        role ===
          "bowling" &&
        isBowlerWicket(
          ball
        ) &&
        number(
          ball.dismissedPlayerId
        ) ===
          opponentPlayerId
      ) {
        row.wickets +=
          1;
      }
    }
  }

  const latestFive =
    [...appearances]
      .sort(
        (left, right) =>
          right.date -
          left.date
      )
      .slice(0, 5);

  const formImpact =
    latestFive.reduce(
      (sum, row) =>
        sum +
        row.impact,
      0
    );

  const formAverage =
    latestFive.length
      ? formImpact /
        latestFive.length
      : 0;

  const formLabel =
    formAverage >=
    75
      ? "Red hot"
      : formAverage >=
        50
        ? "Excellent"
        : formAverage >=
          30
          ? "In form"
          : formAverage >=
            15
            ? "Building"
            : "Quiet spell";

  const yearlyRows =
    Array.from(
      yearly.values()
    ).sort(
      (left, right) =>
        left.year -
        right.year
    );

  const peakYear =
    [...yearlyRows].sort(
      (left, right) =>
        right.impact -
        left.impact
    )[0] ||
    null;

  const peakMatch =
    [...appearances].sort(
      (left, right) =>
        right.impact -
        left.impact
    )[0] ||
    null;

  const favoriteOpponent =
    Array.from(
      opponentMap.values()
    ).sort(
      (left, right) =>
        right.impact -
        left.impact ||
        right.matches -
        left.matches
    )[0] ||
    null;

  const rosterLookup =
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
        rosterLookup.set(
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
   * Player Journey and My Feed now share one canonical established-rival
   * engine. This prevents the two pages from naming different career rivals.
   * Surprise 1 + Surprise 2 opponent identities are merged by identityKey.
   */
  const biggestRival =
    selectTopEstablishedRival({
      candidates:
        Array.from(
          rivalryMap.values()
        ).map(
          (row) => ({
            playerId:
              row.playerId,
            player:
              rosterLookup.get(
                row.playerId
              ),
            matchIds:
              row.encounters,
            balls:
              row.balls,
            runs:
              row.runs,
            dismissals:
              row.wickets,
          })
        ),
      getIdentityKey:
        identityKey,
    });

  const timeline =
    [
      ...milestones.map(
        (milestone) => ({
          key:
            `milestone-${milestone.id}`,
          date:
            new Date(
              milestone.achievedAt
            ),
          icon:
            milestone.icon ||
            "🏆",
          title:
            milestone.title,
          description:
            milestone.description ||
            "Career milestone",
          matchId:
            milestone.matchId,
          type:
            "milestone",
        })
      ),
      ...appearances
        .filter(
          (row) =>
            row.runs >=
              50 ||
            row.wickets >=
              3 ||
            row.impact >=
              75
        )
        .map(
          (row) => ({
            key:
              `performance-${row.id}`,
            date:
              row.date,
            icon:
              row.runs >=
              100
                ? "💯"
                : row.runs >=
                    50
                  ? "🏏"
                  : row.wickets >=
                      5
                    ? "🔥"
                    : row.wickets >=
                        3
                      ? "🎯"
                      : "⭐",
            title:
              row.runs >=
              100
                ? `${row.runs}-run century`
                : row.runs >=
                    50
                  ? `${row.runs}-run innings`
                  : row.wickets >=
                      5
                    ? `${row.wickets}-wicket haul`
                    : row.wickets >=
                        3
                      ? `${row.wickets} wickets`
                      : "High-impact performance",
            description:
              `${row.title} · ${row.runs}R · ${row.wickets}W`,
            matchId:
              row.id,
            type:
              "performance",
          })
        ),
    ]
      .sort(
        (left, right) =>
          right.date -
          left.date
      )
      .slice(0, 14);

  const debut =
    appearances[0] ||
    null;

  const recentTrend =
    latestFive.length >=
    4
      ? (
          latestFive
            .slice(0, 2)
            .reduce(
              (sum, row) =>
                sum +
                row.impact,
              0
            ) /
            2
        ) -
        (
          latestFive
            .slice(-2)
            .reduce(
              (sum, row) =>
                sum +
                row.impact,
              0
            ) /
            2
        )
      : 0;

  const trendLabel =
    recentTrend >
    8
      ? "Rising"
      : recentTrend <
        -8
        ? "Cooling"
        : "Steady";

  const rating =
    Number(
      Math.min(
        9.8,
        5 +
        Math.log10(
          1 +
          careerRuns +
          careerWickets *
            25 +
          formImpact
        ) *
          1.35
      ).toFixed(1)
    );

  return {
    appearances,
    latestFive,
    timeline,
    yearlyRows,
    peakYear,
    peakMatch,
    favoriteOpponent,
    biggestRival,
    debut,
    formLabel,
    formImpact,
    recentTrend,
    trendLabel,
    rating,
    stats: {
      appearances:
        appearances.length,
      runs:
        careerRuns,
      balls:
        careerBalls,
      average:
        careerDismissals
          ? (
              careerRuns /
              careerDismissals
            ).toFixed(2)
          : careerRuns
            ? careerRuns.toFixed(
                2
              )
            : "0.00",
      strikeRate:
        careerBalls
          ? (
              careerRuns /
              careerBalls *
              100
            ).toFixed(2)
          : "0.00",
      highestScore,
      fours:
        careerFours,
      sixes:
        careerSixes,
      wickets:
        careerWickets,
      overs:
        `${Math.floor(
          careerLegalBowls /
            6
        )}.${careerLegalBowls % 6}`,
      economy:
        careerLegalBowls
          ? (
              careerConceded /
              careerLegalBowls *
              6
            ).toFixed(2)
          : "0.00",
      bestBowling:
        bestWickets
          ? `${bestWickets}/${bestRuns}`
          : "—",
    },
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
    });

  return {
    title:
      identity
        ? `${identity.name}'s Player Journey | Cric4All`
        : "Player Journey | Cric4All",
    description:
      identity
        ? `Explore ${identity.name}'s cricket journey, milestones, seasons, rivals and career story on Cric4All.`
        : "Explore a Cric4All player journey.",
  };
}

export default async function PlayerJourneyPage({
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
                "asc",
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
    });

  if (!identity) {
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
            "asc",
        },
      ],
    });

  const milestones =
    filterMilestonesForEligibleMatches(
      milestoneRows,
      league.matches
    );

  const journey =
    buildJourney({
      identity,
      matches:
        league.matches,
      milestones,
    });

  const shareText =
    `${identity.name}'s Cric4All Player Journey: ${journey.stats.runs} runs, ${journey.stats.wickets} wickets, ${journey.stats.appearances} appearances and a ${journey.rating}/10 journey rating.`;

  return (
    <main className="pj-page">
      <section className="pj-shell">
        <header className="pj-hero">
          <div className="pj-topbar">
            <Link
              href={`/leagues/${league.slug}/players/${identity.representativePlayerId}`}
              className="pj-back"
            >
              ← Player card
            </Link>

            <span className="pj-eyebrow">
              ✦ Player Journey · HISTORY
            </span>
          </div>

          <div className="pj-identity">
            <div className="pj-avatar">
              {initials(
                identity.name
              )}
            </div>

            <div className="pj-name-block">
              <p>
                Permanent career story
              </p>
              <h1>
                {identity.name}
              </h1>
              <span>
                {identity.teamLabel}
              </span>
            </div>

            <div className="pj-rating">
              <small>
                Journey rating
              </small>
              <strong>
                {journey.rating}
              </strong>
              <span>
                /10
              </span>
            </div>
          </div>

          <div className="pj-purpose-note">
            <strong>
              This page answers: “How did my cricket career evolve?”
            </strong>
            <span>
              Seasons, milestones, peaks and progression live here. For recent changes and what comes next, use My Feed.
            </span>
          </div>

          <div className="pj-hero-grid">
            <article>
              <span>
                Current form
              </span>
              <strong>
                {journey.formLabel}
              </strong>
              <small>
                Last-five impact {journey.formImpact}
              </small>
            </article>

            <article>
              <span>
                Trend
              </span>
              <strong>
                {journey.trendLabel}
              </strong>
              <small>
                {journey.recentTrend > 0
                  ? "+"
                  : ""}
                {Math.round(
                  journey.recentTrend
                )} recent impact
              </small>
            </article>

            <article>
              <span>
                Peak year
              </span>
              <strong>
                {journey.peakYear?.year ||
                  "—"}
              </strong>
              <small>
                {journey.peakYear
                  ? `${journey.peakYear.runs}R · ${journey.peakYear.wickets}W`
                  : "No scored season yet"}
              </small>
            </article>

            <JourneyShareButton
              shareText={
                shareText
              }
            />
          </div>
        </header>

        <div className="pj-content">
          <section className="pj-stats">
            {[
              [
                "Appearances",
                journey.stats
                  .appearances,
              ],
              [
                "Runs",
                journey.stats.runs,
              ],
              [
                "Average",
                journey.stats
                  .average,
              ],
              [
                "Strike rate",
                journey.stats
                  .strikeRate,
              ],
              [
                "Wickets",
                journey.stats
                  .wickets,
              ],
              [
                "Economy",
                journey.stats
                  .economy,
              ],
            ].map(
              (
                [
                  label,
                  value,
                ]
              ) => (
                <article
                  key={
                    label
                  }
                >
                  <span>
                    {label}
                  </span>
                  <strong>
                    {value}
                  </strong>
                </article>
              )
            )}
          </section>

          <section className="pj-section">
            <SectionHeading
              kicker="Year by year"
              title="Career growth"
              note="Every scored season"
            />

            {journey.yearlyRows.length ? (
              <div className="pj-year-list">
                {journey.yearlyRows.map(
                  (
                    row
                  ) => {
                    const maxImpact =
                      Math.max(
                        ...journey.yearlyRows.map(
                          (
                            candidate
                          ) =>
                            candidate.impact
                        ),
                        1
                      );

                    return (
                      <article
                        key={
                          row.year
                        }
                        className={
                          journey.peakYear
                            ?.year ===
                          row.year
                            ? "is-peak"
                            : ""
                        }
                      >
                        <div className="pj-year-label">
                          <strong>
                            {row.year}
                          </strong>
                          <span>
                            {row.appearances} matches
                          </span>
                        </div>

                        <div className="pj-year-track">
                          <i
                            style={{
                              width:
                                `${Math.max(
                                  8,
                                  Math.round(
                                    row.impact /
                                      maxImpact *
                                      100
                                  )
                                )}%`,
                            }}
                          />
                        </div>

                        <div className="pj-year-numbers">
                          <strong>
                            {row.runs}R
                          </strong>
                          <span>
                            {row.wickets}W
                          </span>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            ) : (
              <EmptyState
                text="Season growth appears after scored matches."
              />
            )}
          </section>

          <section className="pj-section">
            <SectionHeading
              kicker="Career story"
              title="Journey timeline"
              note={`${journey.timeline.length} defining moments`}
            />

            {journey.timeline.length ? (
              <div className="pj-timeline">
                {journey.timeline.map(
                  (
                    event,
                    index
                  ) => (
                    <article
                      key={
                        event.key
                      }
                    >
                      <div className="pj-timeline-line">
                        <span>
                          {event.icon}
                        </span>
                        {index <
                          journey.timeline
                            .length -
                            1 && (
                          <i />
                        )}
                      </div>

                      <div className="pj-timeline-copy">
                        <small>
                          {formatDate(
                            event.date
                          )}
                        </small>
                        <h3>
                          {event.title}
                        </h3>
                        <p>
                          {event.description}
                        </p>
                      </div>

                      {event.matchId && (
                        <Link
                          href={`/live/${event.matchId}`}
                        >
                          Match →
                        </Link>
                      )}
                    </article>
                  )
                )}
              </div>
            ) : (
              <EmptyState
                text="Milestones and standout performances will build this timeline."
              />
            )}
          </section>

          <section className="pj-section">
            <SectionHeading
              kicker="Signature story"
              title="What defines this player"
              note="Career intelligence"
            />

            <div className="pj-story-grid">
              <StoryCard
                icon="⭐"
                label="Peak performance"
                title={
                  journey.peakMatch
                    ? `${journey.peakMatch.runs}R · ${journey.peakMatch.wickets}W`
                    : "Waiting for a breakout"
                }
                description={
                  journey.peakMatch
                    ? `${journey.peakMatch.title} · impact ${journey.peakMatch.impact}`
                    : "The highest-impact match will appear here."
                }
              />

              <StoryCard
                icon="🎯"
                label="Favorite opponent"
                title={
                  journey.favoriteOpponent
                    ?.name ||
                  "Not enough history"
                }
                description={
                  journey.favoriteOpponent
                    ? `${journey.favoriteOpponent.runs} runs · ${journey.favoriteOpponent.wickets} wickets across ${journey.favoriteOpponent.matches} matches`
                    : "Opponent trends grow with match history."
                }
              />

              <StoryCard
                icon="⚔"
                label="Biggest established rival"
                title={
                  journey.biggestRival
                    ?.player
                    ?.name ||
                  "No established rival yet"
                }
                description={
                  journey.biggestRival
                    ? `${journey.biggestRival.encounters} direct ${journey.biggestRival.encounters === 1 ? "match" : "matches"} · ${journey.biggestRival.balls} legal balls faced · ${journey.biggestRival.wickets} direct ${journey.biggestRival.wickets === 1 ? "dismissal" : "dismissals"} · ${Math.round(
                        journey.biggestRival.evidenceConfidence *
                          100
                      )}% evidence`
                    : "A career rival appears only after repeated evidence: at least 2 direct matches and 6 legal balls, or 2 direct dismissals."
                }
                href={
                  journey.biggestRival
                    ? `/leagues/${league.slug}/compare?playerA=${identity.representativePlayerId}&playerB=${journey.biggestRival.playerId}`
                    : ""
                }
              />

              <StoryCard
                icon="🚀"
                label="Career bests"
                title={`${journey.stats.highestScore} high score`}
                description={`${journey.stats.bestBowling} best bowling · ${journey.stats.fours} fours · ${journey.stats.sixes} sixes`}
              />
            </div>
          </section>

          <section className="pj-section">
            <SectionHeading
              kicker="Momentum"
              title="Latest five"
              note={journey.formLabel}
            />

            {journey.latestFive.length ? (
              <div className="pj-form-list">
                {journey.latestFive.map(
                  (
                    row,
                    index
                  ) => (
                    <article
                      key={
                        row.id
                      }
                    >
                      <span className="pj-form-rank">
                        {index + 1}
                      </span>

                      <div>
                        <strong>
                          {row.title}
                        </strong>
                        <small>
                          {formatDate(
                            row.date
                          )}
                        </small>
                      </div>

                      <b>
                        {row.runs}R · {row.wickets}W
                      </b>

                      <em>
                        {row.impact}
                      </em>
                    </article>
                  )
                )}
              </div>
            ) : (
              <EmptyState
                text="Recent-form cards appear after scored appearances."
              />
            )}
          </section>

          <section className="pj-section">
            <SectionHeading
              kicker="Origin"
              title="The journey began"
              note={
                journey.debut
                  ? monthLabel(
                      journey.debut.date
                    )
                  : "No debut yet"
              }
            />

            <div className="pj-debut">
              <div>
                <span>
                  Debut
                </span>
                <strong>
                  {journey.debut
                    ? formatDate(
                        journey.debut.date
                      )
                    : "Waiting for first appearance"}
                </strong>
              </div>

              <p>
                {journey.debut
                  ? `${identity.name}'s recorded Cric4All journey began in ${journey.debut.title}, contributing ${journey.debut.runs} runs and ${journey.debut.wickets} wickets.`
                  : "The story begins when this player appears in a scored match."}
              </p>
            </div>
          </section>

          <footer className="pj-footer">
            Player Journey is generated from recorded Cric4All deliveries, active milestones and shared Surprise 1 + Surprise 2 identity rules.
          </footer>
        </div>
      </section>
    </main>
  );
}

function SectionHeading({
  kicker,
  title,
  note,
}) {
  return (
    <div className="pj-section-heading">
      <div>
        <p>
          {kicker}
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

function StoryCard({
  icon,
  label,
  title,
  description,
  href,
}) {
  const content = (
    <>
      <span className="pj-story-icon">
        {icon}
      </span>
      <small>
        {label}
      </small>
      <h3>
        {title}
      </h3>
      <p>
        {description}
      </p>
      {href && (
        <b>
          Open comparison →
        </b>
      )}
    </>
  );

  return href ? (
    <Link
      href={href}
      className="pj-story-card"
    >
      {content}
    </Link>
  ) : (
    <article className="pj-story-card">
      {content}
    </article>
  );
}

function EmptyState({
  text,
}) {
  return (
    <div className="pj-empty">
      <span>
        ✦
      </span>
      <p>
        {text}
      </p>
    </div>
  );
}
