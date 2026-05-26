import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const matches = await prisma.match.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      teamA: true,
      teamB: true,
      battingFirstTeam: true
    }
  });

  const formatted = matches.map((m) => ({
    id: m.id,
    teamAId: m.teamAId,
    teamBId: m.teamBId,
    teamAName: m.teamA.name,
    teamBName: m.teamB.name,
    battingFirstTeamId: m.battingFirstTeamId,
    battingFirstTeamName: m.battingFirstTeam.name,
    oversPerInnings: m.oversPerInnings,
    powerplayOversInnings: m.powerplayOversInnings,
    status: m.status,
    createdAt: m.createdAt
  }));

  return NextResponse.json(formatted);
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const teamAId = Number(body.teamAId);
  const teamBId = Number(body.teamBId);
  const battingFirstTeamId = Number(body.battingFirstTeamId);
  const oversPerInnings = Number(body.oversPerInnings);
  const powerplayOversInnings = Number(body.powerplayOversInnings || 0);

  if (!teamAId || !teamBId || !battingFirstTeamId) {
    return NextResponse.json({ error: "Teams and batting first team are required" }, { status: 400 });
  }

  if (teamAId === teamBId) {
    return NextResponse.json({ error: "Teams must be different" }, { status: 400 });
  }

  if (![teamAId, teamBId].includes(battingFirstTeamId)) {
    return NextResponse.json(
      { error: "Batting first team must be Team A or Team B" },
      { status: 400 }
    );
  }

  if (!Number.isInteger(oversPerInnings) || oversPerInnings < 1) {
    return NextResponse.json({ error: "Overs per innings must be at least 1" }, { status: 400 });
  }

  if (!Number.isInteger(powerplayOversInnings) || powerplayOversInnings < 0) {
    return NextResponse.json({ error: "Powerplay overs cannot be negative" }, { status: 400 });
  }

  if (powerplayOversInnings > oversPerInnings) {
    return NextResponse.json(
      { error: "Powerplay overs cannot exceed total overs" },
      { status: 400 }
    );
  }

  const teams = await prisma.team.findMany({
    where: { id: { in: [teamAId, teamBId] } },
    include: { players: true }
  });

  if (teams.length !== 2) {
    return NextResponse.json({ error: "One or both teams do not exist" }, { status: 404 });
  }

  for (const team of teams) {
    if (team.players.length === 0) {
      return NextResponse.json(
        { error: `Team ${team.name} must have at least one player` },
        { status: 400 }
      );
    }
  }

  const match = await prisma.match.create({
    data: {
      teamAId,
      teamBId,
      battingFirstTeamId,
      oversPerInnings,
      powerplayOversInnings,
      status: "in_progress"
    }
  });

  return NextResponse.json(match, { status: 201 });
}