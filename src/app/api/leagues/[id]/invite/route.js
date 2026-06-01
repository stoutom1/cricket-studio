import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req, { params }) {
  const { id } = await params;

  const leagueId = Number(id);

  if (Number.isNaN(leagueId)) {
    return NextResponse.json(
      { error: "Invalid league id" },
      { status: 400 }
    );
  }

  const league = await prisma.league.findUnique({
    where: {
      id: leagueId
    }
  });

  if (!league) {
    return NextResponse.json(
      { error: "League not found" },
      { status: 404 }
    );
  }

  const token = crypto.randomUUID();

  await prisma.leagueInvite.create({
    data: {
      token,
      leagueId
    }
  });
const origin = new URL(req.url).origin;
  const inviteLink =
    //`${process.env.NEXT_PUBLIC_APP_URL}/register-league/${token}`;
    `${origin}/register-league/${token}`;

  return NextResponse.json({
    inviteLink
  });
}