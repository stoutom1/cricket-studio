import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(
  request,
  { params }
) {
  const { id } = await params;
  const leagueId = Number(id);

  await prisma.league.delete({
    where: {
      id: leagueId
    }
  });

  return NextResponse.json({
    success: true
  });
}