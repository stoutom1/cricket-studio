import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getKitRotationKey } from "@/lib/kit/rotation-scope";

export const runtime = "nodejs";

function isValidPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const matchId = Number(id);

    if (!isValidPositiveInteger(matchId)) {
      return NextResponse.json(
        { error: "Invalid match id." },
        { status: 400 }
      );
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        leagueId: true,
        teamAId: true,
        teamBId: true,
        status: true,
        league: {
          select: {
            id: true,
            name: true,
            kitRotationMode: true,
          },
        },
        teamA: {
          select: {
            id: true,
            name: true,
          },
        },
        teamB: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!match) {
      return NextResponse.json(
        { error: "Match not found." },
        { status: 404 }
      );
    }

    if (!match.league) {
      return NextResponse.json(
        {
          error:
            "The match does not belong to a valid league.",
        },
        { status: 400 }
      );
    }

    const rotationMode =
      match.league.kitRotationMode || "TEAM";

    const teamARotationKey = getKitRotationKey({
      leagueId: match.leagueId,
      teamId: match.teamAId,
      rotationMode,
    });

    const teamBRotationKey = getKitRotationKey({
      leagueId: match.leagueId,
      teamId: match.teamBId,
      rotationMode,
    });

    const [assignments, savedPlayers, rotationMembers] =
      await Promise.all([
        prisma.kitAssignment.findMany({
          where: { matchId },
          orderBy: [
            { teamId: "asc" },
            { assignedAt: "desc" },
          ],
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
            rotationMember: {
              select: {
                id: true,
                playerId: true,
                displayName: true,
                normalizedName: true,
                whatsappNumber: true,
                whatsappOptIn: true,
                completedCount: true,
                lastCompletedAt: true,
                lastAssignedAt: true,
                rotationKey: true,
              },
            },
            matchKitPlayer: {
              select: {
                id: true,
                displayName: true,
                normalizedName: true,
                teamId: true,
                playerId: true,
                isConfirmed: true,
                isEligible: true,
              },
            },
            actualRotationMember: {
              select: {
                id: true,
                playerId: true,
                displayName: true,
                normalizedName: true,
                rotationKey: true,
              },
            },
            actualMatchKitPlayer: {
              select: {
                id: true,
                displayName: true,
                normalizedName: true,
                teamId: true,
                playerId: true,
              },
            },
          },
        }),

        prisma.matchKitPlayer.findMany({
          where: {
            matchId,
            isConfirmed: true,
            isEligible: true,
          },
          orderBy: [
            { teamId: "asc" },
            { displayName: "asc" },
          ],
          select: {
            id: true,
            matchId: true,
            teamId: true,
            playerId: true,
            displayName: true,
            normalizedName: true,
            isConfirmed: true,
            isEligible: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),

        prisma.kitRotationMember.findMany({
          where: {
            rotationKey: {
              in: [
                ...new Set([
                  teamARotationKey,
                  teamBRotationKey,
                ]),
              ],
            },
            isActive: true,
          },
          select: {
            id: true,
            playerId: true,
            displayName: true,
            normalizedName: true,
            rotationKey: true,
          },
        }),
      ]);

    const rotationMemberByKeyAndName = new Map(
      rotationMembers.map((member) => [
        `${member.rotationKey}:${member.normalizedName}`,
        member,
      ])
    );

    const eligiblePlayers = savedPlayers.map((player) => {
      const rotationKey = getKitRotationKey({
        leagueId: match.leagueId,
        teamId: player.teamId,
        rotationMode,
      });

      const rotationMember =
        rotationMemberByKeyAndName.get(
          `${rotationKey}:${player.normalizedName}`
        ) || null;

      return {
        ...player,
        rotationKey,
        rotationMemberId: rotationMember?.id || null,
      };
    });

    const teamAPlayers = eligiblePlayers.filter(
      (player) => player.teamId === match.teamAId
    );

    const teamBPlayers = eligiblePlayers.filter(
      (player) => player.teamId === match.teamBId
    );

    const assignmentsByTeam = {
      teamA:
        assignments.find(
          (assignment) =>
            assignment.teamId === match.teamAId
        ) || null,
      teamB:
        assignments.find(
          (assignment) =>
            assignment.teamId === match.teamBId
        ) || null,
    };

    return NextResponse.json({
      success: true,
      match: {
        id: match.id,
        status: match.status,
        leagueId: match.leagueId,
        leagueName: match.league.name || "",
        kitRotationMode: rotationMode,
        teamA: match.teamA,
        teamB: match.teamB,
      },
      savedPlayerCount: eligiblePlayers.length,
      savedPlayerCounts: {
        total: eligiblePlayers.length,
        teamA: teamAPlayers.length,
        teamB: teamBPlayers.length,
      },
      savedPlayers: eligiblePlayers,
      eligiblePlayers,
      playersByTeam: {
        teamA: teamAPlayers,
        teamB: teamBPlayers,
      },
      assignments,
      assignmentsByTeam,
    });
  } catch (error) {
    console.error(
      "Unable to load kit assignments:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load kit assignments.",
      },
      { status: 500 }
    );
  }
}