import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: "Invalid poll token." },
        { status: 400 }
      );
    }

    /*
      Load the poll first because its leagueId is needed
      for the permission check.
    */
    const poll = await prisma.teamAvailabilityPoll.findUnique({
      where: {
        token,
      },
      select: {
        id: true,
        token: true,
        leagueId: true,
      },
    });

    if (!poll) {
      return NextResponse.json(
        { error: "Poll not found." },
        { status: 404 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 404 }
      );
    }

    const membership = await prisma.leagueMember.findFirst({
      where: {
        leagueId: poll.leagueId,
        userId: user.id,
      },
    });

    const canDeletePoll =
      membership?.role === "OWNER" ||
      membership?.role === "ADMIN" ||
      membership?.role === "CAPTAIN" ||
      Boolean(membership?.canScoreMatch) ||
      Boolean(membership?.canCreateAvailabilityPoll);

    if (!canDeletePoll) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to delete availability polls for this league.",
        },
        { status: 403 }
      );
    }

    /*
      If your Prisma relations are configured with
      onDelete: Cascade, this one delete is enough.
    */
    await prisma.teamAvailabilityPoll.delete({
      where: {
        token,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Poll deleted successfully.",
    });
  } catch (error) {
    console.error("Delete poll failed:", error);

    return NextResponse.json(
      {
        error:
          error?.message || "Failed to delete poll.",
      },
      { status: 500 }
    );
  }
}