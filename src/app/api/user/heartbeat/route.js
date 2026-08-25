import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function staleSessionResponse() {
  return NextResponse.json(
    {
      ok: false,
      code: "USER_NOT_FOUND",
      message:
        "This browser session no longer maps to an active Cric4All account.",
    },
    {
      status: 404,
    }
  );
}

export async function POST() {
  try {
    const session = await getServerSession(
      authOptions
    );

    const email = String(
      session?.user?.email || ""
    )
      .trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.json(
        {
          ok: false,
          code: "UNAUTHENTICATED",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * Do not call user.update() blindly. A JWT/session cookie can outlive the
     * database row it originally belonged to (for example after an account was
     * removed in another browser). Prisma update() would throw P2025 and turn a
     * harmless stale session into a 500 on every heartbeat.
     */
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      return staleSessionResponse();
    }

    try {
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          lastSeenAt: new Date(),
        },
      });
    } catch (error) {
      /*
       * Handle the small race where the user is deleted after findUnique()
       * but before update(). Treat it exactly like any other stale session.
       */
      if (error?.code === "P2025") {
        return staleSessionResponse();
      }

      throw error;
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "[USER_HEARTBEAT_FAILED]",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        code: "HEARTBEAT_FAILED",
      },
      {
        status: 500,
      }
    );
  }
}
