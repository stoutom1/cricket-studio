import prisma from "@/lib/prisma";
import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import CompareShareButton from "./CompareShareButton";
import "@/app/player-compare-final.css";

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

function safeDivide(
  numerator,
  denominator,
  fallback = 0
) {
  return denominator > 0
    ? numerator /
        denominator
    : fallback;
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
  const nameToken =
    token(
      player.name
    );

  if (
    isSharedTeam(
      player
    ) &&
    nameToken
  ) {
    return `shared:surprise-1-2:${nameToken}`;
  }

  return `player:${number(
    player.id
  )}`;
}

function buildIdentityGroups(
  rosterPlayers
) {
  const groups =
    new Map();

  for (
    const player of
    rosterPlayers
  ) {
    const key =
      identityKey(
        player
      );

    if (
      !groups.has(
        key
      )
    ) {
      groups.set(
        key,
        {
          key,
          name:
            player.name,
          players: [],
          playerIds: [],
          teams: [],
        }
      );
    }

    const group =
      groups.get(
        key
      );

    group.players.push(
      player
    );

    group.playerIds.push(
      number(
        player.id
      )
    );

    if (
      !group.teams.some(
        (team) =>
          number(
            team.id
          ) ===
          number(
            player.teamId
          )
      )
    ) {
      group.teams.push({
        id:
          player.teamId,
        name:
          player.teamName,
      });
    }
  }

  return Array.from(
    groups.values()
  ).map(
    (group) => ({
      ...group,
      canonicalId:
        group.playerIds[0],
      teamLabel:
        group.teams
          .map(
            (team) =>
              team.name
          )
          .join(" + "),
    })
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

function aggregateCareer(
  identity,
  matches
) {
  const ids =
    new Set(
      identity.playerIds.map(
        number
      )
    );

  let runs = 0;
  let balls = 0;
  let fours = 0;
  let sixes = 0;
  let dismissals = 0;
  let wickets = 0;
  let legalBowls = 0;
  let conceded = 0;
  let highest = 0;
  let appearances = 0;
  let bestWickets = 0;
  let bestRuns = 0;

  const recent = [];

  for (
    const match of
    matches
  ) {
    const matchBalls =
      match.balls ||
      [];

    const batting =
      matchBalls.filter(
        (ball) =>
          ids.has(
            number(
              ball.strikerId
            )
          )
      );

    const bowling =
      matchBalls.filter(
        (ball) =>
          ids.has(
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

    appearances += 1;

    const matchRuns =
      batting.reduce(
        (sum, ball) =>
          sum +
          number(
            ball.runsOffBat
          ),
        0
      );

    const matchBallsFaced =
      batting.filter(
        isLegalBallFaced
      ).length;

    const matchFours =
      batting.filter(
        (ball) =>
          number(
            ball.runsOffBat
          ) === 4
      ).length;

    const matchSixes =
      batting.filter(
        (ball) =>
          number(
            ball.runsOffBat
          ) === 6
      ).length;

    const matchWickets =
      bowling.filter(
        isBowlerWicket
      ).length;

    const matchLegalBowls =
      bowling.filter(
        isLegalBowlingBall
      ).length;

    const matchConceded =
      bowling.reduce(
        (sum, ball) =>
          sum +
          runsChargedToBowler(
            ball
          ),
        0
      );

    runs += matchRuns;
    balls +=
      matchBallsFaced;
    fours +=
      matchFours;
    sixes +=
      matchSixes;
    wickets +=
      matchWickets;
    legalBowls +=
      matchLegalBowls;
    conceded +=
      matchConceded;

    if (dismissed) {
      dismissals += 1;
    }

    highest =
      Math.max(
        highest,
        matchRuns
      );

    if (
      matchWickets >
        bestWickets ||
      (
        matchWickets ===
          bestWickets &&
        matchWickets > 0 &&
        matchConceded <
          bestRuns
      )
    ) {
      bestWickets =
        matchWickets;
      bestRuns =
        matchConceded;
    }

    const impact =
      Math.round(
        matchRuns +
        matchWickets *
          22 +
        matchFours *
          1.5 +
        matchSixes *
          3
      );

    recent.push({
      matchId:
        match.id,
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
      runs:
        matchRuns,
      wickets:
        matchWickets,
      impact,
    });
  }

  return {
    appearances,
    runs,
    balls,
    fours,
    sixes,
    dismissals,
    wickets,
    legalBowls,
    conceded,
    highest,
    average:
      dismissals
        ? (
            runs /
            dismissals
          ).toFixed(2)
        : runs
          ? runs.toFixed(2)
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
    bestBowling:
      bestWickets
        ? `${bestWickets}/${bestRuns}`
        : "—",
    form:
      recent
        .slice(0, 5),
    formImpact:
      recent
        .slice(0, 5)
        .reduce(
          (sum, row) =>
            sum +
            row.impact,
          0
        ),
  };
}

function compareValue(
  left,
  right,
  lowerIsBetter = false
) {
  const leftNumber =
    number(left);
  const rightNumber =
    number(right);

  if (
    leftNumber ===
    rightNumber
  ) {
    return "tie";
  }

  if (
    lowerIsBetter
  ) {
    return leftNumber <
      rightNumber
      ? "left"
      : "right";
  }

  return leftNumber >
    rightNumber
    ? "left"
    : "right";
}

function buildRatings(
  profiles,
  selectedIdentity
) {
  const battingValues =
    profiles.map(
      (profile) =>
        profile.stats.runs +
        profile.stats.fours *
          2 +
        profile.stats.sixes *
          4 +
        number(
          profile.stats
            .strikeRate
        ) *
          1.4
    );

  const bowlingValues =
    profiles.map(
      (profile) =>
        profile.stats.wickets *
          30 +
        (
          profile.stats
            .legalBowls >=
          12
            ? Math.max(
                0,
                9 -
                  number(
                    profile.stats
                      .economy
                  )
              ) *
              18
            : 0
        )
    );

  const formValues =
    profiles.map(
      (profile) =>
        profile.stats
          .formImpact
    );

  const battingValue =
    selectedIdentity.stats
      .runs +
    selectedIdentity.stats
      .fours *
      2 +
    selectedIdentity.stats
      .sixes *
      4 +
    number(
      selectedIdentity.stats
        .strikeRate
    ) *
      1.4;

  const bowlingValue =
    selectedIdentity.stats
      .wickets *
      30 +
    (
      selectedIdentity.stats
        .legalBowls >=
      12
        ? Math.max(
            0,
            9 -
              number(
                selectedIdentity
                  .stats
                  .economy
              )
          ) *
          18
        : 0
    );

  const formValue =
    selectedIdentity.stats
      .formImpact;

  function percentile(
    values,
    value
  ) {
    if (
      values.length <= 1
    ) {
      return 50;
    }

    const position =
      values.filter(
        (candidate) =>
          candidate <= value
      ).length -
      1;

    return Math.round(
      Math.max(
        0,
        position
      ) /
        (
          values.length -
          1
        ) *
        100
    );
  }

  function rating(
    value
  ) {
    return Number(
      (
        5 +
        Math.max(
          0,
          Math.min(
            100,
            value
          )
        ) *
          0.045
      ).toFixed(1)
    );
  }

  const batting =
    rating(
      percentile(
        battingValues,
        battingValue
      )
    );

  const bowling =
    rating(
      percentile(
        bowlingValues,
        bowlingValue
      )
    );

  const form =
    rating(
      percentile(
        formValues,
        formValue
      )
    );

  return {
    batting,
    bowling,
    form,
    overall:
      Number(
        (
          batting *
            0.42 +
          bowling *
            0.38 +
          form *
            0.2
        ).toFixed(1)
      ),
  };
}

function buildMatchups({
  identity,
  matches,
  idToIdentity,
}) {
  const selectedIds =
    new Set(
      identity.playerIds
        .map(number)
    );

  const battingMap =
    new Map();

  const bowlingMap =
    new Map();

  for (
    const match of
    matches
  ) {
    for (
      const ball of
      match.balls ||
      []
    ) {
      const strikerId =
        number(
          ball.strikerId
        );

      const bowlerId =
        number(
          ball.bowlerId
        );

      if (
        selectedIds.has(
          strikerId
        ) &&
        bowlerId
      ) {
        const opponent =
          idToIdentity.get(
            bowlerId
          );

        if (
          opponent &&
          opponent.key !==
            identity.key
        ) {
          const row =
            battingMap.get(
              opponent.key
            ) || {
              identity:
                opponent,
              runs: 0,
              balls: 0,
              dismissals: 0,
              fours: 0,
              sixes: 0,
              matchIds:
                new Set(),
            };

          row.matchIds.add(
            match.id
          );

          row.runs +=
            number(
              ball.runsOffBat
            );

          if (
            isLegalBallFaced(
              ball
            )
          ) {
            row.balls += 1;
          }

          if (
            number(
              ball.runsOffBat
            ) === 4
          ) {
            row.fours += 1;
          }

          if (
            number(
              ball.runsOffBat
            ) === 6
          ) {
            row.sixes += 1;
          }

          if (
            isBowlerWicket(
              ball
            ) &&
            selectedIds.has(
              number(
                ball.dismissedPlayerId
              )
            )
          ) {
            row.dismissals += 1;
          }

          battingMap.set(
            opponent.key,
            row
          );
        }
      }

      if (
        selectedIds.has(
          bowlerId
        ) &&
        strikerId
      ) {
        const opponent =
          idToIdentity.get(
            strikerId
          );

        if (
          opponent &&
          opponent.key !==
            identity.key
        ) {
          const row =
            bowlingMap.get(
              opponent.key
            ) || {
              identity:
                opponent,
              runs: 0,
              balls: 0,
              wickets: 0,
              matchIds:
                new Set(),
            };

          row.matchIds.add(
            match.id
          );

          row.runs +=
            runsChargedToBowler(
              ball
            );

          if (
            isLegalBowlingBall(
              ball
            )
          ) {
            row.balls += 1;
          }

          if (
            isBowlerWicket(
              ball
            ) &&
            opponent.playerIds.includes(
              number(
                ball.dismissedPlayerId
              )
            )
          ) {
            row.wickets += 1;
          }

          bowlingMap.set(
            opponent.key,
            row
          );
        }
      }
    }
  }

  const batting =
    Array.from(
      battingMap.values()
    )
      .map(
        (row) => {
          const matches =
            row.matchIds.size;

          /*
           * A genuine rivalry needs repeated interaction.
           * One accidental delivery must never become a "top rivalry".
           */
          /*
           * Batting matchup qualification is intentionally more flexible
           * than bowling rivalry qualification.
           *
           * A single match can still be meaningful if the batter clearly
           * dominated that bowler (for example, 24 runs from 9 balls).
           */
          const isQualified =
            (
              matches >=
                2 &&
              row.balls >=
                6
            ) ||
            row.balls >=
              8 ||
            row.runs >=
              20 ||
            row.dismissals >=
              2;

          const confidence =
            Math.min(
              1,
              (
                row.balls /
                  18 +
                matches /
                  4 +
                row.dismissals /
                  3
              ) /
                3
            );

          const impact =
            row.runs +
            row.fours *
              1.5 +
            row.sixes *
              3 -
            row.dismissals *
              12;

          const matchupCategory =
            matches >=
              2 ||
            row.dismissals >=
              2
              ? "ESTABLISHED_RIVALRY"
              : "NOTABLE_MATCHUP";

          return {
            ...row,
            matches,
            isQualified,
            matchupCategory,
            confidence,
            rivalryScore:
              impact *
                (
                  0.45 +
                  confidence *
                    0.55
                ) +
              row.balls *
                0.55 +
              matches *
                4,
            strikeRate:
              row.balls
                ? (
                    row.runs /
                    row.balls *
                    100
                  ).toFixed(1)
                : "0.0",
          };
        }
      )
      .filter(
        (row) =>
          row.isQualified
      )
      .sort(
        (left, right) =>
          right.rivalryScore -
            left.rivalryScore ||
          right.matches -
            left.matches ||
          right.balls -
            left.balls
      );

  const bowling =
    Array.from(
      bowlingMap.values()
    )
      .map(
        (row) => {
          const matches =
            row.matchIds.size;

          const isQualified =
            (
              matches >=
                2 &&
              row.balls >=
                6
            ) ||
            row.wickets >=
              2;

          const confidence =
            Math.min(
              1,
              (
                row.balls /
                  18 +
                matches /
                  4 +
                row.wickets /
                  3
              ) /
                3
            );

          const economy =
            row.balls
              ? row.runs /
                row.balls *
                6
              : 0;

          const impact =
            row.wickets *
              22 -
            row.runs *
              0.35 +
            row.balls *
              0.35;

          return {
            ...row,
            matches,
            isQualified,
            confidence,
            rivalryScore:
              impact *
                (
                  0.45 +
                  confidence *
                    0.55
                ) +
              matches *
                4,
            overs:
              `${Math.floor(
                row.balls /
                  6
              )}.${row.balls % 6}`,
            economy:
              economy.toFixed(
                1
              ),
          };
        }
      )
      .filter(
        (row) =>
          row.isQualified
      )
      .sort(
        (left, right) =>
          right.rivalryScore -
            left.rivalryScore ||
          right.wickets -
            left.wickets ||
          right.matches -
            left.matches
      );

  return {
    batting,
    bowling,
  };
}

function rivalryBetween({
  playerA,
  playerB,
  matches,
}) {
  const idsA =
    new Set(
      playerA.playerIds.map(
        number
      )
    );

  const idsB =
    new Set(
      playerB.playerIds.map(
        number
      )
    );

  let aRuns = 0;
  let aBalls = 0;
  let aDismissals = 0;
  let bRuns = 0;
  let bBalls = 0;
  let bDismissals = 0;
  const matchIds =
    new Set();

  for (
    const match of
    matches
  ) {
    let involved =
      false;

    for (
      const ball of
      match.balls ||
      []
    ) {
      const striker =
        number(
          ball.strikerId
        );

      const bowler =
        number(
          ball.bowlerId
        );

      if (
        idsA.has(
          striker
        ) &&
        idsB.has(
          bowler
        )
      ) {
        involved = true;
        aRuns +=
          number(
            ball.runsOffBat
          );

        if (
          isLegalBallFaced(
            ball
          )
        ) {
          aBalls += 1;
        }

        if (
          isBowlerWicket(
            ball
          ) &&
          idsA.has(
            number(
              ball.dismissedPlayerId
            )
          )
        ) {
          aDismissals +=
            1;
        }
      }

      if (
        idsB.has(
          striker
        ) &&
        idsA.has(
          bowler
        )
      ) {
        involved = true;
        bRuns +=
          number(
            ball.runsOffBat
          );

        if (
          isLegalBallFaced(
            ball
          )
        ) {
          bBalls += 1;
        }

        if (
          isBowlerWicket(
            ball
          ) &&
          idsB.has(
            number(
              ball.dismissedPlayerId
            )
          )
        ) {
          bDismissals +=
            1;
        }
      }
    }

    if (involved) {
      matchIds.add(
        match.id
      );
    }
  }

  const aScore =
    aRuns +
    aDismissals *
      -18 +
    (
      aBalls
        ? aRuns /
          aBalls *
          20
        : 0
    );

  const bScore =
    bRuns +
    bDismissals *
      -18 +
    (
      bBalls
        ? bRuns /
          bBalls *
          20
        : 0
    );

  /*
   * `matches` is already the function parameter containing all league
   * matches. Use a distinct name for the number of direct shared matches.
   */
  const sharedMatchCount =
    matchIds.size;

  const totalBalls =
    aBalls +
    bBalls;

  const totalDismissals =
    aDismissals +
    bDismissals;

  /*
   * Direct rivalry is shown as established only after repeat evidence.
   * Qualification:
   * - at least two shared matches and twelve legal head-to-head balls, OR
   * - at least two direct bowler-attributed dismissals.
   */
  const hasStrongSingleMatchBattingEvidence =
    sharedMatchCount ===
      1 &&
    (
      (
        aBalls >=
          8 &&
        aRuns >=
          20
      ) ||
      (
        bBalls >=
          8 &&
        bRuns >=
          20
      )
    );

  const isEstablished =
    (
      sharedMatchCount >=
        2 &&
      totalBalls >=
        12
    ) ||
    totalDismissals >=
      2 ||
    hasStrongSingleMatchBattingEvidence;

  const confidence =
    Math.min(
      100,
      Math.round(
        (
          Math.min(
            totalBalls /
              24,
            1
          ) *
            55 +
          Math.min(
            sharedMatchCount /
              4,
            1
          ) *
            30 +
          Math.min(
            totalDismissals /
              3,
            1
          ) *
            15
        )
      )
    );

  return {
    matches:
      sharedMatchCount,
    totalBalls,
    isEstablished,
    confidence,
    aRuns,
    aBalls,
    aDismissals,
    bRuns,
    bBalls,
    bDismissals,
    aStrikeRate:
      aBalls
        ? (
            aRuns /
            aBalls *
            100
          ).toFixed(1)
        : "0.0",
    bStrikeRate:
      bBalls
        ? (
            bRuns /
            bBalls *
            100
          ).toFixed(1)
        : "0.0",
    leader:
      !isEstablished
        ? "Not enough history"
        : aScore ===
            bScore
          ? "Tied rivalry"
          : aScore >
              bScore
            ? playerA.name
            : playerB.name,
  };
}

export async function generateMetadata({
  params,
}) {
  const {
    slug,
  } = await params;

  return {
    title:
      `Player Comparison | ${slug} | Cric4All`,
    description:
      "Compare two Cric4All league players, ratings, career statistics, recent form and direct head-to-head rivalry.",
  };
}

export default async function ComparePlayersPage({
  params,
  searchParams,
}) {
  const {
    slug,
  } = await params;

  const query =
    await searchParams;

  const league =
    await prisma.league.findFirst({
      where: {
        slug,
        visibility: {
          in: [
            "PUBLIC",
            "UNLISTED",
          ],
        },
      },
      include: {
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

  if (!league) {
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

  const identities =
    buildIdentityGroups(
      rosterPlayers
    )
      .sort(
        (left, right) =>
          left.name.localeCompare(
            right.name
          )
      );

  if (
    identities.length <
    2
  ) {
    return (
      <main className="pcp-page">
        <section className="pcp-shell">
          <div className="pcp-empty">
            <span>
              ⚔
            </span>
            <h1>
              Two players are required
            </h1>
            <p>
              Add at least two players to this league before opening the comparison center.
            </p>
            <Link
              href={`/leagues/${league.slug}`}
            >
              Back to league
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const profileRows =
    identities.map(
      (identity) => ({
        ...identity,
        stats:
          aggregateCareer(
            identity,
            league.matches
          ),
      })
    );

  const requestedA =
    number(
      query?.playerA
    );

  const requestedB =
    number(
      query?.playerB
    );

  const findByPlayerId =
    (playerId) =>
      profileRows.find(
        (identity) =>
          identity.playerIds.includes(
            number(
              playerId
            )
          )
      );

  const playerA =
    findByPlayerId(
      requestedA
    ) ||
    profileRows[0];

  let playerB =
    findByPlayerId(
      requestedB
    ) ||
    profileRows.find(
      (identity) =>
        identity.key !==
        playerA.key
    );

  if (
    playerB.key ===
    playerA.key
  ) {
    playerB =
      profileRows.find(
        (identity) =>
          identity.key !==
          playerA.key
      );
  }

  if (
    !requestedA ||
    !requestedB ||
    findByPlayerId(
      requestedA
    )?.key !==
      playerA.key ||
    findByPlayerId(
      requestedB
    )?.key !==
      playerB.key
  ) {
    redirect(
      `/leagues/${league.slug}/compare?playerA=${playerA.canonicalId}&playerB=${playerB.canonicalId}`
    );
  }

  const ratingsA =
    buildRatings(
      profileRows,
      playerA
    );

  const ratingsB =
    buildRatings(
      profileRows,
      playerB
    );

  const idToIdentity =
    new Map();

  for (
    const identity of
    identities
  ) {
    for (
      const id of
      identity.playerIds
    ) {
      idToIdentity.set(
        number(id),
        identity
      );
    }
  }

  const matchupsA =
    buildMatchups({
      identity:
        playerA,
      matches:
        league.matches,
      idToIdentity,
    });

  const matchupsB =
    buildMatchups({
      identity:
        playerB,
      matches:
        league.matches,
      idToIdentity,
    });

  const directRivalry =
    rivalryBetween({
      playerA,
      playerB,
      matches:
        league.matches,
    });

  const metrics = [
    {
      label:
        "Cric4All rating",
      left:
        ratingsA.overall,
      right:
        ratingsB.overall,
    },
    {
      label:
        "Appearances",
      left:
        playerA.stats
          .appearances,
      right:
        playerB.stats
          .appearances,
    },
    {
      label:
        "Runs",
      left:
        playerA.stats.runs,
      right:
        playerB.stats.runs,
    },
    {
      label:
        "Batting average",
      left:
        playerA.stats
          .average,
      right:
        playerB.stats
          .average,
    },
    {
      label:
        "Strike rate",
      left:
        playerA.stats
          .strikeRate,
      right:
        playerB.stats
          .strikeRate,
    },
    {
      label:
        "Highest score",
      left:
        playerA.stats
          .highest,
      right:
        playerB.stats
          .highest,
    },
    {
      label:
        "Wickets",
      left:
        playerA.stats
          .wickets,
      right:
        playerB.stats
          .wickets,
    },
    {
      label:
        "Economy",
      left:
        playerA.stats
          .economy,
      right:
        playerB.stats
          .economy,
      lowerIsBetter:
        true,
    },
    {
      label:
        "Best bowling",
      left:
        playerA.stats
          .bestBowling,
      right:
        playerB.stats
          .bestBowling,
      winner:
        "tie",
    },
    {
      label:
        "Recent form impact",
      left:
        playerA.stats
          .formImpact,
      right:
        playerB.stats
          .formImpact,
    },
  ];

  const leftWins =
    metrics.filter(
      (metric) =>
        (
          metric.winner ||
          compareValue(
            metric.left,
            metric.right,
            metric.lowerIsBetter
          )
        ) ===
        "left"
    ).length;

  const rightWins =
    metrics.filter(
      (metric) =>
        (
          metric.winner ||
          compareValue(
            metric.left,
            metric.right,
            metric.lowerIsBetter
          )
        ) ===
        "right"
    ).length;

  const comparisonLeader =
    leftWins ===
      rightWins
      ? "Comparison tied"
      : leftWins >
          rightWins
        ? playerA.name
        : playerB.name;

  const shareText =
    `${playerA.name} vs ${playerB.name} on Cric4All. ${comparisonLeader} leads the overall comparison ${Math.max(leftWins, rightWins)}-${Math.min(leftWins, rightWins)}.`;

  return (
    <main className="pcp-page">
      <section className="pcp-shell">
        <header className="pcp-hero">
          <div className="pcp-topbar">
            <Link
              href={`/leagues/${league.slug}`}
              className="pcp-back"
            >
              ← Back to league
            </Link>

            <span className="pcp-badge">
              ⚔ Player rivalry center
            </span>
          </div>

          <div className="pcp-heading">
            <p>
              Cric4All comparison
            </p>
            <h1>
              Player vs Player
            </h1>
            <span>
              Compare career production, ratings, form and direct head-to-head matchups.
            </span>
          </div>

          <form
            className="pcp-selector"
            method="GET"
          >
            <label>
              <span>
                Player one
              </span>
              <select
                name="playerA"
                defaultValue={
                  playerA.canonicalId
                }
              >
                {profileRows.map(
                  (identity) => (
                    <option
                      key={
                        identity.key
                      }
                      value={
                        identity.canonicalId
                      }
                    >
                      {identity.name} — {identity.teamLabel}
                    </option>
                  )
                )}
              </select>
            </label>

            <span className="pcp-versus">
              VS
            </span>

            <label>
              <span>
                Player two
              </span>
              <select
                name="playerB"
                defaultValue={
                  playerB.canonicalId
                }
              >
                {profileRows.map(
                  (identity) => (
                    <option
                      key={
                        identity.key
                      }
                      value={
                        identity.canonicalId
                      }
                    >
                      {identity.name} — {identity.teamLabel}
                    </option>
                  )
                )}
              </select>
            </label>

            <button
              type="submit"
            >
              Compare players
            </button>
          </form>
        </header>

        <div className="pcp-content">
          <section className="pcp-showdown">
            <article className="pcp-player pcp-player-left">
              <Link
                href={`/leagues/${league.slug}/players/${playerA.canonicalId}`}
                className="pcp-avatar"
              >
                {initials(
                  playerA.name
                )}
              </Link>

              <div>
                <small>
                  Player one
                </small>
                <h2>
                  {playerA.name}
                </h2>
                <p>
                  {playerA.teamLabel}
                </p>
              </div>

              <strong className="pcp-rating">
                {ratingsA.overall}
                <span>
                  /10
                </span>
              </strong>
            </article>

            <div className="pcp-result">
              <span>
                Overall leader
              </span>
              <strong>
                {comparisonLeader}
              </strong>
              <p>
                {leftWins} category wins · {rightWins} category wins
              </p>

              <CompareShareButton
                shareText={
                  shareText
                }
              />
            </div>

            <article className="pcp-player pcp-player-right">
              <strong className="pcp-rating">
                {ratingsB.overall}
                <span>
                  /10
                </span>
              </strong>

              <div>
                <small>
                  Player two
                </small>
                <h2>
                  {playerB.name}
                </h2>
                <p>
                  {playerB.teamLabel}
                </p>
              </div>

              <Link
                href={`/leagues/${league.slug}/players/${playerB.canonicalId}`}
                className="pcp-avatar"
              >
                {initials(
                  playerB.name
                )}
              </Link>
            </article>
          </section>

          <section className="pcp-section">
            <div className="pcp-section-heading">
              <div>
                <p>
                  Side by side
                </p>
                <h2>
                  Career comparison
                </h2>
              </div>
              <span>
                Higher value wins unless noted
              </span>
            </div>

            <div className="pcp-metric-list">
              {metrics.map(
                (metric) => {
                  const winner =
                    metric.winner ||
                    compareValue(
                      metric.left,
                      metric.right,
                      metric.lowerIsBetter
                    );

                  return (
                    <article
                      key={
                        metric.label
                      }
                      className="pcp-metric"
                    >
                      <strong
                        className={
                          winner ===
                          "left"
                            ? "is-winner"
                            : ""
                        }
                      >
                        {metric.left}
                      </strong>

                      <span>
                        {metric.label}
                      </span>

                      <strong
                        className={
                          winner ===
                          "right"
                            ? "is-winner"
                            : ""
                        }
                      >
                        {metric.right}
                      </strong>
                    </article>
                  );
                }
              )}
            </div>
          </section>

          <section className="pcp-section">
            <div className="pcp-section-heading">
              <div>
                <p>
                  Direct contest
                </p>
                <h2>
                  Head-to-head rivalry
                </h2>
              </div>
              <span>
                {directRivalry.matches} shared {directRivalry.matches === 1 ? "match" : "matches"} · {directRivalry.totalBalls} legal balls
              </span>
            </div>

            <div className="pcp-rivalry-card">
              <div>
                <small>
                  {playerA.name} batting against {playerB.name}
                </small>
                <strong>
                  {directRivalry.aRuns}
                </strong>
                <span>
                  runs from {directRivalry.aBalls} balls
                </span>
                <b>
                  SR {directRivalry.aStrikeRate} · dismissed {directRivalry.aDismissals} time{directRivalry.aDismissals === 1 ? "" : "s"}
                </b>
              </div>

              <div className="pcp-rivalry-winner">
                <span>
                  {directRivalry.isEstablished
                    ? directRivalry.matches ===
                        1
                      ? "Notable matchup leader"
                      : "Rivalry leader"
                    : "Matchup status"}
                </span>
                <strong>
                  {directRivalry.matches
                    ? directRivalry.leader
                    : "No direct matchup yet"}
                </strong>
                <small>
                  {directRivalry.isEstablished
                    ? directRivalry.matches ===
                        1
                      ? `${directRivalry.confidence}% confidence · strong single-match batting evidence`
                      : `${directRivalry.confidence}% evidence confidence`
                    : `Needs repeated interaction — currently ${directRivalry.confidence}% confidence`}
                </small>
              </div>

              <div>
                <small>
                  {playerB.name} batting against {playerA.name}
                </small>
                <strong>
                  {directRivalry.bRuns}
                </strong>
                <span>
                  runs from {directRivalry.bBalls} balls
                </span>
                <b>
                  SR {directRivalry.bStrikeRate} · dismissed {directRivalry.bDismissals} time{directRivalry.bDismissals === 1 ? "" : "s"}
                </b>
              </div>
            </div>
          </section>

          <section className="pcp-section">
            <div className="pcp-section-heading">
              <div>
                <p>
                  Matchup intelligence
                </p>
                <h2>
                  Top rivalries
                </h2>
              </div>
              <span>
                Established rivalries + notable batting matchups
              </span>
            </div>

            <div className="pcp-matchup-columns">
              <MatchupPanel
                title={`${playerA.name}'s batting matchups`}
                rows={
                  matchupsA.batting
                }
                leagueSlug={
                  league.slug
                }
                type="batting"
              />

              <MatchupPanel
                title={`${playerA.name}'s bowling matchups`}
                rows={
                  matchupsA.bowling
                }
                leagueSlug={
                  league.slug
                }
                type="bowling"
              />

              <MatchupPanel
                title={`${playerB.name}'s batting matchups`}
                rows={
                  matchupsB.batting
                }
                leagueSlug={
                  league.slug
                }
                type="batting"
              />

              <MatchupPanel
                title={`${playerB.name}'s bowling matchups`}
                rows={
                  matchupsB.bowling
                }
                leagueSlug={
                  league.slug
                }
                type="bowling"
              />
            </div>
          </section>

          <section className="pcp-section">
            <div className="pcp-section-heading">
              <div>
                <p>
                  Momentum
                </p>
                <h2>
                  Last-five form
                </h2>
              </div>
              <span>
                Impact from recent appearances
              </span>
            </div>

            <div className="pcp-form-columns">
              <FormPanel
                player={
                  playerA
                }
              />
              <FormPanel
                player={
                  playerB
                }
              />
            </div>
          </section>

          <footer className="pcp-footer">
            Statistics are calculated from recorded Cric4All deliveries and update automatically after scoring.
          </footer>
        </div>
      </section>
    </main>
  );
}

function MatchupPanel({
  title,
  rows,
  leagueSlug,
  type,
}) {
  return (
    <article className="pcp-matchup-panel">
      <h3>
        {title}
      </h3>

      {rows.length ? (
        <div>
          {rows
            .slice(0, 5)
            .map(
              (row, index) => (
                <Link
                  href={`/leagues/${leagueSlug}/players/${row.identity.canonicalId}`}
                  key={
                    row.identity.key
                  }
                  className="pcp-matchup-row"
                >
                  <span>
                    {index + 1}
                  </span>

                  <div>
                    <strong>
                      {row.identity.name}
                    </strong>
                    <small>
                      {row.identity.teamLabel}
                    </small>
                  </div>

                  {type ===
                  "batting" ? (
                    <b>
                      {row.runs} runs
                      <small>
                        {row.balls} balls · {row.dismissals} outs
                      </small>
                      <small>
                        {row.matchupCategory ===
                        "ESTABLISHED_RIVALRY"
                          ? "⚔ Established rivalry"
                          : "🔥 Notable batting matchup"}
                      </small>
                    </b>
                  ) : (
                    <b>
                      {row.wickets} wickets
                      <small>
                        {row.overs} overs · {row.economy} econ
                      </small>
                    </b>
                  )}
                </Link>
              )
            )}
        </div>
      ) : (
        <p className="pcp-no-data">
          {type === "batting"
            ? "No qualifying batting matchup yet."
            : "No qualifying bowling rivalry yet."}
        </p>
      )}
    </article>
  );
}

function FormPanel({
  player,
}) {
  return (
    <article className="pcp-form-panel">
      <header>
        <div className="pcp-mini-avatar">
          {initials(
            player.name
          )}
        </div>
        <div>
          <small>
            Current form
          </small>
          <h3>
            {player.name}
          </h3>
        </div>
        <strong>
          {player.stats.formImpact}
        </strong>
      </header>

      {player.stats.form.length ? (
        <div className="pcp-form-list">
          {player.stats.form.map(
            (row) => (
              <div
                key={
                  row.matchId
                }
              >
                <span>
                  {row.title}
                </span>
                <b>
                  {row.runs}R · {row.wickets}W
                </b>
                <strong>
                  {row.impact}
                </strong>
              </div>
            )
          )}
        </div>
      ) : (
        <p className="pcp-no-data">
          No recent scored appearances.
        </p>
      )}
    </article>
  );
}
