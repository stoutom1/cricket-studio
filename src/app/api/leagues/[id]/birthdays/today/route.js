import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { DateTime } from "luxon";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireBirthdayManager } from "@/lib/leagueBirthdayAccess";
import { birthdayWhereForDate } from "@/lib/birthdayDates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId: rawLeagueId } = await params;
    const leagueId = Number(rawLeagueId);

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

    const timeZone =
      preference?.timeZone ?? "America/Los_Angeles";

    const localToday = DateTime.now().setZone(timeZone);

    const birthdays = await prisma.leagueBirthday.findMany({
      where: {
        leagueId,
        isActive: true,
        ...birthdayWhereForDate(
          localToday.month,
          localToday.day,
          localToday.year
        ),
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        birthMonth: true,
        birthDay: true,
      },
    });

    const league = await prisma.league.findUnique({
      where: {
        id: leagueId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json({
      league,
      birthdays,
      date: localToday.toISODate(),
      timeZone,
    });
  } catch (error) {
    console.error("GET today's birthdays failed:", error);

    return NextResponse.json(
      { error: "Unable to load today's birthdays." },
      { status: 500 }
    );
  }
}