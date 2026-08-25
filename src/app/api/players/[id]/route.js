import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isSuperAdmin } from "@/lib/superAdmin";
import { PLAYER_ROSTER_ARCHIVED_ACTION } from "@/lib/player-roster-archive";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  try {
    const session =
      await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const { id } = await params;
    const playerId = Number(id);

    if (
      !Number.isInteger(playerId) ||
      playerId <= 0
    ) {
      return NextResponse.json(
        {
          error: "Invalid player id",
        },
        {
          status: 400,
        }
      );
    }

    const body = await request.json();

    const beforePlayer =
      await prisma.player.findUnique({
        where: {
          id: playerId,
        },

        include: {
          team: {
            include: {
              league: true,
            },
          },
        },
      });

    if (!beforePlayer) {
      return NextResponse.json(
        {
          error: "Player not found",
        },
        {
          status: 404,
        }
      );
    }

    const data = {};

    /*
     * Player name
     */
    if (typeof body.name === "string") {
      const name = body.name.trim();

      if (!name) {
        return NextResponse.json(
          {
            error:
              "Player name is required",
          },
          {
            status: 400,
          }
        );
      }

      data.name = name;
    }

    /*
     * Team transfer
     */
    if (
      body.teamId !== undefined &&
      body.teamId !== null &&
      body.teamId !== ""
    ) {
      const teamId = Number(body.teamId);

      if (
        !Number.isInteger(teamId) ||
        teamId <= 0
      ) {
        return NextResponse.json(
          {
            error: "Invalid team id",
          },
          {
            status: 400,
          }
        );
      }

      data.teamId = teamId;
    }

    /*
     * Only update WhatsApp number when the frontend
     * explicitly includes whatsappNumber.
     */
    const hasWhatsappNumber =
      Object.prototype.hasOwnProperty.call(
        body,
        "whatsappNumber"
      );

    if (hasWhatsappNumber) {
      data.whatsappNumber =
        typeof body.whatsappNumber ===
        "string"
          ? body.whatsappNumber.trim() ||
            null
          : null;
    }

    /*
     * Only update WhatsApp opt-in when the frontend
     * explicitly includes whatsappOptIn.
     *
     * This prevents requests that omit the field from
     * accidentally changing an existing true value to false.
     */
    const hasWhatsappOptIn =
      Object.prototype.hasOwnProperty.call(
        body,
        "whatsappOptIn"
      );

    if (hasWhatsappOptIn) {
      data.whatsappOptIn =
        body.whatsappOptIn === true;
    }

    const nextName =
      data.name !== undefined
        ? data.name
        : beforePlayer.name;

    const nextTeamId =
      data.teamId !== undefined
        ? Number(data.teamId)
        : Number(beforePlayer.teamId);

    const nextWhatsappNumber =
      hasWhatsappNumber
        ? data.whatsappNumber
        : beforePlayer.whatsappNumber ||
          null;

    const nextWhatsappOptIn =
      hasWhatsappOptIn
        ? Boolean(data.whatsappOptIn)
        : Boolean(
            beforePlayer.whatsappOptIn
          );

    const isNameChanged =
      nextName !== beforePlayer.name;

    const isTeamChanged =
      nextTeamId !==
      Number(beforePlayer.teamId);

    const isWhatsappNumberChanged =
      nextWhatsappNumber !==
      (beforePlayer.whatsappNumber ||
        null);

    const isWhatsappOptInChanged =
      nextWhatsappOptIn !==
      Boolean(
        beforePlayer.whatsappOptIn
      );

    /*
     * This is the only no-change return.
     * It checks name, team, phone number, and opt-in.
     */
    if (
      !isNameChanged &&
      !isTeamChanged &&
      !isWhatsappNumberChanged &&
      !isWhatsappOptInChanged
    ) {
      return NextResponse.json(
        beforePlayer
      );
    }

    const player =
      await prisma.player.update({
        where: {
          id: playerId,
        },

        data,

        include: {
          team: {
            include: {
              league: true,
            },
          },
        },
      });

    let action =
      "PLAYER_UPDATED";

    let description =
      `Player "${player.name}" was updated in team ` +
      `"${player.team?.name || "Unknown Team"}".`;

    if (
      isNameChanged &&
      isTeamChanged
    ) {
      action =
        "PLAYER_UPDATED_AND_TRANSFERRED";

      description =
        `Player "${beforePlayer.name}" was renamed to ` +
        `"${player.name}" and transferred from ` +
        `"${beforePlayer.team?.name || "Unknown Team"}" ` +
        `to "${player.team?.name || "Unknown Team"}".`;
    } else if (isTeamChanged) {
      action =
        "PLAYER_TRANSFERRED";

      description =
        `Player "${player.name}" was transferred from ` +
        `"${beforePlayer.team?.name || "Unknown Team"}" ` +
        `to "${player.team?.name || "Unknown Team"}".`;
    } else if (isNameChanged) {
      description =
        `Player "${beforePlayer.name}" was renamed to ` +
        `"${player.name}" in team ` +
        `"${player.team?.name || "Unknown Team"}".`;
    } else if (
      isWhatsappNumberChanged ||
      isWhatsappOptInChanged
    ) {
      action =
        "PLAYER_NOTIFICATION_PREFERENCES_UPDATED";

      description =
        `WhatsApp preferences were updated for player ` +
        `"${player.name}" in team ` +
        `"${player.team?.name || "Unknown Team"}".`;
    }

    await logAudit({
      action,
      entityType: "PLAYER",
      entityId: playerId,

      leagueId:
        player.team?.leagueId ||
        beforePlayer.team?.leagueId ||
        null,

      teamId:
        player.teamId ||
        beforePlayer.teamId ||
        null,

      playerId,

      actor: session.user,

      description,

      beforeData: {
        id: beforePlayer.id,
        name: beforePlayer.name,
        teamId: beforePlayer.teamId,

        teamName:
          beforePlayer.team?.name ||
          null,

        leagueId:
          beforePlayer.team?.leagueId ||
          null,

        leagueName:
          beforePlayer.team?.league
            ?.name || null,

        whatsappNumber:
          beforePlayer.whatsappNumber,

        whatsappOptIn:
          beforePlayer.whatsappOptIn,
      },

      afterData: {
        id: player.id,
        name: player.name,
        teamId: player.teamId,

        teamName:
          player.team?.name || null,

        leagueId:
          player.team?.leagueId ||
          null,

        leagueName:
          player.team?.league?.name ||
          null,

        whatsappNumber:
          player.whatsappNumber,

        whatsappOptIn:
          player.whatsappOptIn,
      },

      request,
    });

    return NextResponse.json(player);
  } catch (error) {
    console.error(
      "[PLAYER_UPDATE_FAILED]",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to update player.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  request,
  { params }
) {
  try {
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
          status:
            401,
        }
      );
    }

    const { id } =
      await params;

    const playerId =
      Number(
        id
      );

    if (
      !Number.isInteger(
        playerId
      ) ||
      playerId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid player id",
        },
        {
          status:
            400,
        }
      );
    }

    const player =
      await prisma.player.findUnique({
        where: {
          id:
            playerId,
        },
        include: {
          team: {
            include: {
              league:
                true,
            },
          },
        },
      });

    if (!player) {
      return NextResponse.json(
        {
          error:
            "Player not found",
        },
        {
          status:
            404,
        }
      );
    }

    const league =
      player.team?.league ||
      null;

    const leagueId =
      Number(
        league?.id ||
        player.team?.leagueId ||
        0
      );

    if (
      !leagueId
    ) {
      return NextResponse.json(
        {
          error:
            "Player league could not be resolved.",
        },
        {
          status:
            400,
        }
      );
    }

    const currentUser =
      await prisma.user.findUnique({
        where: {
          email:
            session.user.email,
        },
        select: {
          id:
            true,
        },
      });

    if (!currentUser) {
      return NextResponse.json(
        {
          error:
            "User account not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const superAdmin =
      isSuperAdmin(
        session
      );

    const membership =
      await prisma.leagueMember.findUnique({
        where: {
          userId_leagueId: {
            userId:
              currentUser.id,
            leagueId,
          },
        },
        select: {
          role:
            true,
          canDeletePlayer:
            true,
        },
      });

    const isOwner =
      String(
        league?.ownerId ||
          ""
      ) ===
        String(
          currentUser.id
        ) ||
      String(
        membership?.role ||
          ""
      ).toUpperCase() ===
        "OWNER";

    const hasDeletePermission =
      membership?.canDeletePlayer ===
      true;

    if (
      !superAdmin &&
      !isOwner &&
      !hasDeletePermission
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to delete this player.",
        },
        {
          status:
            403,
        }
      );
    }

    /*
     * Owner / Super Admin deletion is deliberately implemented as a
     * roster archive. The Player row remains in the database so historical
     * balls, scorecards, player cards and career statistics keep their
     * original player identity.
     */
    if (
      superAdmin ||
      isOwner
    ) {
      const existingArchive =
        await prisma.auditLog.findFirst({
          where: {
            leagueId,
            action:
              PLAYER_ROSTER_ARCHIVED_ACTION,
            entityType:
              "PLAYER",
            playerId,
          },
          select: {
            id:
              true,
          },
        });

      if (
        !existingArchive
      ) {
        await logAudit({
          action:
            PLAYER_ROSTER_ARCHIVED_ACTION,
          entityType:
            "PLAYER",
          entityId:
            playerId,
          leagueId,
          teamId:
            player.teamId,
          playerId,
          actor:
            session.user,
          description:
            `Player "${player.name}" was removed from the active roster of team "${player.team?.name || "Unknown Team"}" while historical match data was preserved.`,
          beforeData: {
            id:
              player.id,
            name:
              player.name,
            teamId:
              player.teamId,
            teamName:
              player.team?.name ||
              null,
            leagueId,
            leagueName:
              league?.name ||
              null,
          },
          afterData: {
            rosterArchived:
              true,
            archivedPlayerId:
              playerId,
          },
          request,
        });
      }

      return NextResponse.json({
        success:
          true,
        archived:
          true,
        historicalDataPreserved:
          true,
        message:
          "Player removed from the active roster. Historical match data and statistics were preserved.",
      });
    }

    /*
     * Preserve the old physical-delete behavior for a non-owner member who
     * has explicit canDeletePlayer permission, but only when no historical
     * scoring or match-role references exist.
     */
    const [
      ballUsageCount,
      matchRoleUsageCount,
    ] =
      await Promise.all([
        prisma.ball.count({
          where: {
            OR: [
              {
                strikerId:
                  playerId,
              },
              {
                nonStrikerId:
                  playerId,
              },
              {
                bowlerId:
                  playerId,
              },
              {
                dismissedPlayerId:
                  playerId,
              },
              {
                newBatterId:
                  playerId,
              },
              {
                fielderId:
                  playerId,
              },
            ],
          },
        }),

        prisma.match.count({
          where: {
            OR: [
              {
                teamACaptainId:
                  playerId,
              },
              {
                teamBCaptainId:
                  playerId,
              },
              {
                teamAViceCaptainId:
                  playerId,
              },
              {
                teamBViceCaptainId:
                  playerId,
              },
              {
                teamAWicketKeeperId:
                  playerId,
              },
              {
                teamBWicketKeeperId:
                  playerId,
              },
            ],
          },
        }),
      ]);

    if (
      ballUsageCount > 0 ||
      matchRoleUsageCount > 0
    ) {
      return NextResponse.json(
        {
          error:
            "This player has historical match data. Only the league Owner or Cric4All Super Admin can remove the player while preserving that history.",
        },
        {
          status:
            409,
        }
      );
    }

    await prisma.player.delete({
      where: {
        id:
          playerId,
      },
    });

    await logAudit({
      action:
        "PLAYER_DELETED",
      entityType:
        "PLAYER",
      entityId:
        playerId,
      leagueId,
      teamId:
        player.teamId,
      playerId,
      actor:
        session.user,
      description:
        `Player "${player.name}" was permanently deleted from team "${player.team?.name || "Unknown Team"}" because no historical match references existed.`,
      beforeData: {
        id:
          player.id,
        name:
          player.name,
        teamId:
          player.teamId,
        teamName:
          player.team?.name ||
          null,
        leagueId,
        leagueName:
          league?.name ||
          null,
      },
      afterData:
        null,
      request,
    });

    return NextResponse.json({
      success:
        true,
      archived:
        false,
      message:
        "Player deleted successfully.",
    });
  } catch (error) {
    console.error(
      "[PLAYER_DELETE_FAILED]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete player.",
      },
      {
        status:
          500,
      }
    );
  }
}

