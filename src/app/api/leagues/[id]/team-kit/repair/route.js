import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import {
  resolveTeamKitAccess,
  syncLeagueKitCustodyTasks,
} from "@/lib/kit/team-custody";

export const runtime = "nodejs";

function positiveId(value) {
  const id = Number(value);

  return Number.isInteger(id) &&
    id > 0
    ? id
    : null;
}

export async function POST(
  request,
  { params }
) {
  try {
    const session =
      await getServerSession(
        authOptions
      );

    const { id } = await params;
    const leagueId =
      positiveId(id);

    if (!leagueId) {
      return NextResponse.json(
        {
          error:
            "Invalid league id.",
        },
        {
          status: 400,
        }
      );
    }

    const access =
      await resolveTeamKitAccess({
        session,
        leagueId,
      });

    if (!access.authorized) {
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

    if (
      !access.isOwner &&
      !access.isLeagueWideAdmin
    ) {
      return NextResponse.json(
        {
          error:
            "Only a league Owner or league-wide Admin can repair kit tasks.",
        },
        {
          status: 403,
        }
      );
    }

    const result =
      await syncLeagueKitCustodyTasks(
        leagueId
      );

    return NextResponse.json({
      success: true,
      message:
        result.created > 0
          ? `${result.created} missing or archived kit follow-up task${
              result.created === 1
                ? ""
                : "s"
            } activated.`
          : "Kit follow-up tasks are already up to date.",
      ...result,
    });
  } catch (error) {
    console.error(
      "Unable to repair team-kit tasks:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to repair team-kit tasks.",
      },
      {
        status: 500,
      }
    );
  }
}
