import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { GROWTH_EVENT_TYPES, recordGrowthEvent } from "@/lib/growth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const eventType = String(body?.eventType || "").trim().toUpperCase();
    if (!GROWTH_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: "Unsupported growth event." }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    let userId = session?.user?.id || null;
    if (!userId && session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      userId = user?.id || null;
    }

    await recordGrowthEvent({
      eventType,
      visitorId: body?.visitorId,
      sessionId: body?.sessionId,
      userId,
      leagueId: body?.leagueId,
      matchId: body?.matchId,
      source: body?.source || "WEB",
      path: body?.path,
      metadata: body?.metadata,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[GROWTH_EVENT_ROUTE_FAILED]", error);
    // Never make a page unusable because analytics failed.
    return NextResponse.json({ success: false }, { status: 202 });
  }
}
