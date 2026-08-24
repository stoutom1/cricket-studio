import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  buildMatchStats,
  summarizeInningsDetailed,
  getBattingTeamId,
} from "@/lib/scoring";
import {
  shouldExcludePlayerFromLeagueAnalytics,
} from "@/lib/player-analytics-exclusions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPLETED_STATUSES = [
  "COMPLETED",
  "COMPLETED_LOCKED",
  "COMPLETED_CORRECTED",
];

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const distanceFromMonday =
    day === 0
      ? 6
      : day - 1;

  result.setDate(
    result.getDate() -
      distanceFromMonday
  );
  result.setHours(0, 0, 0, 0);

  return result;
}

function endOfWeek(date) {
  const result =
    startOfWeek(date);

  result.setDate(
    result.getDate() + 7
  );

  return result;
}

function startOfMonth(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

function endOfMonth(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    1
  );
}

function shiftMonth(
  date,
  offset
) {
  return new Date(
    date.getFullYear(),
    date.getMonth() +
      offset,
    1
  );
}

function safeNumber(value) {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function rounded(value, digits = 2) {
  const multiplier =
    10 ** digits;

  return (
    Math.round(
      safeNumber(value) *
        multiplier
    ) /
    multiplier
  );
}

function playerKey(playerId, playerName) {
  return playerId
    ? `ID:${playerId}`
    : `NAME:${String(
        playerName || ""
      )
        .trim()
        .toLowerCase()}`;
}

function addMapValue(map, key, factory) {
  if (!map.has(key)) {
    map.set(
      key,
      factory()
    );
  }

  return map.get(key);
}

function playerIdentity({
  playerId,
  playerName,
  teamId,
  teamName,
}) {
  return {
    playerId:
      playerId
        ? Number(playerId)
        : null,

    playerName:
      playerName ||
      "Unknown player",

    teamId:
      teamId
        ? Number(teamId)
        : null,

    teamName:
      teamName ||
      "Unknown team",
  };
}

function formatOvers(balls) {
  const legalBalls =
    safeNumber(balls);

  return `${Math.floor(
    legalBalls / 6
  )}.${legalBalls % 6}`;
}

function matchDate(match) {
  return (
    match.endedAt ||
    match.scheduledAt ||
    match.startedAt ||
    match.createdAt
  );
}

function buildPlayerMap(match) {
  const map =
    new Map();

  for (
    const player of
    match.teamA?.players || []
  ) {
    map.set(
      Number(player.id),
      {
        ...player,
        teamId:
          match.teamAId,
        teamName:
          match.teamA?.name ||
          "Team A",
      }
    );
  }

  for (
    const player of
    match.teamB?.players || []
  ) {
    map.set(
      Number(player.id),
      {
        ...player,
        teamId:
          match.teamBId,
        teamName:
          match.teamB?.name ||
          "Team B",
      }
    );
  }

  return map;
}

function winningTeamId(match) {
  const playerMap =
    buildPlayerMap(match);

  const first =
    summarizeInningsDetailed(
      (match.balls || []).filter(
        (ball) =>
          Number(
            ball.inningsNo
          ) === 1
      ),
      playerMap,
      match.oversPerInnings
    );

  const second =
    summarizeInningsDetailed(
      (match.balls || []).filter(
        (ball) =>
          Number(
            ball.inningsNo
          ) === 2
      ),
      playerMap,
      match.oversPerInnings
    );

  if (
    second.runs >
    first.runs
  ) {
    return getBattingTeamId(
      match,
      2
    );
  }

  if (
    first.runs >
    second.runs
  ) {
    return getBattingTeamId(
      match,
      1
    );
  }

  return null;
}

function aggregatePlayers(matches) {
  const players =
    new Map();

  for (
    const match of
    matches
  ) {
    const stats =
      buildMatchStats(match);

    const matchPlayers =
      new Set();

    for (
      const row of
      stats.batting || []
    ) {
      const key =
        playerKey(
          row.playerId,
          row.playerName
        );

      const item =
        addMapValue(
          players,
          key,
          () => ({
            ...playerIdentity(
              row
            ),

            matches: 0,
            battingInnings: 0,
            runs: 0,
            ballsFaced: 0,
            outs: 0,
            fours: 0,
            sixes: 0,
            highestScore: 0,

            bowlingInnings: 0,
            bowlingBalls: 0,
            bowlingRuns: 0,
            wickets: 0,
            dots: 0,
            bestWickets: 0,
            bestRuns: null,

            catches: 0,
            runOuts: 0,
            stumpings: 0,
            assists: 0,

            wins: 0,
            impactScore: 0,
            matchPerformances: [],
          })
        );

      item.playerName =
        row.playerName ||
        item.playerName;

      item.teamId =
        row.teamId ||
        item.teamId;

      item.teamName =
        row.teamName ||
        item.teamName;

      item.battingInnings += 1;
      item.runs +=
        safeNumber(
          row.runs
        );
      item.ballsFaced +=
        safeNumber(
          row.balls
        );
      item.outs +=
        safeNumber(
          row.outs
        );
      item.fours +=
        safeNumber(
          row.fours
        );
      item.sixes +=
        safeNumber(
          row.sixes
        );
      item.highestScore =
        Math.max(
          item.highestScore,
          safeNumber(
            row.runs
          )
        );

      matchPlayers.add(key);

      item.matchPerformances.push({
        matchId:
          match.id,

        matchDate:
          matchDate(match),

        battingRuns:
          safeNumber(
            row.runs
          ),

        battingBalls:
          safeNumber(
            row.balls
          ),

        wickets: 0,
        bowlingRuns: 0,
        catches: 0,
        runOuts: 0,
        stumpings: 0,
      });
    }

    for (
      const row of
      stats.bowling || []
    ) {
      const key =
        playerKey(
          row.playerId,
          row.playerName
        );

      const item =
        addMapValue(
          players,
          key,
          () => ({
            ...playerIdentity(
              row
            ),

            matches: 0,
            battingInnings: 0,
            runs: 0,
            ballsFaced: 0,
            outs: 0,
            fours: 0,
            sixes: 0,
            highestScore: 0,

            bowlingInnings: 0,
            bowlingBalls: 0,
            bowlingRuns: 0,
            wickets: 0,
            dots: 0,
            bestWickets: 0,
            bestRuns: null,

            catches: 0,
            runOuts: 0,
            stumpings: 0,
            assists: 0,

            wins: 0,
            impactScore: 0,
            matchPerformances: [],
          })
        );

      item.playerName =
        row.playerName ||
        item.playerName;

      item.teamId =
        row.teamId ||
        item.teamId;

      item.teamName =
        row.teamName ||
        item.teamName;

      const wickets =
        safeNumber(
          row.wickets
        );

      const runs =
        safeNumber(
          row.runs
        );

      item.bowlingInnings += 1;
      item.bowlingBalls +=
        safeNumber(
          row.balls
        );
      item.bowlingRuns += runs;
      item.wickets += wickets;
      item.dots +=
        safeNumber(
          row.dots
        );

      if (
        wickets >
          item.bestWickets ||
        (
          wickets ===
            item.bestWickets &&
          (
            item.bestRuns ==
              null ||
            runs <
              item.bestRuns
          )
        )
      ) {
        item.bestWickets =
          wickets;
        item.bestRuns =
          runs;
      }

      matchPlayers.add(key);

      let performance =
        item.matchPerformances.find(
          (entry) =>
            entry.matchId ===
            match.id
        );

      if (!performance) {
        performance = {
          matchId:
            match.id,

          matchDate:
            matchDate(match),

          battingRuns: 0,
          battingBalls: 0,
          wickets: 0,
          bowlingRuns: 0,
          catches: 0,
          runOuts: 0,
          stumpings: 0,
        };

        item.matchPerformances.push(
          performance
        );
      }

      performance.wickets +=
        wickets;
      performance.bowlingRuns +=
        runs;
    }

    const fielding =
      new Map();

    const playerMap =
      buildPlayerMap(match);

    for (
      const ball of
      match.balls || []
    ) {
      const wicketType =
        normalizeStatus(
          ball.wicketType
        );

      const fielderIds = [
        {
          id:
            safeNumber(
              ball.fielderId
            ),

          assist: false,
        },

        {
          id:
            safeNumber(
              ball.assistantFielderId
            ),

          assist: true,
        },
      ].filter(
        (entry) =>
          entry.id > 0
      );

      for (
        const entry of
        fielderIds
      ) {
        const player =
          playerMap.get(
            entry.id
          );

        if (!player) {
          continue;
        }

        const key =
          playerKey(
            player.id,
            player.name
          );

        const row =
          addMapValue(
            fielding,
            key,
            () => ({
              ...playerIdentity({
                playerId:
                  player.id,

                playerName:
                  player.name,

                teamId:
                  player.teamId,

                teamName:
                  player.teamName,
              }),

              catches: 0,
              runOuts: 0,
              stumpings: 0,
              assists: 0,
            })
          );

        if (
          wicketType ===
            "CAUGHT" &&
          !entry.assist
        ) {
          row.catches += 1;
        }

        if (
          wicketType ===
          "RUN_OUT"
        ) {
          if (
            entry.assist
          ) {
            row.assists += 1;
          } else {
            row.runOuts += 1;
          }
        }
      }

      if (
        wicketType ===
        "STUMPED"
      ) {
        const keeperId =
          Number(
            ball.fielderId ||
            0
          );

        const keeper =
          playerMap.get(
            keeperId
          );

        if (keeper) {
          const key =
            playerKey(
              keeper.id,
              keeper.name
            );

          const row =
            addMapValue(
              fielding,
              key,
              () => ({
                ...playerIdentity({
                  playerId:
                    keeper.id,

                  playerName:
                    keeper.name,

                  teamId:
                    keeper.teamId,

                  teamName:
                    keeper.teamName,
                }),

                catches: 0,
                runOuts: 0,
                stumpings: 0,
                assists: 0,
              })
            );

          row.stumpings += 1;
        }
      }
    }

    for (
      const [
        key,
        row,
      ] of fielding.entries()
    ) {
      const item =
        addMapValue(
          players,
          key,
          () => ({
            ...playerIdentity(
              row
            ),

            matches: 0,
            battingInnings: 0,
            runs: 0,
            ballsFaced: 0,
            outs: 0,
            fours: 0,
            sixes: 0,
            highestScore: 0,

            bowlingInnings: 0,
            bowlingBalls: 0,
            bowlingRuns: 0,
            wickets: 0,
            dots: 0,
            bestWickets: 0,
            bestRuns: null,

            catches: 0,
            runOuts: 0,
            stumpings: 0,
            assists: 0,

            wins: 0,
            impactScore: 0,
            matchPerformances: [],
          })
        );

      item.catches +=
        row.catches;
      item.runOuts +=
        row.runOuts;
      item.stumpings +=
        row.stumpings;
      item.assists +=
        row.assists;

      matchPlayers.add(key);

      let performance =
        item.matchPerformances.find(
          (entry) =>
            entry.matchId ===
            match.id
        );

      if (!performance) {
        performance = {
          matchId:
            match.id,

          matchDate:
            matchDate(match),

          battingRuns: 0,
          battingBalls: 0,
          wickets: 0,
          bowlingRuns: 0,
          catches: 0,
          runOuts: 0,
          stumpings: 0,
        };

        item.matchPerformances.push(
          performance
        );
      }

      performance.catches +=
        row.catches;
      performance.runOuts +=
        row.runOuts;
      performance.stumpings +=
        row.stumpings;
    }

    const winnerId =
      winningTeamId(match);

    for (
      const key of
      matchPlayers
    ) {
      const item =
        players.get(key);

      item.matches += 1;

      if (
        winnerId &&
        Number(
          item.teamId
        ) ===
          Number(
            winnerId
          )
      ) {
        item.wins += 1;
      }
    }
  }

  return [
    ...players.values(),
  ].map(
    (item) => {
      const battingAverage =
        item.outs
          ? item.runs /
            item.outs
          : item.runs;

      const strikeRate =
        item.ballsFaced
          ? (
              item.runs /
              item.ballsFaced
            ) *
            100
          : 0;

      const economy =
        item.bowlingBalls
          ? (
              item.bowlingRuns /
              item.bowlingBalls
            ) *
            6
          : 0;

      const bowlingAverage =
        item.wickets
          ? item.bowlingRuns /
            item.wickets
          : null;

      const fieldingTotal =
        item.catches +
        item.runOuts +
        item.stumpings +
        item.assists;

      /*
       * Transparent community-cricket impact model:
       * batting + bowling + fielding + contribution to wins.
       * It does not replace human award decisions.
       */
      const impactScore =
        item.runs +
        item.wickets *
          25 +
        item.catches *
          10 +
        item.runOuts *
          12 +
        item.stumpings *
          12 +
        item.assists *
          6 +
        item.wins *
          5 +
        Math.max(
          0,
          strikeRate - 100
        ) *
          0.12 +
        (
          item.bowlingBalls >=
            6 &&
          economy > 0
            ? Math.max(
                0,
                8 - economy
              ) *
              2
            : 0
        );

      return {
        ...item,

        battingAverage:
          rounded(
            battingAverage,
            2
          ),

        strikeRate:
          rounded(
            strikeRate,
            1
          ),

        economy:
          rounded(
            economy,
            2
          ),

        bowlingAverage:
          bowlingAverage ==
          null
            ? null
            : rounded(
                bowlingAverage,
                2
              ),

        fieldingTotal,

        impactScore:
          rounded(
            impactScore,
            1
          ),

        bestBowling:
          item.bestRuns ==
          null
            ? "—"
            : `${item.bestWickets}/${item.bestRuns}`,
      };
    }
  );
}

function bestBy(
  rows,
  compare
) {
  return [
    ...rows,
  ].sort(compare)[0] || null;
}

function awardFromPlayer({
  key,
  title,
  icon,
  player,
  value,
  subtitle,
  explanation,
}) {
  if (!player) {
    return {
      key,
      title,
      icon,
      available: false,
      value: "—",
      subtitle:
        "No qualifying performance",
      explanation:
        "Complete more matches to calculate this award.",
    };
  }

  return {
    key,
    title,
    icon,
    available: true,

    playerId:
      player.playerId,

    playerName:
      player.playerName,

    teamId:
      player.teamId,

    teamName:
      player.teamName,

    value:
      value(player),

    subtitle:
      subtitle(player),

    explanation:
      explanation(player),

    metrics: player,
  };
}

function calculateBestPartnership(matches, isExcludedPlayer = () => false) {
  let best =
    null;

  for (
    const match of
    matches
  ) {
    const playerMap =
      buildPlayerMap(match);

    for (
      const inningsNo of
      [1, 2]
    ) {
      const summary =
        summarizeInningsDetailed(
          (match.balls || []).filter(
            (ball) =>
              Number(
                ball.inningsNo
              ) ===
              inningsNo
          ),
          playerMap,
          match.oversPerInnings
        );

      for (
        const partnership of
        summary.partnerships || []
      ) {
        const playerOne =
          partnership.batter1 ||
          partnership.player1Name ||
          partnership.batter1Name ||
          partnership.strikerName ||
          "Batter 1";

        const playerTwo =
          partnership.batter2 ||
          partnership.player2Name ||
          partnership.batter2Name ||
          partnership.nonStrikerName ||
          "Batter 2";

        if (
          isExcludedPlayer(playerOne) ||
          isExcludedPlayer(playerTwo)
        ) {
          continue;
        }

        const runs =
          safeNumber(
            partnership.runs
          );

        if (
          !best ||
          runs >
            best.runs
        ) {
          best = {
            matchId:
              match.id,

            matchDate:
              matchDate(match),

            teamId:
              getBattingTeamId(
                match,
                inningsNo
              ),

            teamName:
              getBattingTeamId(
                match,
                inningsNo
              ) ===
                match.teamAId
                ? match.teamA
                    ?.name ||
                  "Team A"
                : match.teamB
                    ?.name ||
                  "Team B",

            inningsNo,
            runs,

            balls:
              safeNumber(
                partnership.balls
              ),

            /*
             * summarizeInningsDetailed currently returns batter1/batter2.
             * Keep compatibility with possible future/older field names,
             * but prioritize the actual current fields.
             */
            playerOne,
            playerTwo,
          };
        }
      }
    }
  }

  return best;
}

function calculateMostImproved({
  currentPlayers,
  previousPlayers,
}) {
  const previousMap =
    new Map(
      previousPlayers.map(
        (player) => [
          playerKey(
            player.playerId,
            player.playerName
          ),
          player,
        ]
      )
    );

  const candidates =
    currentPlayers
      .map(
        (player) => {
          const previous =
            previousMap.get(
              playerKey(
                player.playerId,
                player.playerName
              )
            );

          if (
            !previous ||
            previous.matches < 1 ||
            player.matches < 1
          ) {
            return null;
          }

          const currentPerMatch =
            player.impactScore /
            Math.max(
              1,
              player.matches
            );

          const previousPerMatch =
            previous.impactScore /
            Math.max(
              1,
              previous.matches
            );

          const improvement =
            currentPerMatch -
            previousPerMatch;

          return {
            ...player,

            previousImpactPerMatch:
              rounded(
                previousPerMatch,
                1
              ),

            currentImpactPerMatch:
              rounded(
                currentPerMatch,
                1
              ),

            improvement:
              rounded(
                improvement,
                1
              ),
          };
        }
      )
      .filter(
        (player) =>
          player &&
          player.improvement > 0
      )
      .sort(
        (a, b) =>
          b.improvement -
          a.improvement
      );

  return candidates[0] || null;
}

function calculateTeamOfWeek(players) {
  if (!players.length) {
    return [];
  }

  const selected =
    [];
  const used =
    new Set();

  function addPlayer(
    player,
    role
  ) {
    if (!player) {
      return;
    }

    const key =
      playerKey(
        player.playerId,
        player.playerName
      );

    if (used.has(key)) {
      return;
    }

    used.add(key);

    selected.push({
      playerId:
        player.playerId,

      playerName:
        player.playerName,

      teamId:
        player.teamId,

      teamName:
        player.teamName,

      role,

      runs:
        player.runs,

      wickets:
        player.wickets,

      fieldingTotal:
        player.fieldingTotal,

      impactScore:
        player.impactScore,
    });
  }

  const batters =
    [...players].sort(
      (a, b) =>
        b.runs -
          a.runs ||
        b.strikeRate -
          a.strikeRate
    );

  const bowlers =
    [...players].sort(
      (a, b) =>
        b.wickets -
          a.wickets ||
        a.economy -
          b.economy
    );

  const allRounders =
    [...players].sort(
      (a, b) =>
        (
          b.runs +
          b.wickets *
            25
        ) -
        (
          a.runs +
          a.wickets *
            25
        )
    );

  const fielders =
    [...players].sort(
      (a, b) =>
        b.fieldingTotal -
          a.fieldingTotal ||
        b.impactScore -
          a.impactScore
    );

  for (
    const player of
    batters
  ) {
    if (
      selected.filter(
        (entry) =>
          entry.role ===
          "Batter"
      ).length >= 4
    ) {
      break;
    }

    addPlayer(
      player,
      "Batter"
    );
  }

  for (
    const player of
    allRounders
  ) {
    if (
      selected.filter(
        (entry) =>
          entry.role ===
          "All-rounder"
      ).length >= 2
    ) {
      break;
    }

    if (
      player.runs > 0 &&
      player.wickets > 0
    ) {
      addPlayer(
        player,
        "All-rounder"
      );
    }
  }

  for (
    const player of
    bowlers
  ) {
    if (
      selected.filter(
        (entry) =>
          entry.role ===
          "Bowler"
      ).length >= 4
    ) {
      break;
    }

    if (
      player.wickets > 0 ||
      player.bowlingBalls > 0
    ) {
      addPlayer(
        player,
        "Bowler"
      );
    }
  }

  for (
    const player of
    fielders
  ) {
    if (
      selected.length >= 11
    ) {
      break;
    }

    addPlayer(
      player,
      player.stumpings > 0
        ? "Wicketkeeper"
        : "Fielder"
    );
  }

  for (
    const player of
    [...players].sort(
      (a, b) =>
        b.impactScore -
        a.impactScore
    )
  ) {
    if (
      selected.length >= 11
    ) {
      break;
    }

    addPlayer(
      player,
      "Utility"
    );
  }

  return selected.slice(0, 11);
}

function isLegalBattingDelivery(
  ball
) {
  const extraType =
    normalizeStatus(
      ball.extraType
    );

  return ![
    "WIDE",
    "NOBALL",
    "NO_BALL",
  ].includes(
    extraType
  );
}

function calculateFastestFifty(
  matches,
  isExcludedPlayer = () => false
) {
  let fastest =
    null;

  for (
    const match of
    matches
  ) {
    const playerMap =
      buildPlayerMap(match);

    for (
      const inningsNo of
      [1, 2]
    ) {
      const battingTeamId =
        getBattingTeamId(
          match,
          inningsNo
        );

      const battingTeamName =
        battingTeamId ===
          match.teamAId
          ? match.teamA?.name ||
            "Team A"
          : match.teamB?.name ||
            "Team B";

      const batterProgress =
        new Map();

      const inningsBalls =
        (match.balls || [])
          .filter(
            (ball) =>
              Number(
                ball.inningsNo
              ) ===
              inningsNo
          )
          .sort(
            (left, right) =>
              safeNumber(
                left.sequence
              ) -
                safeNumber(
                  right.sequence
                ) ||
              safeNumber(
                left.id
              ) -
                safeNumber(
                  right.id
                )
          );

      for (
        const ball of
        inningsBalls
      ) {
        const strikerId =
          Number(
            ball.strikerId ||
            ball.batterId ||
            0
          );

        if (
          !strikerId
        ) {
          continue;
        }

        const player =
          playerMap.get(
            strikerId
          );

        if (
          isExcludedPlayer(
            player?.name || ""
          )
        ) {
          continue;
        }

        const progress =
          addMapValue(
            batterProgress,
            strikerId,
            () => ({
              playerId:
                strikerId,

              playerName:
                player?.name ||
                "Unknown player",

              teamId:
                battingTeamId,

              teamName:
                battingTeamName,

              runs: 0,
              balls: 0,
              reachedFifty:
                false,
            })
          );

        progress.runs +=
          safeNumber(
            ball.runsOffBat
          );

        if (
          isLegalBattingDelivery(
            ball
          )
        ) {
          progress.balls += 1;
        }

        if (
          progress.reachedFifty ||
          progress.runs < 50
        ) {
          continue;
        }

        progress.reachedFifty =
          true;

        const candidate = {
          playerId:
            progress.playerId,

          playerName:
            progress.playerName,

          teamId:
            progress.teamId,

          teamName:
            progress.teamName,

          balls:
            progress.balls,

          runsAtMilestone:
            progress.runs,

          matchId:
            match.id,

          matchDate:
            matchDate(
              match
            ),

          inningsNo,

          opponentName:
            battingTeamId ===
              match.teamAId
              ? match.teamB?.name ||
                "Team B"
              : match.teamA?.name ||
                "Team A",

          overLabel:
            `${safeNumber(
              ball.overNo
            )}.${safeNumber(
              ball.ballInOver
            )}`,
        };

        if (
          !fastest ||
          candidate.balls <
            fastest.balls ||
          (
            candidate.balls ===
              fastest.balls &&
            candidate.runsAtMilestone >
              fastest.runsAtMilestone
          ) ||
          (
            candidate.balls ===
              fastest.balls &&
            candidate.runsAtMilestone ===
              fastest.runsAtMilestone &&
            new Date(
              candidate.matchDate
            ) <
              new Date(
                fastest.matchDate
              )
          )
        ) {
          fastest =
            candidate;
        }
      }
    }
  }

  return fastest;
}

function calculateAwards({
  periodMatches,
  previousPeriodMatches,
  seasonMatches,
  league,
  periodLabel = "selected period",
}) {
  const isExcludedPlayer = (playerName) =>
    shouldExcludePlayerFromLeagueAnalytics(
      league,
      playerName
    );
  const weeklyMatches =
    periodMatches;

  const previousWeekMatches =
    previousPeriodMatches;

  const awardScopeTitle =
    periodLabel ===
    "selected series"
      ? "Series"
      : periodLabel ===
          "month"
        ? "Month"
        : "Week";

  const weeklyPlayers =
    aggregatePlayers(
      weeklyMatches
    ).filter(
      (player) =>
        !isExcludedPlayer(
          player.playerName
        )
    );

  const previousPlayers =
    aggregatePlayers(
      previousWeekMatches
    ).filter(
      (player) =>
        !isExcludedPlayer(
          player.playerName
        )
    );

  const seasonPlayers =
    aggregatePlayers(
      seasonMatches
    ).filter(
      (player) =>
        !isExcludedPlayer(
          player.playerName
        )
    );

  const mvp =
    bestBy(
      weeklyPlayers,
      (a, b) =>
        b.impactScore -
        a.impactScore
    );

  const weeklyBatter =
    bestBy(
      weeklyPlayers.filter(
        (player) =>
          player.battingInnings >
          0
      ),
      (a, b) =>
        b.runs -
          a.runs ||
        b.strikeRate -
          a.strikeRate
    );

  const weeklyBowler =
    bestBy(
      weeklyPlayers.filter(
        (player) =>
          player.bowlingInnings >
          0
      ),
      (a, b) =>
        b.wickets -
          a.wickets ||
        a.economy -
          b.economy
    );

  const weeklyFielder =
    bestBy(
      weeklyPlayers.filter(
        (player) =>
          player.fieldingTotal >
          0
      ),
      (a, b) =>
        b.fieldingTotal -
          a.fieldingTotal ||
        b.catches -
          a.catches
    );

  const orangeCap =
    bestBy(
      seasonPlayers.filter(
        (player) =>
          player.battingInnings >
          0
      ),
      (a, b) =>
        b.runs -
          a.runs ||
        b.battingAverage -
          a.battingAverage
    );

  const purpleCap =
    bestBy(
      seasonPlayers.filter(
        (player) =>
          player.bowlingInnings >
          0
      ),
      (a, b) =>
        b.wickets -
          a.wickets ||
        a.economy -
          b.economy
    );

  const mostImproved =
    calculateMostImproved({
      currentPlayers:
        weeklyPlayers,

      previousPlayers,
    });

  const bestPartnership =
    calculateBestPartnership(
      weeklyMatches,
      isExcludedPlayer
    );

  /*
   * Fastest Fifty is a season-wide marquee award. It is deliberately
   * calculated from seasonMatches rather than weeklyMatches so the card
   * remains visible and meaningful while users browse any week.
   */
  const fastestFifty =
    calculateFastestFifty(
      seasonMatches,
      isExcludedPlayer
    );

  return {
    awards: [
      awardFromPlayer({
        key: "MVP",
        title: "MVP",
        icon: "🏆",
        player: mvp,

        value: (player) =>
          `${player.impactScore} impact`,

        subtitle: (player) =>
          `${player.runs} runs · ${player.wickets} wickets · ${player.fieldingTotal} fielding`,

        explanation: () =>
          `Highest combined batting, bowling, fielding and winning-impact score for the ${periodLabel}.`,
      }),

      {
        key:
          "FASTEST_FIFTY",

        title:
          "Fastest Fifty",

        icon:
          "⚡",

        available:
          Boolean(
            fastestFifty
          ),

        alwaysVisible:
          true,

        playerId:
          fastestFifty?.playerId ||
          null,

        playerName:
          fastestFifty?.playerName ||
          "No fifty recorded yet",

        teamId:
          fastestFifty?.teamId ||
          null,

        teamName:
          fastestFifty?.teamName ||
          `Season ${seasonMatches[0]
            ? new Date(
                matchDate(
                  seasonMatches[0]
                )
              ).getFullYear()
            : ""}`.trim(),

        value:
          fastestFifty
            ? `${fastestFifty.balls} balls`
            : "Record waiting",

        subtitle:
          fastestFifty
            ? `50 reached at ${fastestFifty.runsAtMilestone} · vs ${fastestFifty.opponentName}`
            : "The first recorded fifty will claim this spotlight.",

        explanation:
          fastestFifty
            ? `Reached fifty in ${fastestFifty.balls} legal deliveries during innings ${fastestFifty.inningsNo}.`
            : "This card always remains visible. It activates automatically when a batter reaches 50 in a completed match.",

        methodology:
          "Season-wide record. Runs off the bat count toward the milestone. Wides and no-balls do not count as balls faced.",
      },

      awardFromPlayer({
        key: "BATTER_OF_WEEK",
        title: `Batter of the ${awardScopeTitle}`,
        icon: "🏏",
        player:
          weeklyBatter,

        value: (player) =>
          `${player.runs} runs`,

        subtitle: (player) =>
          `Avg ${player.battingAverage} · SR ${player.strikeRate}`,

        explanation: () =>
          `Selected by runs in the ${periodLabel}, with strike rate used as the tie-breaker.`,
      }),

      awardFromPlayer({
        key: "BOWLER_OF_WEEK",
        title: `Bowler of the ${awardScopeTitle}`,
        icon: "🎯",
        player:
          weeklyBowler,

        value: (player) =>
          `${player.wickets} wickets`,

        subtitle: (player) =>
          `${player.bestBowling} best · Eco ${player.economy}`,

        explanation: () =>
          `Selected by wickets in the ${periodLabel}, with economy used as the tie-breaker.`,
      }),

      awardFromPlayer({
        key: "FIELDER_OF_WEEK",
        title: `Fielder of the ${awardScopeTitle}`,
        icon: "🧤",
        player:
          weeklyFielder,

        value: (player) =>
          `${player.fieldingTotal} contributions`,

        subtitle: (player) =>
          `${player.catches} catches · ${player.runOuts} run outs · ${player.assists} assists`,

        explanation: () =>
          "Selected from recorded catches, run outs, stumpings and assists.",
      }),

      {
        key:
          "BEST_PARTNERSHIP",

        title:
          "Best Partnership",

        icon:
          "🤝",

        available:
          Boolean(
            bestPartnership
          ),

        playerName:
          bestPartnership
            ? `${bestPartnership.playerOne} & ${bestPartnership.playerTwo}`
            : null,

        teamName:
          bestPartnership?.teamName ||
          null,

        value:
          bestPartnership
            ? `${bestPartnership.runs} runs`
            : "—",

        subtitle:
          bestPartnership
            ? `${bestPartnership.balls} balls · Innings ${bestPartnership.inningsNo}`
            : "No partnership data",

        explanation:
          `Highest recorded partnership in completed matches for the ${periodLabel}.`,
      },

      awardFromPlayer({
        key:
          "MOST_IMPROVED",

        title:
          "Most Improved Player",

        icon:
          "📈",

        player:
          mostImproved,

        value: (player) =>
          `+${player.improvement} impact/match`,

        subtitle: (player) =>
          `${player.previousImpactPerMatch} → ${player.currentImpactPerMatch}`,

        explanation: () =>
          `Compares impact per match with the immediately preceding ${periodLabel === "month" ? "month" : "week"}. Requires appearances in both periods.`,
      }),

      awardFromPlayer({
        key:
          "ORANGE_CAP",

        title:
          "Orange Cap",

        icon:
          "🟠",

        player:
          orangeCap,

        value: (player) =>
          `${player.runs} runs`,

        subtitle: (player) =>
          `${player.matches} matches · Avg ${player.battingAverage}`,

        explanation: () =>
          "Season leader by total runs.",
      }),

      awardFromPlayer({
        key:
          "PURPLE_CAP",

        title:
          "Purple Cap",

        icon:
          "🟣",

        player:
          purpleCap,

        value: (player) =>
          `${player.wickets} wickets`,

        subtitle: (player) =>
          `${player.matches} matches · Eco ${player.economy}`,

        explanation: () =>
          "Season leader by total wickets.",
      }),
    ],

    teamOfWeek:
      calculateTeamOfWeek(
        weeklyPlayers
      ),

    weeklyLeaders: {
      batting:
        [...weeklyPlayers]
          .sort(
            (a, b) =>
              b.runs -
              a.runs
          )
          .slice(0, 5),

      bowling:
        [...weeklyPlayers]
          .sort(
            (a, b) =>
              b.wickets -
                a.wickets ||
              a.economy -
                b.economy
          )
          .slice(0, 5),

      fielding:
        [...weeklyPlayers]
          .sort(
            (a, b) =>
              b.fieldingTotal -
              a.fieldingTotal
          )
          .slice(0, 5),
    },

    seasonLeaders: {
      batting:
        [...seasonPlayers]
          .sort(
            (a, b) =>
              b.runs -
              a.runs
          )
          .slice(0, 10),

      bowling:
        [...seasonPlayers]
          .sort(
            (a, b) =>
              b.wickets -
                a.wickets ||
              a.economy -
                b.economy
          )
          .slice(0, 10),
    },
  };
}

export async function GET(
  request,
  { params }
) {
  const session =
    await getServerSession(
      authOptions
    );

  if (
    !session?.user?.email
  ) {
    return NextResponse.json(
      {
        error:
          "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const { id } =
    await params;

  const leagueId =
    Number(id);

  if (
    !Number.isInteger(
      leagueId
    ) ||
    leagueId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid league id.",
      },
      {
        status: 400,
      }
    );
  }

  const url =
    new URL(
      request.url
    );

  const requestedPeriod =
    String(
      url.searchParams.get(
        "period"
      ) ||
      "WEEK"
    )
      .trim()
      .toUpperCase();

  let period =
    requestedPeriod ===
    "MONTH"
      ? "MONTH"
      : "WEEK";

  const weekOffsetRaw =
    Number(
      url.searchParams.get(
        "weekOffset"
      ) ||
      0
    );

  const monthOffsetRaw =
    Number(
      url.searchParams.get(
        "monthOffset"
      ) ||
      0
    );

  const weekOffset =
    Number.isInteger(
      weekOffsetRaw
    )
      ? Math.max(
          -52,
          Math.min(
            0,
            weekOffsetRaw
          )
        )
      : 0;

  const monthOffset =
    Number.isInteger(
      monthOffsetRaw
    )
      ? Math.max(
          -24,
          Math.min(
            0,
            monthOffsetRaw
          )
        )
      : 0;

  const seriesIdRaw =
    Number(
      url.searchParams.get(
        "seriesId"
      )
    );

  const seriesId =
    Number.isInteger(
      seriesIdRaw
    ) &&
    seriesIdRaw > 0
      ? seriesIdRaw
      : null;

  /*
   * Selecting a Series creates a dedicated SERIES scope.
   * Week/month and their offsets are intentionally ignored.
   */
  if (seriesId) {
    period =
      "SERIES";
  }

  const user =
    await prisma.user
      .findUnique({
        where: {
          email:
            session.user.email,
        },

        select: {
          id: true,
        },
      });

  if (!user) {
    return NextResponse.json(
      {
        error:
          "User not found.",
      },
      {
        status: 404,
      }
    );
  }

  const league =
    await prisma.league
      .findUnique({
        where: {
          id:
            leagueId,
        },

        select: {
          id: true,
          name: true,
          ownerId: true,
          createdAt: true,

          series: {
            orderBy: [
              {
                year:
                  "desc",
              },

              {
                name:
                  "asc",
              },
            ],

            select: {
              id: true,
              name: true,
              year: true,
              status: true,
            },
          },

          members: {
            where: {
              userId:
                user.id,
            },

            select: {
              id: true,
              canViewStats:
                true,
            },
          },
        },
      });

  if (!league) {
    return NextResponse.json(
      {
        error:
          "League not found.",
      },
      {
        status: 404,
      }
    );
  }

  const isOwner =
    league.ownerId ===
    user.id;

  const member =
    league.members[0] ||
    null;

  if (
    !isOwner &&
    (
      !member ||
      member.canViewStats !==
        true
    )
  ) {
    return NextResponse.json(
      {
        error:
          "You do not have permission to view league awards.",
      },
      {
        status: 403,
      }
    );
  }

  const now =
    new Date();

  const weeklyReference =
    new Date(now);

  weeklyReference.setDate(
    weeklyReference.getDate() +
      weekOffset * 7
  );

  const monthlyReference =
    shiftMonth(
      now,
      monthOffset
    );

  let periodStart =
    period ===
    "MONTH"
      ? startOfMonth(
          monthlyReference
        )
      : startOfWeek(
          weeklyReference
        );

  let periodEnd =
    period ===
    "MONTH"
      ? endOfMonth(
          monthlyReference
        )
      : endOfWeek(
          weeklyReference
        );

  let previousPeriodStart =
    period ===
    "MONTH"
      ? startOfMonth(
          shiftMonth(
            monthlyReference,
            -1
          )
        )
      : new Date(
          periodStart
        );

  if (
    period ===
    "WEEK"
  ) {
    previousPeriodStart.setDate(
      previousPeriodStart.getDate() -
        7
    );
  }

  let previousPeriodEnd =
    new Date(
      periodStart
    );

  const include = {
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
      orderBy: [
        {
          inningsNo:
            "asc",
        },

        {
          sequence:
            "asc",
        },

        {
          id:
            "asc",
        },
      ],
    },

    wicketKeeperChanges:
      true,

    series: {
      select: {
        id: true,
        name: true,
        year: true,
      },
    },
  };

  const allCompleted =
    await prisma.match
      .findMany({
        where: {
          leagueId,

          status: {
            in:
              COMPLETED_STATUSES,
          },

          ...(seriesId
            ? {
                seriesId,
              }
            : {}),
        },

        include,

        orderBy: [
          {
            endedAt:
              "desc",
          },

          {
            scheduledAt:
              "desc",
          },

          {
            createdAt:
              "desc",
          },
        ],
      });

  /*
   * SERIES mode uses every completed match in the selected Series.
   * Week/month ranges are ignored completely.
   */
  if (
    period ===
      "SERIES" &&
    allCompleted.length
  ) {
    const orderedDates =
      allCompleted
        .map(
          (match) =>
            new Date(
              matchDate(
                match
              )
            )
        )
        .filter(
          (date) =>
            !Number.isNaN(
              date.getTime()
            )
        )
        .sort(
          (left, right) =>
            left -
            right
        );

    if (
      orderedDates.length
    ) {
      periodStart =
        orderedDates[0];

      periodEnd =
        new Date(
          orderedDates[
            orderedDates.length -
              1
          ]
        );

      periodEnd.setMilliseconds(
        periodEnd.getMilliseconds() +
          1
      );

      previousPeriodStart =
        periodStart;

      previousPeriodEnd =
        periodStart;
    }
  }

  const periodMatches =
    period ===
    "SERIES"
      ? allCompleted
      : allCompleted.filter(
          (match) => {
            const date =
              new Date(
                matchDate(match)
              );

            return (
              date >=
                periodStart &&
              date <
                periodEnd
            );
          }
        );

  /*
   * There is no meaningful automatic previous-Series comparison.
   * Most Improved therefore remains unavailable in Series mode rather
   * than comparing unrelated competitions.
   */
  const previousPeriodMatches =
    period ===
    "SERIES"
      ? []
      : allCompleted.filter(
          (match) => {
            const date =
              new Date(
                matchDate(match)
              );

            return (
              date >=
                previousPeriodStart &&
              date <
                previousPeriodEnd
            );
          }
        );

  /*
   * Caps use the selected period's calendar year. When a Series filter is
   * selected, the cap race is automatically limited to that Series because
   * allCompleted was already filtered by seriesId.
   */
  const selectedSeries =
    seriesId
      ? league.series.find(
          (series) =>
            series.id ===
            seriesId
        ) ||
        null
      : null;

  const seasonYear =
    selectedSeries?.year ||
    periodStart.getFullYear();

  const seasonStart =
    new Date(
      seasonYear,
      0,
      1
    );

  const seasonEnd =
    new Date(
      seasonYear + 1,
      0,
      1
    );

  const seasonMatches =
    period ===
    "SERIES"
      ? allCompleted
      : allCompleted.filter(
          (match) => {
            const date =
              new Date(
                matchDate(match)
              );

            return (
              date >=
                seasonStart &&
              date <
                seasonEnd
            );
          }
        );

  const calculated =
    calculateAwards({
      periodMatches,
      previousPeriodMatches,
      seasonMatches,
      league,

      periodLabel:
        period ===
        "SERIES"
          ? "selected series"
          : period ===
              "MONTH"
            ? "month"
            : "week",
    });

  return NextResponse.json({
    success: true,

    league: {
      id:
        league.id,

      name:
        league.name,
    },

    filters: {
      period,
      weekOffset,
      monthOffset,
      seriesId,
    },

    availableSeries:
      league.series,

    selectedSeries,

    period: {
      type:
        period,

      weekOffset,
      monthOffset,

      start:
        periodStart
          .toISOString(),

      end:
        periodEnd
          .toISOString(),

      previousStart:
        previousPeriodStart
          .toISOString(),

      previousEnd:
        previousPeriodEnd
          .toISOString(),

      /*
       * Backward-compatible aliases used by the existing UI.
       */
      weekStart:
        periodStart
          .toISOString(),

      weekEnd:
        periodEnd
          .toISOString(),

      previousWeekStart:
        previousPeriodStart
          .toISOString(),

      seasonYear,
    },

    counts: {
      periodMatches:
        periodMatches.length,

      previousPeriodMatches:
        previousPeriodMatches.length,

      weeklyMatches:
        periodMatches.length,

      previousWeekMatches:
        previousPeriodMatches.length,

      seasonMatches:
        seasonMatches.length,
    },

    methodology: {
      mvp:
        "Combined batting, bowling, fielding and winning-impact score.",

      mostImproved:
        period ===
        "SERIES"
          ? "Not automatically calculated in Series mode because there is no reliable previous-Series comparison."
          : period ===
              "MONTH"
            ? "Compares impact per match with the immediately preceding month."
            : "Compares impact per match with the immediately preceding week.",

      teamOfWeek:
        period ===
        "SERIES"
          ? "Balanced data-driven XI assembled from the selected Series."
          : period ===
              "MONTH"
            ? "Balanced data-driven XI assembled from the month's top batters, all-rounders, bowlers and fielders."
            : "Balanced data-driven XI assembled from the week's top batters, all-rounders, bowlers and fielders.",

      fastestFifty:
        "Season-wide record based on the fewest legal balls needed to reach 50 runs off the bat.",

      caps:
        "Orange and Purple Caps use completed matches in the selected calendar year.",
    },

    ...calculated,
  });
}
