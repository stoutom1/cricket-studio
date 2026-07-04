import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (session?.user?.email !== "surprisecricket11@gmail.com") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const onlineSince = new Date(Date.now() - 60 * 60 * 1000);
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [onlineUsers, recentLogins, loginCount24h] = await Promise.all([
    prisma.user.findMany({
      where: {
        lastSeenAt: {
          gte: onlineSince,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        lastSeenAt: true,
        lastLoginAt: true,
      },
      orderBy: {
        lastSeenAt: "desc",
      },
    }),

    prisma.loginHistory.findMany({
      where: {
        loginAt: {
          gte: last24Hours,
        },
      },
      orderBy: {
        loginAt: "desc",
      },
      take: 100,
    }),

    prisma.loginHistory.count({
      where: {
        loginAt: {
          gte: last24Hours,
        },
      },
    }),
  ]);

  return NextResponse.json({
    onlineUsers,
    recentLogins,
    loginCount24h,
  });
}