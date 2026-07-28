import {
  getServerSession,
} from "next-auth";
import { NextResponse } from "next/server";
import {
  authOptions,
} from "@/lib/auth";
import {
  isSuperAdmin,
} from "@/lib/superAdmin";
import {
  processDayBeforeKitReminders,
} from "@/lib/kit/process-kit-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session =
    await getServerSession(authOptions);

  if (
    !session ||
    !isSuperAdmin(session)
  ) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const summary =
      await processDayBeforeKitReminders({
        dryRun: true,
      });

    return NextResponse.json({
      success: true,
      dryRun: true,
      summary,
    });
  } catch (error) {
    console.error(
      "Kit reminder test failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to test kit reminders.",
      },
      {
        status: 500,
      }
    );
  }
}