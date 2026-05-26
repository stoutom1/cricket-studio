import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: {
      players: {
        orderBy: { name: "asc" }
      }
    }
  });

  return NextResponse.json(teams);
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = String(body.name || "").trim();

  if (!name) {
    return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  }

  try {
    const team = await prisma.team.create({
      data: { name }
    });
    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Team already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }
}