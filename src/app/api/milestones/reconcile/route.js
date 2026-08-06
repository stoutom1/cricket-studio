import {
  getServerSession,
} from "next-auth";
import {
  NextResponse,
} from "next/server";

import {
  authOptions,
} from "@/lib/auth";

import {
  reconcileMilestonesForMatch,
} from "@/lib/player-milestones";

export const runtime =
  "nodejs";

export async function POST(
  request
) {
  const session =
    await getServerSession(
      authOptions
    );

  if (!session) {
    return NextResponse.json(
      {
        error:
          "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const body =
    await request
      .json()
      .catch(
        () => ({})
      );

  const matchId =
    Number(
      body.matchId
    );

  if (
    !Number.isInteger(
      matchId
    ) ||
    matchId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Valid matchId is required",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const result =
      await reconcileMilestonesForMatch({
        matchId,
      });

    return NextResponse.json({
      ok: true,

      activeMilestones:
        result.milestones.length,
    });
  } catch (error) {
    console.error(
      "[MILESTONE_RECONCILE_API_FAILED]",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to reconcile milestones",
      },
      {
        status: 500,
      }
    );
  }
}
