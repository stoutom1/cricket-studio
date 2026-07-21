import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const token = String(body.token ?? "").trim();
    const platform = String(body.platform ?? "").trim();

    if (token.length < 50) {
      return NextResponse.json(
        { error: "Invalid push token." },
        { status: 400 }
      );
    }

    if (!["android", "ios", "web"].includes(platform)) {
      return NextResponse.json(
        { error: "Invalid device platform." },
        { status: 400 }
      );
    }

    const device = await prisma.pushDevice.upsert({
      where: {
        token,
      },
      create: {
        userId: session.user.id,
        token,
        platform,
        deviceName:
          typeof body.deviceName === "string"
            ? body.deviceName.slice(0, 100)
            : null,
      },
      update: {
        userId: session.user.id,
        platform,
        enabled: true,
        lastSeenAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Push device registered.",
      deviceId: device.id,
    });
  } catch (error) {
    console.error("Register push device failed:", error);

    return NextResponse.json(
      { error: "Unable to register this device." },
      { status: 500 }
    );
  }
}