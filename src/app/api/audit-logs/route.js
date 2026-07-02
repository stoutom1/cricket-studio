import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const leagueId = searchParams.get("leagueId");
  const matchId = searchParams.get("matchId");

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(leagueId ? { leagueId: Number(leagueId) } : {}),
      ...(matchId ? { matchId: Number(matchId) } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(logs);
}