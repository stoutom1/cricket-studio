import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const playerId = Number(id);
  const body = await request.json();

  const data = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return Response.json({ error: "Player name is required" }, { status: 400 });
    }
    data.name = name;
  }

  if (body.teamId) {
    data.teamId = Number(body.teamId);
  }

  const player = await prisma.player.update({
    where: { id: playerId },
    data,
  });

  return Response.json(player);
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const playerId = Number(id);
  if (!id) {
    return NextResponse.json({ error: "Invalid player id" }, { status: 400 });
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId }
  });

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
/*if (
  player.team.league.name ===
    "Surprise Cricket League" &&
  session.user.email !==
    "surprisecricket11@gmail.com"
) {
  return NextResponse.json(
    {
      error:
        "Only the league owner can delete players"
    },
    {
      status: 403
    }
  );
}*/
  const ballUsageCount = await prisma.ball.count({
    where: {
      OR: [
        { strikerId: playerId },
        { nonStrikerId: playerId },
        { bowlerId: playerId },
        { dismissedPlayerId: playerId },
        { newBatterId: playerId }
      ]
    }
  });

  if (ballUsageCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete player because the player is used in match scoring data. Delete related matches first." },
      { status: 400 }
    );
  }

  await prisma.player.delete({
    where: { id: playerId }
  });

  return NextResponse.json({
    success: true,
    message: "Player deleted successfully"
  });
}