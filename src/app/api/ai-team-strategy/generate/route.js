import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canUseAIStrategy } from "@/lib/aiStrategyAccess";
import {
  getCrossTeamHistoryRule,
  isCrossTeamHistoryTeam,
  normalizePlayerIdentity,
} from "@/lib/aiStrategyLeagueRules";
import { buildStrategyMetrics } from "@/lib/strategyMetrics";
import { generateStrategy } from "@/lib/strategyEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function uniquePositiveIntegers(values) {
  return [
    ...new Set(
      (values || [])
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0)
    ),
  ];
}

function remapBallPlayerIds(ball, aliasToSelectedPlayerId) {
  const remap = (value) => {
    const numericId = Number(value);
    return aliasToSelectedPlayerId.get(numericId) || numericId || null;
  };

  return {
    ...ball,
    strikerId: remap(ball.strikerId),
    nonStrikerId: remap(ball.nonStrikerId),
    bowlerId: remap(ball.bowlerId),
    dismissedPlayerId: remap(ball.dismissedPlayerId),
    newBatterId: remap(ball.newBatterId),
  };
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canUseAIStrategy(session.user?.email)) {
      return NextResponse.json(
        { error: "AI Match Strategy is not enabled for this account." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const strategyType =
      body.strategyType === "SINGLE_TEAM" ? "SINGLE_TEAM" : "GENERATED_TEAM";
    const minimumPlayers = strategyType === "SINGLE_TEAM" ? 11 : 4;
    const playerIds = uniquePositiveIntegers(body.playerIds);

    const oversPerInnings = Math.max(
      1,
      Math.min(100, Number(body.oversPerInnings) || 20)
    );

    if (playerIds.length < minimumPlayers) {
      return NextResponse.json(
        { error: `Select at least ${minimumPlayers} players.` },
        { status: 400 }
      );
    }

    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
      select: {
        id: true,
        name: true,
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
            leagueId: true,
            league: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (players.length !== playerIds.length) {
      return NextResponse.json(
        { error: "One or more selected players could not be found." },
        { status: 400 }
      );
    }

    const leagueIds = [
      ...new Set(players.map((player) => player.team?.leagueId).filter(Boolean)),
    ];

    if (leagueIds.length !== 1) {
      return NextResponse.json(
        { error: "All selected players must belong to the same league." },
        { status: 400 }
      );
    }

    if (strategyType === "SINGLE_TEAM") {
      const selectedTeamIds = uniquePositiveIntegers(
        players.map((player) => player.teamId)
      );

      if (selectedTeamIds.length !== 1) {
        return NextResponse.json(
          {
            error:
              "Single Team Strategy requires all selected players to belong to the same team.",
          },
          { status: 400 }
        );
      }
    }

    const leagueId = Number(leagueIds[0]);
    const leagueName = players[0]?.team?.league?.name || "";
    const crossTeamRule = getCrossTeamHistoryRule(leagueName);

    const selectedPlayerByIdentity = new Map();

    for (const player of players) {
      const identity = normalizePlayerIdentity(player.name);
      if (identity && !selectedPlayerByIdentity.has(identity)) {
        selectedPlayerByIdentity.set(identity, player);
      }
    }

    let historyPlayerIds = [...playerIds];
    let historyTeamIds = uniquePositiveIntegers(
      players.map((player) => player.teamId)
    );
    const aliasToSelectedPlayerId = new Map(
      players.map((player) => [Number(player.id), Number(player.id)])
    );
    const combinedAliases = [];

    if (crossTeamRule) {
      const sharedRosterTeams = await prisma.team.findMany({
        where: { leagueId },
        select: {
          id: true,
          name: true,
          players: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const eligibleTeams = sharedRosterTeams.filter((team) =>
        isCrossTeamHistoryTeam(crossTeamRule, team.name)
      );

      historyTeamIds = uniquePositiveIntegers([
        ...historyTeamIds,
        ...eligibleTeams.map((team) => team.id),
      ]);

      for (const team of eligibleTeams) {
        for (const aliasPlayer of team.players) {
          const identity = normalizePlayerIdentity(aliasPlayer.name);
          const selectedPlayer = selectedPlayerByIdentity.get(identity);

          if (!selectedPlayer) continue;

          const aliasId = Number(aliasPlayer.id);
          const selectedId = Number(selectedPlayer.id);

          aliasToSelectedPlayerId.set(aliasId, selectedId);
          historyPlayerIds.push(aliasId);

          if (aliasId !== selectedId) {
            combinedAliases.push({
              selectedPlayerId: selectedId,
              selectedPlayerName: selectedPlayer.name,
              aliasPlayerId: aliasId,
              aliasPlayerName: aliasPlayer.name,
              sourceTeamId: Number(team.id),
              sourceTeamName: team.name,
            });
          }
        }
      }

      historyPlayerIds = uniquePositiveIntegers(historyPlayerIds);
    }

    const recentMatches = await prisma.match.findMany({
      where: {
        OR: [
          { teamAId: { in: historyTeamIds } },
          { teamBId: { in: historyTeamIds } },
        ],
      },
      select: {
        id: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const recentMatchIds = recentMatches.map((match) => match.id);

    const rawBalls = await prisma.ball.findMany({
      where: {
        OR: [
          { strikerId: { in: historyPlayerIds } },
          { bowlerId: { in: historyPlayerIds } },
          { dismissedPlayerId: { in: historyPlayerIds } },
        ],
      },
      orderBy: [
        { matchId: "asc" },
        { inningsNo: "asc" },
        { sequence: "asc" },
      ],
    });

    const balls = crossTeamRule
      ? rawBalls.map((ball) => remapBallPlayerIds(ball, aliasToSelectedPlayerId))
      : rawBalls;

    const metrics = buildStrategyMetrics({
      players: players.map((player) => ({
        id: player.id,
        playerName: player.name,
      })),
      balls,
      oversPerInnings,
      recentMatchIds,
    });

    const strategy = generateStrategy({
      battingMetrics: metrics.batting,
      bowlingMetrics: metrics.bowling,
      oversPerInnings,
    });

    return NextResponse.json({
      success: true,
      strategyType,
      teamName: String(body.teamName || "").trim() || "Selected Team",
      oversPerInnings,
      league: {
        id: leagueId,
        name: leagueName,
      },
      historyScope: crossTeamRule
        ? {
            mode: "COMBINED_SHARED_ROSTER_TEAMS",
            teamIds: historyTeamIds,
            combinedAliasCount: combinedAliases.length,
            combinedAliases,
          }
        : {
            mode: "SELECTED_TEAM_ONLY",
            teamIds: historyTeamIds,
            combinedAliasCount: 0,
            combinedAliases: [],
          },
      players: players.map((player) => ({
        id: player.id,
        name: player.name,
        teamId: player.teamId,
        sourceTeam: player.team?.name || null,
      })),
      metrics,
      strategy,
    });
  } catch (error) {
    console.error("AI Match Strategy generation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate match strategy.",
      },
      { status: 500 }
    );
  }
}
