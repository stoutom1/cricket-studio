import {
  getServerSession,
} from "next-auth";
import {
  NextResponse,
} from "next/server";

import {
  authOptions,
} from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  getLeagueResourceAccess,
} from "@/lib/resources/access";

export const runtime =
  "nodejs";
export const dynamic =
  "force-dynamic";

async function context(
  params,
  userId
) {
  const {
    id,
    resourceId,
  } = await params;

  const leagueId =
    Number(id);

  const numericResourceId =
    Number(resourceId);

  const access =
    await getLeagueResourceAccess({
      leagueId,
      userId,
    });

  if (
    !access.exists ||
    !access.canView
  ) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "You do not have access to this league.",
          },
          {
            status:
              access.exists
                ? 403
                : 404,
          }
        ),
    };
  }

  const resource =
    await prisma
      .leagueResource
      .findFirst({
        where: {
          id:
            numericResourceId,
          leagueId,
        },
        select: {
          id: true,
        },
      });

  if (!resource) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Resource not found.",
          },
          {
            status: 404,
          }
        ),
    };
  }

  return {
    leagueId,
    resourceId:
      numericResourceId,
  };
}

export async function PUT(
  request,
  {
    params,
  }
) {
  const session =
    await getServerSession(
      authOptions
    );

  const userId =
    session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      {
        error:
          "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }

  const resolved =
    await context(
      params,
      userId
    );

  if (resolved.error) {
    return resolved.error;
  }

  await prisma
    .leagueResourceFavorite
    .upsert({
      where: {
        resourceId_userId: {
          resourceId:
            resolved.resourceId,
          userId,
        },
      },
      update: {},
      create: {
        resourceId:
          resolved.resourceId,
        userId,
      },
    });

  return NextResponse.json({
    success: true,
    resourceId:
      resolved.resourceId,
    isFavorite: true,
  });
}

export async function DELETE(
  request,
  {
    params,
  }
) {
  const session =
    await getServerSession(
      authOptions
    );

  const userId =
    session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      {
        error:
          "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }

  const resolved =
    await context(
      params,
      userId
    );

  if (resolved.error) {
    return resolved.error;
  }

  await prisma
    .leagueResourceFavorite
    .deleteMany({
      where: {
        resourceId:
          resolved.resourceId,
        userId,
      },
    });

  return NextResponse.json({
    success: true,
    resourceId:
      resolved.resourceId,
    isFavorite: false,
  });
}
