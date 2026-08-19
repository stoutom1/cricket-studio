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

async function getCurrentUser() {
  const session =
    await getServerSession(
      authOptions
    );

  if (
    !session?.user?.email
  ) {
    return {
      session,
      user: null,
    };
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email:
          session.user.email,
      },
      select: {
        id: true,
      },
    });

  return {
    session,
    user,
  };
}

async function getFollowableLeague(
  leagueId
) {
  return prisma.league.findFirst({
    where: {
      id:
        leagueId,
      visibility: {
        in: [
          "PUBLIC",
          "UNLISTED",
        ],
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
    },
  });
}

export async function POST(
  request,
  {
    params,
  }
) {
  const {
    leagueId:
      leagueIdParam,
  } = await params;

  const leagueId =
    Number(
      leagueIdParam
    );

  if (
    !Number.isInteger(
      leagueId
    ) ||
    leagueId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid league id.",
      },
      {
        status:
          400,
      }
    );
  }

  const {
    user,
  } =
    await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Please sign in to follow this league.",
      },
      {
        status:
          401,
      }
    );
  }

  const league =
    await getFollowableLeague(
      leagueId
    );

  if (!league) {
    return NextResponse.json(
      {
        error:
          "This league is not available to follow.",
      },
      {
        status:
          404,
      }
    );
  }

  const follower =
    await prisma.leagueFollower.upsert({
      where: {
        userId_leagueId: {
          userId:
            user.id,
          leagueId,
        },
      },
      update: {},
      create: {
        userId:
          user.id,
        leagueId,
      },
      select: {
        id: true,
        alertsEnabled: true,
        alertMatchStart: true,
        alertMatchResult: true,
      },
    });

  return NextResponse.json({
    success:
      true,
    followed:
      true,
    follower,
    league,
  });
}

export async function DELETE(
  request,
  {
    params,
  }
) {
  const {
    leagueId:
      leagueIdParam,
  } = await params;

  const leagueId =
    Number(
      leagueIdParam
    );

  if (
    !Number.isInteger(
      leagueId
    ) ||
    leagueId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid league id.",
      },
      {
        status:
          400,
      }
    );
  }

  const {
    user,
  } =
    await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Please sign in to update followed leagues.",
      },
      {
        status:
          401,
      }
    );
  }

  await prisma.$transaction([
    prisma.leagueAlertDelivery.deleteMany({
      where: {
        userId:
          user.id,
        leagueId,
      },
    }),

    prisma.leagueFollower.deleteMany({
      where: {
        userId:
          user.id,
        leagueId,
      },
    }),
  ]);

  return NextResponse.json({
    success:
      true,
    followed:
      false,
  });
}
