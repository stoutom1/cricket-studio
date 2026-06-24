import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
const { id: idParam } = await params;
const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid league id" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const league = await prisma.league.findFirst({
    where: {
      id,
      visibility: { in: ["PUBLIC", "UNLISTED"] },
    },
    select: { id: true },
  });

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

await prisma.leagueFollower.upsert({
  where: {
    userId_leagueId: {
      userId: user.id,
      leagueId: id,
    },
  },
  update: {},
  create: {
    userId: user.id,
    leagueId: id,
  },
});

  return NextResponse.json({ followed: true });
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const resolvedParams = await params;

  const leagueParam =
    resolvedParams.id ??
    resolvedParams.leagueId;

  const id = Number(leagueParam);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "Invalid league id" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  await prisma.leagueFollower.deleteMany({
    where: {
      userId: user.id,
      leagueId: id,
    },
  });

  return NextResponse.json({
    followed: false,
  });
}