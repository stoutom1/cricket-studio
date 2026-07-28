import { NextResponse } from "next/server";
import {
  processDayBeforeKitReminders,
} from "@/lib/kit/process-kit-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request) {
  const cronSecret = String(
    process.env.CRON_SECRET || ""
  ).trim();

  if (!cronSecret) {
    return false;
  }

  const authorization =
    request.headers.get("authorization");

  return authorization ===
    `Bearer ${cronSecret}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  if (
    String(
      process.env.KIT_REMINDERS_ENABLED || ""
    ).toLowerCase() !== "true"
  ) {
    return NextResponse.json({
      success: true,
      enabled: false,
      message:
        "Kit reminders are currently disabled.",
    });
  }

  try {
    const summary =
      await processDayBeforeKitReminders();

    return NextResponse.json({
      success: true,
      enabled: true,
      summary,
    });
  } catch (error) {
    console.error(
      "Kit reminder cron failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Unable to process kit reminders.",
      },
      {
        status: 500,
      }
    );
  }
}