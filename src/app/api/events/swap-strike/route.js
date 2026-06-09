import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request) {
  const body = await request.json();

  await prisma.matchEvent.create({
    data: {
      matchId: Number(body.matchId),
      inningsNo: Number(body.inningsNo),

      eventType: "SWAP_STRIKE",

      strikerId: Number(
        body.strikerId
      ),

      nonStrikerId: Number(
        body.nonStrikerId
      )
    }
  });

await prisma.matchState.update({
  where: {
    matchId: Number(body.matchId)
  },
  data: {
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