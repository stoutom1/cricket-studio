import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request) {
  const secret = request.headers.get("x-cron-secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await prisma.loginHistory.deleteMany({
    where: {
      loginAt: {
        lt: cutoff,
      },
    },
  });

  return NextResponse.json({
    deleted: result.count,
  });
}