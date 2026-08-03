import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import {
  runTeamKitReminders,
} from "@/lib/kit/team-kit-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeEqual(leftValue, rightValue) {
  const left = Buffer.from(
    String(leftValue || ""),
    "utf8"
  );

  const right = Buffer.from(
    String(rightValue || ""),
    "utf8"
  );

  if (
    left.length === 0 ||
    right.length === 0 ||
    left.length !== right.length
  ) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function suppliedSecret(request) {
  const authorization =
    request.headers.get(
      "authorization"
    ) || "";

  if (
    authorization
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return authorization
      .slice(7)
      .trim();
  }

  /*
   * cron-job.org supports arbitrary custom headers.
   * This fallback is useful if Authorization is unavailable
   * in a particular UI/configuration.
   */
  return (
    request.headers.get(
      "x-cron-secret"
    ) || ""
  ).trim();
}

function authorized(request) {
  const expected =
    String(
      process.env.CRON_SECRET || ""
    ).trim();

  if (!expected) {
    /*
     * Permit local development only when CRON_SECRET is absent.
     * Production must always configure CRON_SECRET.
     */
    return (
      process.env.NODE_ENV !==
      "production"
    );
  }

  return safeEqual(
    suppliedSecret(request),
    expected
  );
}

function noStore(response) {
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate"
  );
  response.headers.set(
    "Pragma",
    "no-cache"
  );

  return response;
}

async function handler(request) {
  if (!authorized(request)) {
    return noStore(
      NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      )
    );
  }

  const enabled =
    String(
      process.env
        .TEAM_KIT_REMINDERS_ENABLED ||
        "false"
    ).toLowerCase() === "true";

  if (!enabled) {
    return noStore(
      NextResponse.json({
        success: true,
        enabled: false,
        message:
          "Team-kit reminders are disabled.",
      })
    );
  }

  const url =
    new URL(request.url);

  const dryRun =
    url.searchParams.get("dryRun") ===
    "1";

  const startedAt =
    new Date();

  try {
    const summary =
      await runTeamKitReminders({
        dryRun,
        now: startedAt,
      });

    return noStore(
      NextResponse.json({
        success: true,
        enabled: true,
        dryRun,
        source:
          request.headers.get(
            "x-cron-source"
          ) || "scheduled-request",
        startedAt:
          startedAt.toISOString(),
        completedAt:
          new Date().toISOString(),
        summary,
      })
    );
  } catch (error) {
    console.error(
      "Team-kit reminder cron failed:",
      error
    );

    return noStore(
      NextResponse.json(
        {
          success: false,
          enabled: true,
          dryRun,
          startedAt:
            startedAt.toISOString(),
          completedAt:
            new Date().toISOString(),
          error:
            error?.message ||
            "Team-kit reminder cron failed.",
        },
        {
          status: 500,
        }
      )
    );
  }
}

/*
 * cron-job.org can call either GET or POST.
 * The recommended configuration in the README uses GET.
 */
export async function GET(request) {
  return handler(request);
}

export async function POST(request) {
  return handler(request);
}
