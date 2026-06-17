import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const leagueId = Number(searchParams.get("leagueId"));
  const year = searchParams.get("year");

  if (!leagueId || Number.isNaN(leagueId)) {
    return NextResponse.json(
      { error: "Invalid league id" },
      { status: 400 }
    );
  }

  const where = {
    leagueId,
    ...(year ? { year: Number(year) } : {})
  };

  const series = await prisma.series.findMany({
    where,
    orderBy: [
      { year: "desc" },
      { createdAt: "desc" }
    ]
  });

  return NextResponse.json(series);
}

export async function POST(request) {
  const body = await request.json();

  const leagueId = Number(body.leagueId);
  const year = Number(body.year);

  if (!leagueId || Number.isNaN(leagueId)) {
    return NextResponse.json(
      { error: "Invalid league id" },
      { status: 400 }
    );
  }

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "Series name is required" },
      { status: 400 }
    );
  }

  const series = await prisma.series.create({
    data: {
      leagueId,
      name: body.name.trim(),
      year: year || new Date().getFullYear(),
      description: body.description || "",
      status: body.status || "ACTIVE"
    }
  });

  return NextResponse.json(series);
}