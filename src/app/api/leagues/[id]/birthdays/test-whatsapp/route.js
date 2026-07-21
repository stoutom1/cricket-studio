import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { sendWhatsAppBirthdayMessage } from "@/lib/whatsapp";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const leagueId = Number(id);

    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      return NextResponse.json(
        { error: "Invalid league ID." },
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

    const body = await request.json();
    const birthdayId = Number(body.birthdayId);

    if (
      !Number.isInteger(birthdayId) ||
      birthdayId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid birthday ID." },
        { status: 400 }
      );
    }

    const recipientPhone =
      typeof body.recipientPhone === "string" &&
      body.recipientPhone.trim()
        ? body.recipientPhone.trim()
        : process.env.WHATSAPP_TEST_RECIPIENT;

    if (!recipientPhone) {
      return NextResponse.json(
        {
          error:
            "Enter a test WhatsApp number or configure WHATSAPP_TEST_RECIPIENT.",
        },
        { status: 400 }
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
        { error: "Birthday entry not found." },
        { status: 404 }
      );
    }

    if (!birthday.isActive) {
      return NextResponse.json(
        {
          error:
            "This birthday entry is disabled. Enable it before testing.",
        },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppBirthdayMessage({
      recipientPhone,
      playerName: birthday.name,
      leagueName: birthday.league.name,
    });

    return NextResponse.json({
      message: `Test birthday message sent to ${result.recipient}.`,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error(
      "Test WhatsApp birthday error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to send the test WhatsApp message.",
      },
      { status: 500 }
    );
  }
}