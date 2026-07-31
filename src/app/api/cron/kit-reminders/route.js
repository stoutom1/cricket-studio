import { NextResponse } from "next/server";

import {
  processDayBeforeKitReminders,
  processTwoHoursBeforeKitReminders,
} from "@/lib/kit/process-kit-reminders";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

function isAuthorized(request) {
  const cronSecret =
    String(
      process.env
        .CRON_SECRET ||
        ""
    ).trim();

  if (!cronSecret) {
    return false;
  }

  const authorization =
    request.headers.get(
      "authorization"
    );

  return (
    authorization ===
    `Bearer ${cronSecret}`
  );
}

function getErrorMessage(error) {
  return String(
    error instanceof Error
      ? error.message
      : error
  ).slice(0, 1000);
}

function combineSummaries({
  dayBefore,
  twoHoursBefore,
}) {
  const numericFields = [
    "checkedMatches",
    "closedMatches",
    "eligibleMatches",
    "checkedAssignments",
    "alreadySent",
    "dryRun",
    "sent",
    "skipped",
    "failed",
    "queued",
    "notClaimed",
    "submittedToProvider",
    "awaitingDeliveryCallback",
    "immediatelySentByProvider",
    "matchesAlreadyStarted",
  ];

  const totals = {};

  for (
    const field
    of numericFields
  ) {
    totals[field] =
      Number(
        dayBefore?.[field] ||
          0
      ) +
      Number(
        twoHoursBefore
          ?.[field] ||
          0
      );
  }

  totals.deliveryStatusNote =
    totals
      .awaitingDeliveryCallback >
    0
      ? `${totals.awaitingDeliveryCallback} total kit-reminder request(s) were accepted by Twilio and are awaiting asynchronous delivery callbacks.`
      : "No kit-reminder requests are currently awaiting delivery callbacks.";

  return totals;
}

export async function GET(request) {
  if (
    !isAuthorized(request)
  ) {
    return NextResponse.json(
      {
        error:
          "Unauthorized",
      },
      {
        status:
          401,
      }
    );
  }

  if (
    String(
      process.env
        .KIT_REMINDERS_ENABLED ||
        ""
    )
      .trim()
      .toLowerCase() !==
    "true"
  ) {
    return NextResponse.json({
      success:
        true,

      enabled:
        false,

      message:
        "Kit reminders are currently disabled.",
    });
  }

  try {
    /*
     * Run the two timing modes sequentially. This keeps
     * database load predictable and remains safely within
     * the existing atomic reminder claims.
     */
    const dayBefore =
      await processDayBeforeKitReminders();

    const twoHoursBefore =
      await processTwoHoursBeforeKitReminders();

    return NextResponse.json({
      success:
        true,

      enabled:
        true,

      /*
       * Preserve the original flat day-before counters
       * for existing consumers.
       */
      summary: {
        ...dayBefore,

        twoHoursBefore,

        totals:
          combineSummaries({
            dayBefore,
            twoHoursBefore,
          }),
      },
    });
  } catch (error) {
    const errorMessage =
      getErrorMessage(error);

    console.error(
      "[KIT_REMINDER_CRON_FAILED]",
      {
        error:
          errorMessage,
      }
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          "Unable to process kit reminders.",

        details:
          errorMessage,
      },
      {
        status:
          500,
      }
    );
  }
}