import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireBirthdayManager } from "@/lib/leagueBirthdayAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TIME_ZONES = new Set([
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Asia/Kolkata",
  "Europe/London",
  "Australia/Sydney",
]);

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
      await prisma.birthdayNotificationPreference.upsert({
        where: {
          userId_leagueId: {
            userId: session.user.id,
            leagueId,
          },
        },
        create: {
          userId: session.user.id,
          leagueId,
        },
        update: {},
      });

    return NextResponse.json({ preference });
  } catch (error) {
    console.error("GET birthday preferences failed:", error);

    return NextResponse.json(
      { error: "Unable to load birthday notification settings." },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
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

    const body = await request.json();
    const reminderHour = Number(body.reminderHour);
    const timeZone = String(body.timeZone ?? "");

    if (
      !Number.isInteger(reminderHour) ||
      reminderHour < 0 ||
      reminderHour > 23
    ) {
      return NextResponse.json(
        { error: "Reminder hour must be between 0 and 23." },
        { status: 400 }
      );
    }

    if (!VALID_TIME_ZONES.has(timeZone)) {
      return NextResponse.json(
        { error: "Select a supported timezone." },
        { status: 400 }
      );
    }

    const preference =
      await prisma.birthdayNotificationPreference.upsert({
        where: {
          userId_leagueId: {
            userId: session.user.id,
            leagueId,
          },
        },
        create: {
          userId: session.user.id,
          leagueId,
          enabled: Boolean(body.enabled),
          notifyDayBefore: Boolean(body.notifyDayBefore),
          notifyOnBirthday: Boolean(body.notifyOnBirthday),
          reminderHour,
          timeZone,
          emailFallbackEnabled: Boolean(
            body.emailFallbackEnabled
          ),
        },
        update: {
          enabled: Boolean(body.enabled),
          notifyDayBefore: Boolean(body.notifyDayBefore),
          notifyOnBirthday: Boolean(body.notifyOnBirthday),
          reminderHour,
          timeZone,
          emailFallbackEnabled: Boolean(
            body.emailFallbackEnabled
          ),
        },
      });

    return NextResponse.json({
      message: "Notification settings saved.",
      preference,
    });
  } catch (error) {
    console.error("PATCH birthday preferences failed:", error);

    return NextResponse.json(
      { error: "Unable to save birthday notification settings." },
      { status: 500 }
    );
  }
}