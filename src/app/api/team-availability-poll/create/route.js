import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Declare leagueId before any query uses it
    const leagueId = Number(body.leagueId);

    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      return NextResponse.json(
        { error: "A valid league is required." },
        { status: 400 }
      );
    }

    const sourceTeamIds = Array.isArray(body.sourceTeamIds)
      ? [
          ...new Set(
            body.sourceTeamIds
              .map(Number)
              .filter((id) => Number.isInteger(id) && id > 0)
          ),
        ]
      : [];

    if (!sourceTeamIds.length) {
      return NextResponse.json(
        { error: "At least one player-pool team is required." },
        { status: 400 }
      );
    }

    const validTeams = await prisma.team.findMany({
      where: {
        leagueId,
        id: {
          in: sourceTeamIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (validTeams.length !== sourceTeamIds.length) {
      return NextResponse.json(
        {
          error:
            "One or more selected player-pool teams do not belong to this league.",
        },
        { status: 400 }
      );
    }

    // continue with user lookup, membership validation,
    // cleanOptions, token generation, and poll creation...

    // Load the signed-in database user BEFORE using user.id
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
        leagueId,
        userId: user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You do not have access to this league." },
        { status: 403 }
      );
    }

    const canCreatePoll =
      membership.role === "OWNER" ||
      membership.role === "ADMIN" ||
      Boolean(membership.canScoreMatch) ||
      Boolean(membership.canCreateAvailabilityPoll);

    if (!canCreatePoll) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to create availability polls.",
        },
        { status: 403 }
      );
    }

const title = String(body.title || "").trim();
const matchText = String(body.matchText || "").trim();

const options = Array.isArray(body.options)
  ? body.options
  : [];

const cleanOptions = options
  .map((option) => ({
    label: String(option?.label || "").trim(),
    startTime: option?.startTime || null,
  }))
  .filter((option) => option.label || option.startTime);

if (!title) {
  return NextResponse.json(
    { error: "Poll title is required." },
    { status: 400 }
  );
}

if (!cleanOptions.length) {
  return NextResponse.json(
    { error: "At least one valid match option is required." },
    { status: 400 }
  );
}

    // Keep your existing poll creation logic below this point.
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 24);

    const poll = await prisma.teamAvailabilityPoll.create({
      data: {
        token,
        leagueId: leagueId ? Number(leagueId) : null,
        title: title || "Match Availability",
        matchText: matchText || null,
        sourceTeamIds: sourceTeamIds.join(","),
        options: {
          create: cleanOptions.map((option, index) => ({
            label: option.label || `Option ${index + 1}`,
            startTime: option.startTime ? new Date(option.startTime) : null,
            sortOrder: index,
          })),
        },
      },
      include: {
        options: {
          orderBy: { sortOrder: "asc" },
        },
        responses: true,
      },
    });

    return NextResponse.json({
      ok: true,
      poll,
    });
  } catch (error) {
    console.error("Create availability poll failed:", error);
    return NextResponse.json(
      { error: "Failed to create poll." },
      { status: 500 }
    );
  }
}