import { NextResponse } from "next/server";

import {
  processPlayerInactivityAlerts,
} from "@/lib/player-inactivity-alerts";
import {
  requirePlayerInactivityAlertManager,
} from "@/lib/player-inactivity-alert-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request,
  { params }
) {
  try {
    const { id } =
      await params;

    const leagueId =
      Number(
        id
      );

    if (
      !Number.isInteger(
        leagueId
      ) ||
      leagueId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid league ID.",
        },
        {
          status:
            400,
        }
      );
    }

    const access =
      await requirePlayerInactivityAlertManager(
        leagueId
      );

    if (!access.allowed) {
      return NextResponse.json(
        {
          error:
            access.error,
        },
        {
          status:
            access.status,
        }
      );
    }

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const summary =
      await processPlayerInactivityAlerts({
        leagueId,
        dryRun:
          body?.dryRun ===
          true,
      });

    return NextResponse.json({
      success:
        true,
      summary,
    });
  } catch (error) {
    console.error(
      "[PLAYER_INACTIVITY_MANUAL_RUN_FAILED]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to run player inactivity alerts.",
      },
      {
        status:
          500,
      }
    );
  }
}
