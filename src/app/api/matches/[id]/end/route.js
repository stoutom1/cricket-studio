import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    const { id } = await params;
    const matchId = Number(id);

    if (!matchId || Number.isNaN(matchId)) {
      return NextResponse.json(
        { error: "Invalid match id" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { matchEndType } = body;

    const beforeMatch = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        teamA: true,
        teamB: true,
        league: true,
        series: true,
      },
    });

    if (!beforeMatch) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      );
    }

    let status;
    let endedAt = null;
    let lockedAt = null;
    let statusText;
    let auditAction;
    let auditDescription;

    if (matchEndType === "Lock") {
      status = "COMPLETED_LOCKED";
      statusText = "COMPLETED_LOCKED";
      lockedAt = new Date();
      auditAction = "MATCH_LOCKED";
      auditDescription = `Match "${beforeMatch.teamA?.name || "Team A"} vs ${
        beforeMatch.teamB?.name || "Team B"
      }" was locked.`;
    } else if (matchEndType === "Abandon") {
      status = "ABANDONED";
      statusText = "ABANDONED";
      endedAt = new Date();
      auditAction = "MATCH_ABANDONED";
      auditDescription = `Match "${beforeMatch.teamA?.name || "Team A"} vs ${
        beforeMatch.teamB?.name || "Team B"
      }" was abandoned.`;
    } else {
      status = "COMPLETED";
      statusText = "MATCH COMPLETED";
      endedAt = new Date();
      auditAction = "MATCH_ENDED";
      auditDescription = `Match "${beforeMatch.teamA?.name || "Team A"} vs ${
        beforeMatch.teamB?.name || "Team B"
      }" was ended.`;
    }

    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        status,
        endedAt,
        lockedAt,
        statusText,
      },
      include: {
        teamA: true,
        teamB: true,
        league: true,
        series: true,
      },
    });

    await logAudit({
      action: auditAction,
      entityType: "MATCH",
      entityId: matchId,
      leagueId: updatedMatch.leagueId || null,
      matchId,
      actor: session?.user,
      description: auditDescription,
      beforeData: beforeMatch,
      afterData: updatedMatch,
      request,
    });

    return NextResponse.json({
      success: true,
      match: updatedMatch,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to end match" },
      { status: 500 }
    );
  }
}