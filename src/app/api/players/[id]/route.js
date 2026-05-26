import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

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