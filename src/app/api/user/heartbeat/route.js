import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await prisma.user.update({
    where: { email: session.user.email },
    data: { lastSeenAt: new Date() },
  });

  console.log("Heartbeat updated:", session.user.email);

  return NextResponse.json({ ok: true });
}