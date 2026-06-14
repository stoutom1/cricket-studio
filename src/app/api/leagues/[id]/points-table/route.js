import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildPointsTable } from "@/lib/points-table";

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const leagueId = Number(id);

    if (!leagueId) {
      return NextResponse.json(
        { error: "Invalid league id" },
        { status: 400 }
      );
    }

    const teams = await prisma.team.findMany({
      where: { leagueId },
      orderBy: { name: "asc" },
    });

    const matches = await prisma.match.findMany({
      where: { leagueId },
      include: {
        balls: true,
      },
    });

    const pointsTable = buildPointsTable({
      teams,
      matches,
    });

    return NextResponse.json(pointsTable);
  } catch (error) {
    console.error("Points table failed:", error);

    return NextResponse.json(
      { error: "Failed to load points table" },
      { status: 500 }
    );
  }
}