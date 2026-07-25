import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

function normalizeWhatsAppNumber(
  value
) {
  const rawValue =
    String(value || "").trim();

  if (!rawValue) {
    return null;
  }

  const normalized =
    `+${rawValue.replace(/\D/g, "")}`;

  if (
    !/^\+[1-9]\d{7,14}$/.test(
      normalized
    )
  ) {
    throw new Error(
      "WhatsApp number must include a valid country code, for example +16025551234."
    );
  }

  return normalized;
}

export async function PATCH(
  request,
  { params }
) {
  try {
    const { id } = await params;
    const leagueId = Number(id);

    if (
      !Number.isInteger(leagueId) ||
      leagueId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid league ID.",
        },
        {
          status: 400,
        }
      );
    }

    const session =
      await getServerSession(
        authOptions
      );

    if (!session?.user?.email) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    let ownerWhatsAppNumber;

    try {
      ownerWhatsAppNumber =
        normalizeWhatsAppNumber(
          body.ownerWhatsAppNumber
        );
    } catch (validationError) {
      return NextResponse.json(
        {
          error:
            validationError instanceof Error
              ? validationError.message
              : "Invalid WhatsApp number.",
        },
        {
          status: 400,
        }
      );
    }

    const whatsappNotificationsEnabled =
      Boolean(
        body.whatsappNotificationsEnabled
      );

    if (
      whatsappNotificationsEnabled &&
      !ownerWhatsAppNumber
    ) {
      return NextResponse.json(
        {
          error:
            "Enter the owner's WhatsApp number before enabling automatic WhatsApp reminders.",
        },
        {
          status: 400,
        }
      );
    }

    const user =
      await prisma.user.findUnique({
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
            "User account not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Confirm the user has permission.
     *
     * Adjust `leagueMember`, `role`, or the
     * relation name only if your schema uses
     * different names.
     */
    const membership =
      await prisma.leagueMember.findFirst({
        where: {
          leagueId,
          userId: user.id,
          role: {
            in: [
              "OWNER",
              "ADMIN",
            ],
          },
        },

        select: {
          id: true,
          role: true,
        },
      });

    if (!membership) {
      return NextResponse.json(
        {
          error:
            "Only a league owner or administrator can update WhatsApp settings.",
        },
        {
          status: 403,
        }
      );
    }

    const updatedLeague =
      await prisma.league.update({
        where: {
          id: leagueId,
        },

        data: {
          ownerWhatsAppNumber,
          whatsappNotificationsEnabled,
        },

        select: {
          id: true,
          name: true,
          ownerWhatsAppNumber: true,
          whatsappNotificationsEnabled:
            true,
        },
      });

    return NextResponse.json({
      success: true,

      message:
        "WhatsApp birthday settings saved successfully.",

      league:
        updatedLeague,
    });
  } catch (error) {
    console.error(
      "League WhatsApp settings error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to save WhatsApp settings.",
      },
      {
        status: 500,
      }
    );
  }
}