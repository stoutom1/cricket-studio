import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const leagueId = Number(searchParams.get("leagueId"));

    if (!leagueId || Number.isNaN(leagueId)) {
      return NextResponse.json(
        { error: "League id is required." },
        { status: 400 }
      );
    }

    const polls = await prisma.teamAvailabilityPoll.findMany({
      where: { leagueId },
      orderBy: { createdAt: "desc" },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        responses: true,
      },
    });

    return NextResponse.json({ ok: true, polls });
  } catch (error) {
    console.error("List polls failed:", error);
    return NextResponse.json(
      { error: "Failed to load polls." },
      { status: 500 }
    );
  }
}