import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { DateTime } from "luxon";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireBirthdayManager } from "@/lib/leagueBirthdayAccess";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    const {
      leagueId: rawLeagueId,
      birthdayId: rawBirthdayId,
    } = await params;

    const leagueId = Number(rawLeagueId);
    const birthdayId = Number(rawBirthdayId);

    const access = await requireBirthdayManager({
      userId: session?.user?.id,
      leagueId,
    });

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const preference =
      await prisma.birthdayNotificationPreference.findUnique({
        where: {
          userId_leagueId: {
            userId: session.user.id,
            leagueId,
          },
        },
        select: {
          timeZone: true,
        },
      });

    const localNow = DateTime.now().setZone(
      preference?.timeZone ?? "America/Los_Angeles"
    );

    const birthday = await prisma.leagueBirthday.findFirst({
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
        { error: "Birthday not found." },
        { status: 404 }
      );
    }

    await prisma.birthdayReminderLog.updateMany({
      where: {
        birthdayId,
        leagueId,
        birthdayYear: localNow.year,
        reminderType: "BIRTHDAY_TODAY",
      },
      data: {
        status: "SHARED",
        sharedAt: new Date(),
        sharedById: session.user.id,
      },
    });

    return NextResponse.json({
      message: "Birthday wish marked as shared.",
    });
  } catch (error) {
    console.error("Mark birthday shared failed:", error);

    return NextResponse.json(
      { error: "Unable to record the birthday share." },
      { status: 500 }
    );
  }
}