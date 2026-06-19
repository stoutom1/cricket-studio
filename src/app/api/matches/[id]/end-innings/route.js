import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const { id } = await params;
  const matchId = Number(id);

  if (!matchId || Number.isNaN(matchId)) {
    return NextResponse.json(
      { error: "Invalid match id" },
      { status: 400 }
    );
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  if (!match) {
    return NextResponse.json(
      { error: "Match not found" },
      { status: 404 }
    );
  }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      innings1EndedManually: true,
    },
  });

  return NextResponse.json({
    success: true,
  });
}