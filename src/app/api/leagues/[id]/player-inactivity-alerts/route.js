import { NextResponse } from "next/server";

import {
  PLAYER_INACTIVITY_DAYS,
  getPlayerInactivityAlertSetting,
  savePlayerInactivityAlertSetting,
} from "@/lib/player-inactivity-alerts";
import {
  requirePlayerInactivityAlertManager,
} from "@/lib/player-inactivity-alert-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseLeagueId(value) {
  const leagueId =
    Number(
      value
    );

  return (
    Number.isInteger(
      leagueId
    ) &&
    leagueId > 0
  )
    ? leagueId
    : null;
}

export async function GET(
  request,
  { params }
) {
  try {
    const { id } =
      await params;

    const leagueId =
      parseLeagueId(
        id
      );

    if (!leagueId) {
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

    const setting =
      await getPlayerInactivityAlertSetting(
        leagueId
      );

    return NextResponse.json({
      success:
        true,
      canManage:
        true,
      role:
        access.role,
      policy: {
        inactivityDays:
          PLAYER_INACTIVITY_DAYS,
        eligibleStatuses: [
          "COMPLETED",
          "COMPLETED_LOCKED",
          "COMPLETED_CORRECTED",
          "ABANDONED",
        ],
        excludedStatuses: [
          "CANCELLED",
          "NO_RESULT",
          "SCHEDULED",
          "LIVE",
          "IN_PROGRESS",
        ],
      },
      setting,
    });
  } catch (error) {
    console.error(
      "[PLAYER_INACTIVITY_SETTING_GET_FAILED]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load player inactivity alert settings.",
      },
      {
        status:
          500,
      }
    );
  }
}

export async function PATCH(
  request,
  { params }
) {
  try {
    const { id } =
      await params;

    const leagueId =
      parseLeagueId(
        id
      );

    if (!leagueId) {
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
      await request.json();

    const updated =
      await savePlayerInactivityAlertSetting({
        leagueId,
        enabled:
          Boolean(
            body.enabled
          ),
        recipientPhone:
          body.recipientPhone,
        consentConfirmed:
          body.consentConfirmed ===
          true,
        updatedByUserId:
          access.user.id,
        updatedByName:
          access.user.name,
        updatedByEmail:
          access.user.email,
      });

    return NextResponse.json({
      success:
        true,
      message:
        updated?.enabled
          ? `Player inactivity alerts enabled. Cric4All will notify the configured number when an eligible player reaches ${PLAYER_INACTIVITY_DAYS} days without a completed-match appearance.`
          : "Player inactivity alerts disabled.",
      setting:
        updated,
    });
  } catch (error) {
    console.error(
      "[PLAYER_INACTIVITY_SETTING_PATCH_FAILED]",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to save player inactivity alert settings.";

    const isValidation =
      /phone|confirm|valid|recipient/i.test(
        message
      );

    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status:
          isValidation
            ? 400
            : 500,
      }
    );
  }
}
