import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request, { params }) {
  const body = await request.json();

  const { id } = await params;
  const matchId = Number(id);

  await prisma.matchState.update({
    where: {
      matchId
    },
    data: {
      bowlerId: Number(body.bowlerId)
    }
  });

  return NextResponse.json({
    success: true
  });
}