import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const leagueId = Number(searchParams.get("leagueId"));

  if (!leagueId || Number.isNaN(leagueId)) {
    return NextResponse.json({ error: "League id is required." }, { status: 400 });
  }

  const poll = await prisma.teamAvailabilityPoll.findFirst({
    where: {
      leagueId,
      status: "OPEN",
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
      responses: true,
    },
  });

  return NextResponse.json({ ok: true, poll });
}