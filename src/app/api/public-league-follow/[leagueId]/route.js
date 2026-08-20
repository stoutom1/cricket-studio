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

async function getLeague(
  leagueId
) {
  return prisma.league.findUnique({
    where: {
      id:
        leagueId,
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
    await getLeague(
      leagueId
    );

  if (!league) {
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

  const follower =
    await prisma.leagueFollower.upsert({
      where: {
        userId_leagueId: {
          userId:
            user.id,
          leagueId:
            league.id,
        },
      },
      update: {},
      create: {
        userId:
          user.id,
        leagueId:
          league.id,
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
    leagueId:
      league.id,
    leagueSlug:
      league.slug,
    follower,
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
    leagueId,
  });
}
