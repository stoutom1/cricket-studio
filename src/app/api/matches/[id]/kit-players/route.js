import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { normalizeKitPlayerName } from "@/lib/kit/name-normalization";
import { getKitRotationKey } from "@/lib/kit/rotation-scope";

export const runtime = "nodejs";

/**
 * Converts an optional value into a valid positive integer.
 * Returns null when the value is missing or invalid.
 */
function optionalPositiveInteger(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0
  ) {
    return null;
  }

  return parsedValue;
}

/**
 * Cleans an optional WhatsApp number.
 */
function cleanWhatsAppNumber(value) {
  const cleanedValue = String(value || "").trim();

  return cleanedValue || null;
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const matchId = Number(id);

    if (
      !Number.isInteger(matchId) ||
      matchId <= 0
    ) {
      return NextResponse.json(
        {
          error: "Invalid match id.",
        },
        {
          status: 400,
        }
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid request body.",
        },
        {
          status: 400,
        }
      );
    }

    const submittedTeams = Array.isArray(body?.teams)
      ? body.teams
      : [];

      const sourceMode =
  String(body?.sourceMode || "SCREENSHOT")
    .trim()
    .toUpperCase();

    if (submittedTeams.length === 0) {
      return NextResponse.json(
        {
          error:
            "At least one team player list is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Load the match and league rotation configuration.
     *
     * For Surprise Cricket League:
     * kitRotationMode = LEAGUE_PLAYER
     *
     * For standard leagues:
     * kitRotationMode = TEAM
     */
    const match = await prisma.match.findUnique({
      where: {
        id: matchId,
      },
      select: {
        id: true,
        leagueId: true,
        teamAId: true,
        teamBId: true,

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
        {
          error: "Match not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (!match.league) {
      return NextResponse.json(
        {
          error:
            "The match is not connected to a valid league.",
        },
        {
          status: 400,
        }
      );
    }

    const permittedTeamIds = new Set([
      Number(match.teamAId),
      Number(match.teamBId),
    ]);

    const rows = [];

    /*
     * Prevent the same team from being submitted more than once.
     */
    const submittedTeamIds = new Set();

    for (const submittedTeam of submittedTeams) {
      const teamId = Number(submittedTeam?.teamId);

      if (
        !Number.isInteger(teamId) ||
        !permittedTeamIds.has(teamId)
      ) {
        return NextResponse.json(
          {
            error:
              "A submitted team is not playing in this match.",
          },
          {
            status: 400,
          }
        );
      }

      if (submittedTeamIds.has(teamId)) {
        return NextResponse.json(
          {
            error:
              "The same team was submitted more than once.",
          },
          {
            status: 400,
          }
        );
      }

      submittedTeamIds.add(teamId);

      const submittedPlayers = Array.isArray(
        submittedTeam?.players
      )
        ? submittedTeam.players
        : [];

      for (
        let index = 0;
        index < submittedPlayers.length;
        index += 1
      ) {
        const player = submittedPlayers[index];

        /*
         * Excluded players should not be saved as eligible
         * match players.
         *
         * This supports either:
         * included: false
         * or:
         * isEligible: false
         */
        if (
          player?.included === false ||
          player?.isEligible === false
        ) {
          continue;
        }

        const displayName = String(
          player?.displayName || ""
        ).trim();

        const normalizedName =
          normalizeKitPlayerName(displayName);

        if (!normalizedName) {
          continue;
        }

        rows.push({
          leagueId: match.leagueId,
          matchId: match.id,
          teamId,

          playerId: optionalPositiveInteger(
            player?.playerId
          ),

          displayName,
          normalizedName,

          whatsappNumber:
            cleanWhatsAppNumber(
              player?.whatsappNumber
            ),

          whatsappOptIn: Boolean(
            player?.whatsappOptIn
          ),

          source:
  sourceMode === "TEAM_ROSTER"
    ? "TEAM_ROSTER"
    : "SCREENSHOT",
          isConfirmed: true,
          isEligible: true,
          sortOrder: index,
        });
      }
    }

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No eligible player names were submitted.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Confirm that each playing team has at least one player.
     */

const teamAPlayerCount = rows.filter(
  (row) =>
    Number(row.teamId) ===
    Number(match.teamAId)
).length;

const teamBPlayerCount = rows.filter(
  (row) =>
    Number(row.teamId) ===
    Number(match.teamBId)
).length;

if (sourceMode === "SCREENSHOT") {
  if (teamAPlayerCount === 0) {
    return NextResponse.json(
      {
        error: `Add at least one eligible player for ${match.teamA.name}.`,
      },
      { status: 400 }
    );
  }

  if (teamBPlayerCount === 0) {
    return NextResponse.json(
      {
        error: `Add at least one eligible player for ${match.teamB.name}.`,
      },
      { status: 400 }
    );
  }
}

    /*
     * Prevent duplicate names inside the same team.
     *
     * This avoids failing later on:
     * @@unique([matchId, teamId, normalizedName])
     */
    const namesSeenByTeam = new Set();

    for (const row of rows) {
      const teamNameKey =
        `${row.teamId}:${row.normalizedName}`;

      if (namesSeenByTeam.has(teamNameKey)) {
        return NextResponse.json(
          {
            error:
              `${row.displayName} appears more than once ` +
              "under the same team.",
          },
          {
            status: 400,
          }
        );
      }

      namesSeenByTeam.add(teamNameKey);
    }

    /*
     * Prevent one person from appearing under both
     * Surprise 1 and Surprise 2 in the same match.
     */
    const teamANames = new Set(
      rows
        .filter(
          (row) =>
            Number(row.teamId) ===
            Number(match.teamAId)
        )
        .map((row) => row.normalizedName)
    );

    const duplicateAcrossTeams = rows.find(
      (row) =>
        Number(row.teamId) ===
          Number(match.teamBId) &&
        teamANames.has(row.normalizedName)
    );

    if (duplicateAcrossTeams) {
      return NextResponse.json(
        {
          error:
            `${duplicateAcrossTeams.displayName} appears under both teams. ` +
            "Each person must appear under only one team for this match.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Everything below runs inside one transaction.
     *
     * If either MatchKitPlayer saving or KitRotationMember
     * synchronization fails, nothing is partially saved.
     */
    const transactionResult =
      await prisma.$transaction(async (tx) => {
        /*
         * Replace the previously confirmed screenshot list
         * for this match.
         */
 if (sourceMode === "TEAM_ROSTER") {
  await tx.matchKitPlayer.deleteMany({
    where: {
      matchId,
      teamId: {
        in: submittedTeams.map((team) =>
          Number(team.teamId)
        ),
      },
    },
  });
} else {
  await tx.matchKitPlayer.deleteMany({
    where: {
      matchId,
    },
  });
}

        /*
         * Save this match's confirmed team lists.
         */
        await tx.matchKitPlayer.createMany({
          data: rows,
        });

        /*
         * Synchronize every person into the correct
         * kit-rotation scope.
         */
        for (const row of rows) {
          const rotationKey =
            getKitRotationKey({
              leagueId: row.leagueId,
              teamId: row.teamId,
              rotationMode:
                match.league.kitRotationMode,
            });

          await tx.kitRotationMember.upsert({
            where: {
              rotationKey_normalizedName: {
                rotationKey,
                normalizedName:
                  row.normalizedName,
              },
            },

            update: {
              displayName:
                row.displayName,

              /*
               * Preserve the existing player link when the
               * newly submitted row has no playerId.
               */
              ...(row.playerId
                ? {
                    playerId: row.playerId,
                  }
                : {}),

              /*
               * Preserve an existing number when this form
               * submits no number.
               */
              ...(row.whatsappNumber
                ? {
                    whatsappNumber:
                      row.whatsappNumber,
                  }
                : {}),

              whatsappOptIn:
                row.whatsappOptIn,

              isActive: true,
            },

            create: {
              leagueId:
                row.leagueId,

              rotationKey,

              /*
               * Standard league:
               * history belongs to the team.
               *
               * Surprise Cricket League:
               * history belongs to the league-level person,
               * so teamId must be null.
               */
              teamId:
                match.league
                  .kitRotationMode === "TEAM"
                  ? row.teamId
                  : null,

              playerId:
                row.playerId,

              displayName:
                row.displayName,

              normalizedName:
                row.normalizedName,

              whatsappNumber:
                row.whatsappNumber,

              whatsappOptIn:
                row.whatsappOptIn,

              isActive: true,
            },
          });
        }

        const savedPlayers =
          await tx.matchKitPlayer.findMany({
            where: {
              matchId,
            },

            orderBy: [
              {
                teamId: "asc",
              },
              {
                sortOrder: "asc",
              },
            ],

            select: {
              id: true,
              matchId: true,
              leagueId: true,
              teamId: true,
              playerId: true,
              displayName: true,
              normalizedName: true,
              whatsappNumber: true,
              whatsappOptIn: true,
              isConfirmed: true,
              isEligible: true,
              sortOrder: true,
            },
          });

        return {
          savedPlayers,
        };
      });

    return NextResponse.json({
      success: true,

      message:
  sourceMode === "TEAM_ROSTER"
    ? "Team roster saved successfully."
    : "The playing-team lists were saved successfully.",

      match: {
        id: match.id,
        leagueId: match.leagueId,
        leagueName: match.league.name,
        kitRotationMode:
          match.league.kitRotationMode,

        teamA: {
          id: match.teamA.id,
          name: match.teamA.name,
          playerCount:
            teamAPlayerCount,
        },

        teamB: {
          id: match.teamB.id,
          name: match.teamB.name,
          playerCount:
            teamBPlayerCount,
        },
      },

      savedCount:
        transactionResult.savedPlayers.length,

      players:
        transactionResult.savedPlayers,
    });
  } catch (error) {
    console.error(
      "Unable to save kit players:",
      error
    );

    /*
     * Prisma duplicate constraint error.
     */
    if (error?.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "A duplicate player name was detected. Each player may appear only once under a team.",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to save the playing-team lists.",
      },
      {
        status: 500,
      }
    );
  }
}