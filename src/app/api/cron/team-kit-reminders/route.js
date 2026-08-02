import { NextResponse } from "next/server";

import {
  runTeamKitReminders,
} from "@/lib/kit/team-kit-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request) {
  const expected =
    process.env.CRON_SECRET;

  if (!expected) {
    return (
      process.env.NODE_ENV !==
      "production"
    );
  }

  const authorization =
    request.headers.get(
      "authorization"
    );

  return (
    authorization ===
    `Bearer ${expected}`
  );
}

async function handler(request) {
  if (!authorized(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }

  const enabled =
    String(
      process.env
        .TEAM_KIT_REMINDERS_ENABLED ||
        "false"
    ).toLowerCase() === "true";

  if (!enabled) {
    return NextResponse.json({
      success: true,
      enabled: false,
      message:
        "Team-kit reminders are disabled.",
    });
  }

  const url = new URL(request.url);
  const dryRun =
    url.searchParams.get("dryRun") ===
    "1";

  try {
    const summary =
      await runTeamKitReminders({
        dryRun,
      });

    return NextResponse.json({
      success: true,
      enabled: true,
      dryRun,
      summary,
    });
  } catch (error) {
    console.error(
      "Team-kit reminder cron failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        enabled: true,
        error:
          error?.message ||
          "Team-kit reminder cron failed.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function GET(request) {
  return handler(request);
}

export async function POST(request) {
  return handler(request);
}
