import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const teamId = Number(body.teamId);
  const name = String(body.name || "").trim();

  if (!teamId || !name) {
    return NextResponse.json({ error: "Team and player name are required" }, { status: 400 });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId }
  });

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  try {
    const player = await prisma.player.create({
      data: { teamId, name }
    });
    return NextResponse.json(player, { status: 201 });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Player already exists in this team" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create player" }, { status: 500 });
  }
}