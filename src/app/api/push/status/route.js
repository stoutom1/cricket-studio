import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session =
      await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const user =
      await prisma.user.findUnique({
        where: {
          email: session.user.email,
        },

        select: {
          id: true,
          webPushSubscriptions: {
            where: {
              isActive: true,
            },

            select: {
              id: true,
              deviceName: true,
              createdAt: true,
              lastUsedAt: true,
            },
          },
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "User was not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,
      activeDeviceCount:
        user.webPushSubscriptions.length,
      devices:
        user.webPushSubscriptions,
    });
  } catch (error) {
    console.error(
      "Reading push status failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to read notification status.",
      },
      {
        status: 500,
      }
    );
  }
}