import {
  NextResponse,
} from "next/server";
import {
  getServerSession,
} from "next-auth";
import prisma from "@/lib/prisma";
import {
  authOptions,
} from "@/lib/auth";

export const runtime =
  "nodejs";

function parseLeagueId(
  value
) {
  const leagueId =
    Number(
      value
    );

  return Number.isInteger(
    leagueId
  ) &&
    leagueId > 0
    ? leagueId
    : null;
}

async function requireUser() {
  const session =
    await getServerSession(
      authOptions
    );

  if (
    !session?.user?.email
  ) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      email:
        session.user.email,
    },
    select: {
      id: true,
    },
  });
}

async function getState(
  userId,
  leagueId
) {
  const follower =
    await prisma.leagueFollower.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId,
        },
      },
      select: {
        id: true,
        alertsEnabled: true,
        alertMatchStart: true,
        alertMatchResult: true,
      },
    });

  const activePushDevices =
    await prisma.webPushSubscription.count({
      where: {
        userId,
        isActive:
          true,
      },
    });

  return {
    leagueId,
    followed:
      Boolean(
        follower
      ),
    alertsEnabled:
      Boolean(
        follower
          ?.alertsEnabled
      ),
    alertMatchStart:
      follower
        ?.alertMatchStart ??
      true,
    alertMatchResult:
      follower
        ?.alertMatchResult ??
      true,
    pushReady:
      activePushDevices >
      0,
  };
}

export async function GET(
  request,
  {
    params,
  }
) {
  const {
    leagueId:
      rawLeagueId,
  } =
    await params;

  const leagueId =
    parseLeagueId(
      rawLeagueId
    );

  if (!leagueId) {
    return NextResponse.json(
      {
        error:
          "A valid numeric league ID is required.",
      },
      {
        status:
          400,
      }
    );
  }

  const user =
    await requireUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Sign in to manage match alerts.",
      },
      {
        status:
          401,
      }
    );
  }

  const leagueExists =
    await prisma.league.findUnique({
      where: {
        id:
          leagueId,
      },
      select: {
        id: true,
      },
    });

  if (!leagueExists) {
    return NextResponse.json(
      {
        error:
          "Cric4All could not find this league.",
      },
      {
        status:
          404,
      }
    );
  }

  return NextResponse.json(
    await getState(
      user.id,
      leagueId
    )
  );
}

export async function PATCH(
  request,
  {
    params,
  }
) {
  const {
    leagueId:
      rawLeagueId,
  } =
    await params;

  const leagueId =
    parseLeagueId(
      rawLeagueId
    );

  if (!leagueId) {
    return NextResponse.json(
      {
        error:
          "A valid numeric league ID is required.",
      },
      {
        status:
          400,
      }
    );
  }

  const user =
    await requireUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Sign in to manage match alerts.",
      },
      {
        status:
          401,
      }
    );
  }

  const follower =
    await prisma.leagueFollower.findUnique({
      where: {
        userId_leagueId: {
          userId:
            user.id,
          leagueId,
        },
      },
      select: {
        id: true,
      },
    });

  if (!follower) {
    return NextResponse.json(
      {
        error:
          "Follow this league before enabling match alerts.",
      },
      {
        status:
          409,
      }
    );
  }

  const body =
    await request.json();

  const data = {};

  if (
    typeof body
      ?.alertsEnabled ===
    "boolean"
  ) {
    data.alertsEnabled =
      body.alertsEnabled;
  }

  if (
    typeof body
      ?.alertMatchStart ===
    "boolean"
  ) {
    data.alertMatchStart =
      body.alertMatchStart;
  }

  if (
    typeof body
      ?.alertMatchResult ===
    "boolean"
  ) {
    data.alertMatchResult =
      body.alertMatchResult;
  }

  await prisma.leagueFollower.update({
    where: {
      id:
        follower.id,
    },
    data,
  });

  return NextResponse.json({
    success:
      true,
    ...(
      await getState(
        user.id,
        leagueId
      )
    ),
  });
}
