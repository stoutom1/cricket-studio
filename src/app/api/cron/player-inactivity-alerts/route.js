import { NextResponse } from "next/server";

import {
  processPlayerInactivityAlerts,
} from "@/lib/player-inactivity-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(
  request
) {
  const secret =
    String(
      process.env
        .CRON_SECRET ||
        ""
    ).trim();

  if (!secret) {
    return false;
  }

  return (
    request.headers.get(
      "authorization"
    ) ===
    `Bearer ${secret}`
  );
}

export async function GET(
  request
) {
  if (
    !isAuthorized(
      request
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Unauthorized.",
      },
      {
        status:
          401,
      }
    );
  }

  try {
    const summary =
      await processPlayerInactivityAlerts();

    return NextResponse.json({
      success:
        true,
      summary,
    });
  } catch (error) {
    console.error(
      "[PLAYER_INACTIVITY_CRON_FAILED]",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to process player inactivity alerts.",
      },
      {
        status:
          500,
      }
    );
  }
}
