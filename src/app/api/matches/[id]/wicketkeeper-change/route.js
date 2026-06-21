import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const matchId = Number(id);
    const body = await request.json();

    const inningsNo = Number(body.inningsNo);
    const newKeeperId = Number(body.newKeeperId);
    const note = body.note || null;

    if (!matchId || !inningsNo || !newKeeperId) {
      return NextResponse.json(
        { error: "Missing wicketkeeper change details" },
        { status: 400 }
      );
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        balls: {
          where: { inningsNo },
          orderBy: { sequence: "desc" },
          take: 1,
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const afterSequence = match.balls?.[0]?.sequence || 0;

    const bowlingTeamId =
      inningsNo === 1
        ? Number(match.teamAId) === Number(match.battingFirstTeamId)
          ? match.teamBId
          : match.teamAId
        : Number(match.teamAId) === Number(match.battingFirstTeamId)
        ? match.teamAId
        : match.teamBId;

    const oldKeeperId =
      inningsNo === 1
        ? Number(match.teamAId) === Number(bowlingTeamId)
          ? match.teamAWicketKeeperId
          : match.teamBWicketKeeperId
        : Number(match.teamAId) === Number(bowlingTeamId)
        ? match.teamAWicketKeeperId
        : match.teamBWicketKeeperId;

    const change = await prisma.wicketKeeperChange.create({
      data: {
        matchId,
        inningsNo,
        afterSequence,
        teamId: bowlingTeamId,
        oldKeeperId,
        newKeeperId,
        note,
      },
    });

    await prisma.match.update({
      where: { id: matchId },
      data:
        Number(match.teamAId) === Number(bowlingTeamId)
          ? { teamAWicketKeeperId: newKeeperId }
          : { teamBWicketKeeperId: newKeeperId },
    });

    return NextResponse.json({
      success: true,
      change,
      message: "Wicketkeeper changed successfully.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to change wicketkeeper" },
      { status: 400 }
    );
  }
}