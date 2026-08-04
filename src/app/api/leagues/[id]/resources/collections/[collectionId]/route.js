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

async function resolveOwnedCollection({
  params,
  userId,
}) {
  const {
    id,
    collectionId,
  } = await params;

  const leagueId =
    Number(id);

  const numericCollectionId =
    Number(collectionId);

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

  const collection =
    await prisma
      .leagueResourceCollection
      .findFirst({
        where: {
          id:
            numericCollectionId,
          leagueId,
          userId,
        },
      });

  if (!collection) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Collection not found.",
          },
          {
            status: 404,
          }
        ),
    };
  }

  return {
    leagueId,
    collection,
  };
}

export async function PATCH(
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
    await resolveOwnedCollection({
      params,
      userId,
    });

  if (resolved.error) {
    return resolved.error;
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

  const duplicate =
    await prisma
      .leagueResourceCollection
      .findFirst({
        where: {
          leagueId:
            resolved.leagueId,
          userId,
          id: {
            not:
              resolved
                .collection
                .id,
          },
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

  if (duplicate) {
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
      .update({
        where: {
          id:
            resolved
              .collection
              .id,
        },
        data: {
          name,
        },
        include: {
          _count: {
            select: {
              items: true,
            },
          },
        },
      });

  return NextResponse.json({
    success: true,
    collection: {
      ...collection,
      itemCount:
        collection
          ._count
          .items,
      _count:
        undefined,
    },
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
    await resolveOwnedCollection({
      params,
      userId,
    });

  if (resolved.error) {
    return resolved.error;
  }

  await prisma
    .leagueResourceCollection
    .delete({
      where: {
        id:
          resolved
            .collection
            .id,
      },
    });

  return NextResponse.json({
    success: true,
    collectionId:
      resolved.collection.id,
  });
}
