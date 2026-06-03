import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function POST(
  request,
  { params }
) {
  const session =
    await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.redirect("/");
  }

  const { token } = await params;

  const invite =
    await prisma.leagueInvite.findUnique({
      where: { token }
    });

  if (!invite) {
    return NextResponse.json(
      { error: "Invalid invite" },
      { status: 404 }
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email: session.user.email
      }
    });

  await prisma.leagueMember.upsert({
    where: {
      userId_leagueId: {
        userId: user.id,
        leagueId: invite.leagueId
      }
    },

    update: {},

    create: {
      userId: user.id,
      leagueId: invite.leagueId,
      role: "VIEWER"
    }
  });
console.log("invite accdepted");
  return NextResponse.redirect(
    new URL("/dashboard", request.url)
  );
}