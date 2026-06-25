import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const body = await request.json();
  const { id } = await params;

  const matchId = Number(id);
  const bowlerId = Number(body.bowlerId);
  const inningsNo = Number(body.inningsNo || 1);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: "Invalid match id" }, { status: 400 });
  }

  if (!Number.isInteger(bowlerId) || bowlerId <= 0) {
    return NextResponse.json({ error: "Invalid bowler id" }, { status: 400 });
  }

  await prisma.matchState.upsert({
    where: { matchId },
    update: {
      bowlerId,
      inningsNo,
    },
    create: {
      matchId,
      inningsNo,
      bowlerId,
      strikerId: Number(body.strikerId || 0),
      nonStrikerId: Number(body.nonStrikerId || 0),
    },
  });

  return NextResponse.json({ success: true });
}