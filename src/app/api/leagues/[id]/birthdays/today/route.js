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

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "You must be logged in.",
        },
        {
          status: 401,
        }
      );
    }

    const resolvedParams = await params;

    console.log(
      "Birthday today API params:",
      resolvedParams
    );

    /*
     * Supports either:
     * app/api/leagues/[id]/birthdays/today
     * or
     * app/api/leagues/[leagueId]/birthdays/today
     */
    const rawLeagueId =
      resolvedParams?.leagueId ??
      resolvedParams?.id ??
      Object.values(resolvedParams ?? {})[0];

    const leagueId = Number(rawLeagueId);

    console.log(
      "Birthday today API league ID:",
      {
        rawLeagueId,
        leagueId,
      }
    );

    if (
      !Number.isInteger(leagueId) ||
      leagueId <= 0
    ) {
      return NextResponse.json(
        {
          error: "Invalid league ID.",
          received: rawLeagueId ?? null,
        },
        {
          status: 400,
        }
      );
    }

    const access =
      await requireBirthdayManager({
        userId: session.user.id,
        leagueId,
      });

    if (!access.allowed) {
      return NextResponse.json(
        {
          error:
            access.error ||
            "You do not have permission to view birthdays.",
        },
        {
          status: access.status || 403,
        }
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
      preference?.timeZone ??
      "America/Los_Angeles";

    const localToday =
      DateTime.now().setZone(timeZone);

    if (!localToday.isValid) {
      return NextResponse.json(
        {
          error:
            "The configured birthday time zone is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    const birthdays =
      await prisma.leagueBirthday.findMany({
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

    const league =
      await prisma.league.findUnique({
        where: {
          id: leagueId,
        },

        select: {
          id: true,
          name: true,
        },
      });

    if (!league) {
      return NextResponse.json(
        {
          error: "League not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,
      league,
      birthdays,
      date: localToday.toISODate(),
      timeZone,
    });
  } catch (error) {
    console.error(
      "GET today's birthdays failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load today's birthdays.",
      },
      {
        status: 500,
      }
    );
  }
}