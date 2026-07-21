import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireBirthdayManager } from "@/lib/leagueBirthdayAccess";
import { validateBirthdayInput } from "@/lib/birthdayValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveAccess(session, params) {
  const {
    leagueId: leagueIdParam,
    birthdayId: birthdayIdParam,
  } = await params;

  const leagueId = Number(leagueIdParam);
  const birthdayId = Number(birthdayIdParam);

  const access = await requireBirthdayManager({
    userId: session?.user?.id,
    leagueId,
  });

  return {
    leagueId,
    birthdayId,
    access,
  };
}

export async function PATCH(request, { params }) {
  try {
    const { id, birthdayId: birthdayIdParam } = await params;

    const leagueId = Number(id);
    const birthdayId = Number(birthdayIdParam);

    console.log("Birthday PATCH route params:", {
      id,
      birthdayIdParam,
      leagueId,
      birthdayId,
    });

    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      return NextResponse.json(
        { error: "Invalid league ID." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(birthdayId) || birthdayId <= 0) {
      return NextResponse.json(
        { error: "Invalid birthday ID." },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const existingBirthday =
      await prisma.leagueBirthday.findFirst({
        where: {
          id: birthdayId,
          leagueId,
        },
        select: {
          id: true,
          playerId: true,
          name: true,
          birthMonth: true,
          birthDay: true,
          notes: true,
          isActive: true,
        },
      });

    if (!existingBirthday) {
      return NextResponse.json(
        { error: "Birthday entry not found." },
        { status: 404 }
      );
    }

    const body = await request.json();
const whatsappNumber =
  typeof body.whatsappNumber === "string"
    ? body.whatsappNumber.replace(/\D/g, "")
    : "";

const whatsappOptIn =
  body.whatsappOptIn === true;

  if (
  whatsappOptIn &&
  (whatsappNumber.length < 10 ||
    whatsappNumber.length > 15)
) {
  return NextResponse.json(
    {
      error:
        "Enter a valid WhatsApp number with country code.",
    },
    { status: 400 }
  );
}
    /*
     * Status-only PATCH used by Enable/Disable.
     */
    if (
      typeof body.isActive === "boolean" &&
      body.playerId === undefined &&
      body.birthMonth === undefined &&
      body.birthDay === undefined
    ) {
      const updatedBirthday =
        await prisma.leagueBirthday.update({
          where: {
            id: birthdayId,
          },
          data: {
            isActive: body.isActive,
          },
        });

      return NextResponse.json({
        message: body.isActive
          ? "Birthday enabled successfully."
          : "Birthday disabled successfully.",
        birthday: updatedBirthday,
      });
    }

    /*
     * Full birthday edit.
     */
    const playerId = Number(body.playerId);
    const birthMonth = Number(body.birthMonth);
    const birthDay = Number(body.birthDay);

    const notes =
      typeof body.notes === "string"
        ? body.notes.trim()
        : "";

    if (!Number.isInteger(playerId) || playerId <= 0) {
      return NextResponse.json(
        { error: "Please select a valid player." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(birthMonth) ||
      birthMonth < 1 ||
      birthMonth > 12
    ) {
      return NextResponse.json(
        { error: "Please select a valid birth month." },
        { status: 400 }
      );
    }

    const daysByMonth = {
      1: 31,
      2: 29,
      3: 31,
      4: 30,
      5: 31,
      6: 30,
      7: 31,
      8: 31,
      9: 30,
      10: 31,
      11: 30,
      12: 31,
    };

    if (
      !Number.isInteger(birthDay) ||
      birthDay < 1 ||
      birthDay > daysByMonth[birthMonth]
    ) {
      return NextResponse.json(
        { error: "Please select a valid birth day." },
        { status: 400 }
      );
    }

    /*
     * Confirm that the selected player belongs to this league.
     * This supports players that may appear on multiple teams.
     */
    const teams = await prisma.team.findMany({
      where: {
        leagueId,
        players: {
          some: {
            id: playerId,
          },
        },
      },
      select: {
        players: {
          where: {
            id: playerId,
          },
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const player = teams
      .flatMap((team) => team.players)
      .find(
        (currentPlayer) =>
          Number(currentPlayer.id) === playerId
      );

    if (!player) {
      return NextResponse.json(
        {
          error:
            "The selected player does not belong to this league.",
        },
        { status: 400 }
      );
    }

    /*
     * Prevent another birthday record for the same player.
     * Exclude the record currently being edited.
     */
    const duplicateBirthday =
      await prisma.leagueBirthday.findFirst({
        where: {
          leagueId,
          playerId,
          id: {
            not: birthdayId,
          },
        },
        select: {
          id: true,
        },
      });

    if (duplicateBirthday) {
      return NextResponse.json(
        {
          error:
            "A birthday entry already exists for this player.",
        },
        { status: 409 }
      );
    }

    const updatedBirthday =
      await prisma.leagueBirthday.update({
        where: {
          id: birthdayId,
        },
        data: {
          player: {
            connect: {
              id: player.id,
            },
          },
          name: player.name,
          birthMonth,
          birthDay,
          notes: notes || null,
        },
      });

    return NextResponse.json({
      message: "Birthday updated successfully.",
      birthday: updatedBirthday,
    });
  } catch (error) {
    console.error("PATCH birthday error:", error);

    return NextResponse.json(
      { error: "Unable to update birthday." },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id, birthdayId: birthdayIdParam } = await params;

    const leagueId = Number(id);
    const birthdayId = Number(birthdayIdParam);

    console.log("Birthday DELETE route params:", {
      id,
      birthdayIdParam,
      leagueId,
      birthdayId,
    });

    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      return NextResponse.json(
        { error: "Invalid league ID." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(birthdayId) || birthdayId <= 0) {
      return NextResponse.json(
        { error: "Invalid birthday ID." },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const birthday =
      await prisma.leagueBirthday.findFirst({
        where: {
          id: birthdayId,
          leagueId,
        },
        select: {
          id: true,
        },
      });

    if (!birthday) {
      return NextResponse.json(
        { error: "Birthday entry not found." },
        { status: 404 }
      );
    }

    await prisma.leagueBirthday.delete({
      where: {
        id: birthdayId,
      },
    });

    return NextResponse.json({
      message: "Birthday deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE birthday error:", error);

    return NextResponse.json(
      { error: "Unable to delete birthday." },
      { status: 500 }
    );
  }
}