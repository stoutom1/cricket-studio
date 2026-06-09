import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request) {
  const body = await request.json();

  await prisma.matchEvent.create({
    data: {
      matchId: Number(body.matchId),
      inningsNo: Number(body.inningsNo),

      eventType: "RETIRED_HURT",

      playerId: Number(
        body.dismissedPlayerId
      ),

      replacementId: Number(
        body.newBatterId
      ),

      strikerId: Number(
        body.strikerId
      ),

      nonStrikerId: Number(
        body.nonStrikerId
      )
    }
  });

  return NextResponse.json({
    success: true
  });
}