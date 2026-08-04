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

function cleanName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function cleanDescription(
  value
) {
  const text =
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240);

  return text || null;
}

async function currentUser() {
  const session =
    await getServerSession(
      authOptions
    );

  return (
    session?.user?.id ||
    null
  );
}

export async function GET(
  request,
  {
    params,
  }
) {
  const userId =
    await currentUser();

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

  const {
    id,
  } = await params;

  const leagueId =
    Number(id);

  const access =
    await getLeagueResourceAccess({
      leagueId,
      userId,
    });

  if (
    !access.exists ||
    !access.canView
  ) {
    return NextResponse.json(
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
    );
  }

  const collections =
    await prisma
      .leagueResourceCollection
      .findMany({
        where: {
          leagueId,
          userId,
        },
        orderBy: [
          {
            updatedAt:
              "desc",
          },
          {
            name:
              "asc",
          },
        ],
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              items: true,
            },
          },
        },
      });

  return NextResponse.json({
    success: true,
    collections:
      collections.map(
        (collection) => ({
          ...collection,
          itemCount:
            collection
              ._count
              .items,
          _count:
            undefined,
        })
      ),
  });
}

export async function POST(
  request,
  {
    params,
  }
) {
  const userId =
    await currentUser();

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

  const {
    id,
  } = await params;

  const leagueId =
    Number(id);

  const access =
    await getLeagueResourceAccess({
      leagueId,
      userId,
    });

  if (
    !access.exists ||
    !access.canView
  ) {
    return NextResponse.json(
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
    );
  }

  const body =
    await request.json();

  const name =
    cleanName(
      body.name
    );

  if (!name) {
    return NextResponse.json(
      {
        error:
          "Collection name is required.",
      },
      {
        status: 400,
      }
    );
  }

  const existing =
    await prisma
      .leagueResourceCollection
      .findFirst({
        where: {
          leagueId,
          userId,
          name: {
            equals: name,
            mode:
              "insensitive",
          },
        },
        select: {
          id: true,
        },
      });

  if (existing) {
    return NextResponse.json(
      {
        error:
          "You already have a collection with this name.",
      },
      {
        status: 409,
      }
    );
  }

  const collection =
    await prisma
      .leagueResourceCollection
      .create({
        data: {
          leagueId,
          userId,
          name,
          description:
            cleanDescription(
              body.description
            ),
        },
      });

  return NextResponse.json(
    {
      success: true,
      collection: {
        ...collection,
        itemCount: 0,
      },
    },
    {
      status: 201,
    }
  );
}
