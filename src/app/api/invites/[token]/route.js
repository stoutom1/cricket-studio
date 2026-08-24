import { NextResponse } from "next/server";
import {
  LeagueInviteClaimError,
  getLeagueInviteDetails,
} from "@/lib/league-invite-claim";

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    const details = await getLeagueInviteDetails(token);

    return NextResponse.json({
      valid: true,
      legacy: details.legacy,
      league: {
        id: details.invite.league.id,
        name: details.invite.league.name,
        visibility: details.invite.league.visibility,
      },
      role: details.role,
      roleLabel: details.roleLabel,
      permissions: details.permissions,
      expiresAt: details.expiresAt,
    });
  } catch (error) {
    console.error("Load invite metadata failed:", error);

    if (error instanceof LeagueInviteClaimError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Unable to load invitation." },
      { status: 500 }
    );
  }
}
