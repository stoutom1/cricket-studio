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
    return NextResponse.json(
      {
        error:
          "Resource not found.",
      },
      {
        status: 404,
      }
    );
  }

  const body =
    await request.json();

  const requestedIds =
    Array.from(
      new Set(
        (
          Array.isArray(
            body.collectionIds
          )
            ? body.collectionIds
            : []
        )
          .map(Number)
          .filter(
            (collectionId) =>
              Number.isInteger(
                collectionId
              ) &&
              collectionId > 0
          )
      )
    );

  const ownedCollections =
    requestedIds.length
      ? await prisma
          .leagueResourceCollection
          .findMany({
            where: {
              id: {
                in:
                  requestedIds,
              },
              leagueId,
              userId,
            },
            select: {
              id: true,
            },
          })
      : [];

  if (
    ownedCollections.length !==
    requestedIds.length
  ) {
    return NextResponse.json(
      {
        error:
          "One or more selected collections are invalid.",
      },
      {
        status: 400,
      }
    );
  }

  await prisma.$transaction(
    async (transaction) => {
      await transaction
        .leagueResourceCollectionItem
        .deleteMany({
          where: {
            resourceId:
              numericResourceId,
            collection: {
              leagueId,
              userId,
            },
          },
        });

      if (
        ownedCollections.length
      ) {
        await transaction
          .leagueResourceCollectionItem
          .createMany({
            data:
              ownedCollections.map(
                (collection) => ({
                  collectionId:
                    collection.id,
                  resourceId:
                    numericResourceId,
                })
              ),
            skipDuplicates:
              true,
          });
      }

      await transaction
        .leagueResourceCollection
        .updateMany({
          where: {
            id: {
              in:
                requestedIds,
            },
            userId,
            leagueId,
          },
          data: {
            updatedAt:
              new Date(),
          },
        });
    }
  );

  return NextResponse.json({
    success: true,
    resourceId:
      numericResourceId,
    collectionIds:
      requestedIds,
  });
}
