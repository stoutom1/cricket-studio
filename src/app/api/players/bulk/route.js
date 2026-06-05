import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request) {
  const session = await getServerSession(authOptions);
const body = await request.json();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
let names = [];

if (Array.isArray(body.names)) {
  names = body.names
    .map((n) => String(n).trim())
    .filter(Boolean);
} else if (typeof body.names === "string") {
  names = body.names
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean);
}
  

  const teamId = Number(body.teamId);

  if (!teamId) {
    return NextResponse.json(
      { error: "Team required" },
      { status: 400 }
    );
  }

  if (names.length === 0) {
    return NextResponse.json(
      { error: "No players supplied" },
      { status: 400 }
    );
  }

  const players = await prisma.player.createMany({
    data: names.map((name) => ({
      name,
      teamId
    })),
    skipDuplicates: true
  });

  return NextResponse.json({
    success: true,
    created: players.count
  });
}