import prisma from "@/lib/prisma";

export async function getResourcePersonalization({
  resourceIds,
  userId,
  leagueId,
}) {
  const ids =
    Array.from(
      new Set(
        (resourceIds || [])
          .map(Number)
          .filter(
            (id) =>
              Number.isInteger(id) &&
              id > 0
          )
      )
    );

  const collections =
    await prisma
      .leagueResourceCollection
      .findMany({
        where: {
          leagueId:
            Number(leagueId),
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

  if (!ids.length) {
    return {
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
      favorites: [],
      memberships: [],
    };
  }

  const [
    favorites,
    memberships,
  ] =
    await Promise.all([
      prisma
        .leagueResourceFavorite
        .findMany({
          where: {
            userId,
            resourceId: {
              in: ids,
            },
          },
          select: {
            resourceId: true,
          },
        }),

      prisma
        .leagueResourceCollectionItem
        .findMany({
          where: {
            resourceId: {
              in: ids,
            },
            collection: {
              leagueId:
                Number(
                  leagueId
                ),
              userId,
            },
          },
          select: {
            resourceId: true,
            collectionId: true,
          },
        }),
    ]);

  return {
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
    favorites,
    memberships,
  };
}

export function addResourcePersonalization(
  resources,
  {
    favorites = [],
    memberships = [],
  } = {}
) {
  const favoriteIds =
    new Set(
      favorites.map(
        (favorite) =>
          favorite.resourceId
      )
    );

  const membershipMap =
    new Map();

  for (
    const membership of
    memberships
  ) {
    const existing =
      membershipMap.get(
        membership.resourceId
      ) || [];

    existing.push(
      membership.collectionId
    );

    membershipMap.set(
      membership.resourceId,
      existing
    );
  }

  return resources.map(
    (resource) => ({
      ...resource,

      isFavorite:
        favoriteIds.has(
          resource.id
        ),

      collectionIds:
        membershipMap.get(
          resource.id
        ) || [],
    })
  );
}
