import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

function formatOversFromBalls(balls) {
  const overs = Math.floor(Number(balls || 0) / 6);
  const rem = Number(balls || 0) % 6;
  return `${overs}.${rem}`;
}

function safeRate(numerator, denominator, multiplier = 1) {
  if (!denominator) return "0.00";
  return ((Number(numerator || 0) / Number(denominator)) * multiplier).toFixed(2);
}

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

function isStatsMatch(status) {
  const s = normalizeStatus(status);

  return (
    s.includes("IN_PROGRESS") ||
    s.includes("LIVE") ||
    s.includes("STARTED") ||
    s.includes("COMPLETED") ||
    s.includes("LOCKED")
  );
}

function wicketsForBowler(ball) {
  if (!ball.isWicket) return 0;

  if (
    ["RUN_OUT", "RETIRED_OUT", "RETIRED_HURT"].includes(
      ball.wicketType
    )
  ) {
    return 0;
  }

  if (ball.extraType === "NOBALL") return 0;

  return 1;
}

function runsChargedToBowler(ball) {
  if (["BYE", "LEGBYE"].includes(ball.extraType)) {
    return 0;
  }

  return Number(ball.runsOffBat || 0) + Number(ball.extras || 0);
}

function getPlayerName(playerMap, id) {
  if (!id) return "";
  return playerMap.get(Number(id))?.playerName || "";
}

function formatDismissal(ball, playerMap) {
  const bowler = getPlayerName(playerMap, ball.bowlerId);
  const fielder = getPlayerName(playerMap, ball.fielderId);
  const assistant = getPlayerName(playerMap, ball.assistantFielderId);

  switch (ball.wicketType) {
    case "BOWLED":
      return bowler ? `b ${bowler}` : "bowled";

    case "LBW":
      return bowler ? `lbw b ${bowler}` : "lbw";

    case "CAUGHT":
      return `c ${fielder || "fielder"}${bowler ? ` b ${bowler}` : ""}`;

    case "STUMPED":
      return `st ${fielder || "keeper"}${bowler ? ` b ${bowler}` : ""}`;

    case "RUN_OUT":
      if (fielder && assistant) {
        return `run out (${fielder} / ${assistant})`;
      }
      if (fielder) {
        return `run out (${fielder})`;
      }
      return "run out";

    case "HIT_WICKET":
      return bowler ? `hit wicket b ${bowler}` : "hit wicket";

    case "RETIRED_HURT":
      return "retired hurt";

    case "RETIRED_OUT":
      return "retired out";

    case "OTHER":
      return ball.wicketNote || "out";

    default:
      return "out";
  }
}

function ensurePlayer(statsMap, player) {
  if (!statsMap.has(player.id)) {
    statsMap.set(player.id, {
      playerId: player.id,
      playerName: player.name,
      teamId: player.teamId,
      teamName: player.team?.name || "",

      matchesSet: new Set(),

      battingInnings: 0,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      outs: 0,
      highestScore: 0,
      dismissals: [],

      bowlingBalls: 0,
      bowlingRuns: 0,
      wickets: 0,
      dots: 0,
      bestWickets: 0,
      bestRuns: 0,

      catches: 0,
      runOuts: 0,
      stumpings: 0,
      assists: 0
    });
  }

  return statsMap.get(player.id);
}
function playerStatsKey(player, shouldMergePlayersByName) {
  if (shouldMergePlayersByName) {
    return String(player.name || "")
      .trim()
      .toLowerCase();
  }

  return String(player.id);
}
export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const leagueId = Number(id);

    if (!leagueId || Number.isNaN(leagueId)) {
      return NextResponse.json(
        { error: "Invalid league id" },
        { status: 400 }
      );
    }

    const league = await prisma.league.findUnique({
  where: { id: leagueId }
});

const shouldMergePlayersByName =
  league?.name?.trim().toLowerCase() ===
  "surprise cricket league";

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const membership = await prisma.leagueMember.findFirst({
      where: {
        leagueId,
        userId: user.id
      }
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You do not have access to this league" },
        { status: 403 }
      );
    }

    const teams = await prisma.team.findMany({
      where: { leagueId },
      include: {
        players: {
          include: {
            team: true
          }
        }
      }
    });

    const matches = await prisma.match.findMany({
      where: { leagueId },
      include: {
        balls: {
          orderBy: [
            { inningsNo: "asc" },
            { sequence: "asc" }
          ]
        },
        teamA: true,
        teamB: true,
        battingFirstTeam: true
      }
    });

    const allPlayers = teams.flatMap((team) => team.players || []);

    const playerMap = new Map();
    const statsMap = new Map();

for (const player of allPlayers) {
  const key = playerStatsKey(player, shouldMergePlayersByName);

  if (!statsMap.has(key)) {
    statsMap.set(key, {
      playerId: key,
      playerName: player.name,
      teamId: player.teamId,
      teamName: shouldMergePlayersByName
        ? "Surprise 1 / Surprise 2"
        : player.team?.name || "",

      matchesSet: new Set(),

      battingInnings: 0,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      outs: 0,
      highestScore: 0,
      dismissals: [],

      bowlingBalls: 0,
      bowlingRuns: 0,
      wickets: 0,
      dots: 0,
      bestWickets: 0,
      bestRuns: 0,

      catches: 0,
      runOuts: 0,
      stumpings: 0,
      assists: 0
    });
  }

  playerMap.set(Number(player.id), statsMap.get(key));
}

    /*
    const eligibleMatches = matches.filter((match) =>
      isStatsMatch(match.status)
    );
    */
const eligibleMatches = matches;
    for (const match of eligibleMatches) {
      const inningsScoresByPlayer = new Map();
      const bowlingFiguresByPlayer = new Map();

      for (const ball of match.balls || []) {
const striker = playerMap.get(Number(ball.strikerId));
const bowler = playerMap.get(Number(ball.bowlerId));
        if (striker) {
          striker.matchesSet.add(match.id);

          if (!inningsScoresByPlayer.has(striker.playerId)) {
            inningsScoresByPlayer.set(striker.playerId, {
              runs: 0,
              balls: 0
            });
          }

          const inningsScore = inningsScoresByPlayer.get(striker.playerId);

          striker.runs += Number(ball.runsOffBat || 0);
          inningsScore.runs += Number(ball.runsOffBat || 0);

          if (
            Number(ball.runsOffBat || 0) === 4 &&
            ball.extraType !== "BYE" &&
            ball.extraType !== "LEGBYE"
          ) {
            striker.fours += 1;
          }

          if (
            Number(ball.runsOffBat || 0) === 6 &&
            ball.extraType !== "BYE" &&
            ball.extraType !== "LEGBYE"
          ) {
            striker.sixes += 1;
          }

          if (
            ball.extraType !== "WIDE" &&
            ball.extraType !== "NOBALL" &&
            ball.wicketType !== "RETIRED_HURT"
          ) {
            striker.balls += 1;
            inningsScore.balls += 1;
          }
        }

        if (bowler) {
          bowler.matchesSet.add(match.id);

          if (!bowlingFiguresByPlayer.has(bowler.playerId)) {
            bowlingFiguresByPlayer.set(bowler.playerId, {
              runs: 0,
              wickets: 0
            });
          }

          const figure = bowlingFiguresByPlayer.get(bowler.playerId);

          const chargedRuns = runsChargedToBowler(ball);
          const bowlerWickets = wicketsForBowler(ball);

          bowler.bowlingRuns += chargedRuns;
          bowler.wickets += bowlerWickets;

          figure.runs += chargedRuns;
          figure.wickets += bowlerWickets;

          if (
            ball.legalDelivery &&
            ball.wicketType !== "RETIRED_HURT"
          ) {
            bowler.bowlingBalls += 1;

            if (Number(ball.totalRuns || 0) === 0) {
              bowler.dots += 1;
            }
          }
        }

        if (
          ball.isWicket &&
          ball.dismissedPlayerId &&
          ball.wicketType !== "RETIRED_HURT"
        ) {
const dismissed = playerMap.get(Number(ball.dismissedPlayerId));

          if (dismissed) {
            dismissed.outs += 1;
            dismissed.dismissals.push(formatDismissal(ball, playerMap));
          }
        }

const fielder = playerMap.get(Number(ball.fielderId));

        if (fielder) {
          fielder.matchesSet.add(match.id);

          if (ball.wicketType === "CAUGHT") {
            fielder.catches += 1;
          }

          if (ball.wicketType === "STUMPED") {
            fielder.stumpings += 1;
          }

          if (ball.wicketType === "RUN_OUT") {
            fielder.runOuts += 1;
          }
        }

const assistant = playerMap.get(Number(ball.assistantFielderId));

        if (assistant && ball.wicketType === "RUN_OUT") {
          assistant.matchesSet.add(match.id);
          assistant.assists += 1;
        }
      }

      for (const [playerId, score] of inningsScoresByPlayer.entries()) {
        const player = statsMap.get(playerId);

        if (player && (score.runs > 0 || score.balls > 0)) {
          player.battingInnings += 1;
          player.highestScore = Math.max(
            player.highestScore,
            score.runs
          );
        }
      }

      for (const [playerId, figure] of bowlingFiguresByPlayer.entries()) {
        const player = statsMap.get(playerId);

        if (!player) continue;

        if (
          figure.wickets > player.bestWickets ||
          (
            figure.wickets === player.bestWickets &&
            figure.runs < player.bestRuns
          )
        ) {
          player.bestWickets = figure.wickets;
          player.bestRuns = figure.runs;
        }
      }
    }

    const rows = [...statsMap.values()].map((row) => {
      const matchesPlayed = row.matchesSet.size;
      const battingAverage = row.outs
        ? (row.runs / row.outs).toFixed(2)
        : row.runs > 0
          ? "Not out"
          : "0.00";

      const strikeRate = safeRate(row.runs, row.balls, 100);
      const economy = safeRate(row.bowlingRuns, row.bowlingBalls, 6);
      const bowlingAverage = row.wickets
        ? (row.bowlingRuns / row.wickets).toFixed(2)
        : "0.00";

      const bowlingStrikeRate = row.wickets
        ? (row.bowlingBalls / row.wickets).toFixed(2)
        : "0.00";

      const fieldingTotal =
        row.catches + row.runOuts + row.stumpings + row.assists;

      const allRounderPoints =
        row.runs +
        row.wickets * 25 +
        row.catches * 10 +
        row.runOuts * 10 +
        row.stumpings * 10 +
        row.assists * 5;

      return {
        playerId: row.playerId,
        playerName: row.playerName,
        teamId: row.teamId,
        teamName: row.teamName,
        matches: matchesPlayed,

        battingInnings: row.battingInnings,
        runs: row.runs,
        balls: row.balls,
        average: battingAverage,
        strikeRate,
        fours: row.fours,
        sixes: row.sixes,
        highestScore: row.highestScore,
        outs: row.outs,
        lastDismissal: row.dismissals.at(-1) || "not out",

        bowlingOvers: formatOversFromBalls(row.bowlingBalls),
        bowlingBalls: row.bowlingBalls,
        bowlingRuns: row.bowlingRuns,
        wickets: row.wickets,
        economy,
        bowlingAverage,
        bowlingStrikeRate,
        dots: row.dots,
        bestBowling:
          row.bestWickets > 0
            ? `${row.bestWickets}/${row.bestRuns}`
            : "-",

        catches: row.catches,
        runOuts: row.runOuts,
        stumpings: row.stumpings,
        assists: row.assists,
        fieldingTotal,

        allRounderPoints
      };
    });

    const batting = rows
      .filter((r) => r.runs > 0 || r.balls > 0 || r.outs > 0)
      .sort((a, b) => b.runs - a.runs || Number(b.strikeRate) - Number(a.strikeRate));

    const bowling = rows
      .filter((r) => r.bowlingBalls > 0 || r.wickets > 0)
      .sort((a, b) => b.wickets - a.wickets || Number(a.economy) - Number(b.economy));

    const fielding = rows
      .filter((r) => r.fieldingTotal > 0)
      .sort((a, b) => b.fieldingTotal - a.fieldingTotal);

const rankings = {
  topRunScorers: [...batting]
    .sort((a, b) => b.runs - a.runs),

  topWicketTakers: [...bowling]
    .sort((a, b) => b.wickets - a.wickets),

  bestStrikeRate: [...batting]
    .filter((r) => r.balls >= 10)
    .sort((a, b) => Number(b.strikeRate) - Number(a.strikeRate)),

  bestEconomy: [...bowling]
    .filter((r) => r.bowlingBalls >= 6)
    .sort((a, b) => Number(a.economy) - Number(b.economy)),

  mostSixes: [...batting]
    .sort((a, b) => b.sixes - a.sixes),

  mostCatches: [...fielding]
    .sort((a, b) => b.catches - a.catches),

  bestAllRounders: [...rows]
    .filter((r) => r.allRounderPoints > 0)
    .sort((a, b) => b.allRounderPoints - a.allRounderPoints)
};
    return NextResponse.json({
      leagueId,
      matchesCount: eligibleMatches.length,
      batting,
      bowling,
      fielding,
      rankings
    });
  } catch (error) {
    console.error("League stats failed:", error);
    return NextResponse.json(
      { error: "Failed to load league stats" },
      { status: 500 }
    );
  }
}