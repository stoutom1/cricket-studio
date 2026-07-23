import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
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

    const body = await request.json();

    const endpoint =
      String(body?.endpoint || "").trim();

    if (!endpoint) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Subscription endpoint is required.",
        },
        {
          status: 400,
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

    await prisma.webPushSubscription.updateMany({
      where: {
        endpoint,
        userId: user.id,
      },

      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Disabling push subscription failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to disable subscription.",
      },
      {
        status: 500,
      }
    );
  }
}