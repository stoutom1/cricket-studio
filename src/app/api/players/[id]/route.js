import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

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

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const playerId = Number(id);
  if (!id) {
    return NextResponse.json({ error: "Invalid player id" }, { status: 400 });
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId }
  });

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const ballUsageCount = await prisma.ball.count({
    where: {
      OR: [
        { strikerId: playerId },
        { nonStrikerId: playerId },
        { bowlerId: playerId },
        { dismissedPlayerId: playerId },
        { newBatterId: playerId }
      ]
    }
  });

  if (ballUsageCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete player because the player is used in match scoring data. Delete related matches first." },
      { status: 400 }
    );
  }

  const team = await prisma.team.findUnique({
    where: { id: player.teamId }
  });
  const league = await prisma.league.findUnique({
    where: { id: team?.leagueId }
  });
  await prisma.player.delete({
    where: { id: playerId }
  });
  await logAudit({
    action: "PLAYER_DELETED",
    entityType: "PLAYER",
    entityId: playerId,
    leagueId: team?.leagueId || null,
    teamId: team?.id || null,
    playerId,
    actor: session?.user,
    description: `Player "${player.name}" was deleted from team "${team?.name || "Unknown Team"}"
    within league "${league?.name || "Unknown League"}".`,
    beforeData: player,
    afterData: null,
    request,
  });
  return NextResponse.json({
    success: true,
    message: "Player deleted successfully"
  });
}