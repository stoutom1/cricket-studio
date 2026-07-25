import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

import {
  sendTwilioWhatsAppBirthdayMessage,
} from "@/lib/sendTwilioWhatsAppBirthdayMessage";

export const runtime = "nodejs";

export async function POST(
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
          error: "Invalid league ID.",
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

    const user =
      await prisma.user.findUnique({
        where: {
          email: session.user.email,
        },
        select: {
          id: true,
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          error: "User account not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Replace leagueMember with your actual
     * Prisma membership model if different.
     */
const leagueAccess =
  await prisma.league.findUnique({
    where: {
      id: leagueId,
    },

    select: {
      id: true,
      ownerId: true,

      members: {
        where: {
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

        take: 1,
      },
    },
  });

if (!leagueAccess) {
  return NextResponse.json(
    {
      error: "League not found.",
    },
    {
      status: 404,
    }
  );
}

const isDirectOwner =
  leagueAccess.ownerId === user.id;

const isOwnerOrAdminMember =
  leagueAccess.members.length > 0;

if (
  !isDirectOwner &&
  !isOwnerOrAdminMember
) {
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

    const body =
      await request.json();

    const birthdayId =
      Number(body.birthdayId);

    if (
      !Number.isInteger(birthdayId) ||
      birthdayId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid birthday ID.",
        },
        {
          status: 400,
        }
      );
    }

    const recipientPhone =
      typeof body.recipientPhone ===
        "string" &&
      body.recipientPhone.trim()
        ? body.recipientPhone.trim()
        : process.env
            .WHATSAPP_TEST_RECIPIENT;

    if (!recipientPhone) {
      return NextResponse.json(
        {
          error:
            "Enter a test WhatsApp number or configure WHATSAPP_TEST_RECIPIENT.",
        },
        {
          status: 400,
        }
      );
    }

    const birthday =
      await prisma.leagueBirthday
        .findFirst({
          where: {
            id: birthdayId,
            leagueId,
          },
          select: {
            id: true,
            name: true,
            isActive: true,
            league: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

    if (!birthday) {
      return NextResponse.json(
        {
          error:
            "Birthday entry not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (!birthday.isActive) {
      return NextResponse.json(
        {
          error:
            "This birthday entry is disabled. Enable it before testing.",
        },
        {
          status: 400,
        }
      );
    }

    const result =
      await sendTwilioWhatsAppBirthdayMessage({
        recipientPhone,
        playerName:
          birthday.name,
        leagueName:
          birthday.league.name,
      });

    return NextResponse.json({
      success: true,
      message:
        "Test birthday WhatsApp message has been queued.",
      messageSid:
        result.messageSid,
      status:
        result.status,
      recipient:
        result.recipient,
    });
  } catch (error) {
    console.error(
      "Test Twilio WhatsApp birthday error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to send the test WhatsApp message.",
      },
      {
        status: 500,
      }
    );
  }
}