import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const matchId = Number(id);
    const body = await req.json();

    const battingFirstTeamId = Number(body.battingFirstTeamId);

    if (!matchId || !battingFirstTeamId) {
      return NextResponse.json(
        { error: "Match and batting first team are required" },
        { status: 400 }
      );
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId }
    });

    if (!match) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      );
    }

    if (![match.teamAId, match.teamBId].includes(battingFirstTeamId)) {
      return NextResponse.json(
        { error: "Batting first team must be part of this match" },
        { status: 400 }
      );
    }

    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        battingFirstTeamId,
        status: "IN_PROGRESS"
      }
    });

    return NextResponse.json({
      success: true,
      match: updatedMatch
    });
  } catch (error) {
    console.error("Start match failed:", error);

    return NextResponse.json(
      { error: "Failed to start match" },
      { status: 500 }
    );
  }
}