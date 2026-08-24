import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  LeagueInviteClaimError,
  claimLeagueInviteForUser,
} from "@/lib/league-invite-claim";

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Sign in is required to accept this invitation." },
        { status: 401 }
      );
    }

    const { token } = await params;

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true },
    });

    if (!currentUser) {
      return NextResponse.json(
        {
          error: "Complete your Cric4All profile before accepting this invitation.",
          code: "PROFILE_REQUIRED",
        },
        { status: 409 }
      );
    }

    const result = await claimLeagueInviteForUser({
      token,
      userId: currentUser.id,
      userEmail: currentUser.email,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Accept league invite failed:", error);

    if (error instanceof LeagueInviteClaimError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Unable to accept invitation." },
      { status: 500 }
    );
  }
}
