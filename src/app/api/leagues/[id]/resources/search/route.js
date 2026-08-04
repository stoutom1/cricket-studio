import {
  Prisma,
} from "@prisma/client";
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
import {
  buildSearchSnippet,
  normalizeSearchText,
} from "@/lib/resources/search";

export const runtime =
  "nodejs";
export const dynamic =
  "force-dynamic";
export const revalidate = 0;

function positiveInteger(
  value,
  fallback,
  maximum
) {
  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return fallback;
  }

  return Math.min(
    parsed,
    maximum
  );
}

function addReactionSummary(
  resources,
  groupedCounts,
  userReactions
) {
  const countMap =
    new Map();

  for (
    const row of groupedCounts
  ) {
    countMap.set(
      `${row.resourceId}:${row.reaction}`,
      row._count?._all || 0
    );
  }

  const reactionMap =
    new Map(
      userReactions.map(
        (row) => [
          row.resourceId,
          row.reaction,
        ]
      )
    );

  return resources.map(
    (resource) => ({
      ...resource,

      upCount:
        countMap.get(
          `${resource.id}:UP`
        ) || 0,

      downCount:
        countMap.get(
          `${resource.id}:DOWN`
        ) || 0,

      myReaction:
        reactionMap.get(
          resource.id
        ) || null,
    })
  );
}

export async function GET(
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
  } = await params;

  const leagueId =
    Number(id);

  const access =
    await getLeagueResourceAccess({
      leagueId,
      userId,
    });

  if (!access.exists) {
    return NextResponse.json(
      {
        error:
          "League not found.",
      },
      {
        status: 404,
      }
    );
  }

  if (!access.canView) {
    return NextResponse.json(
      {
        error:
          "You do not have access to this league.",
      },
      {
        status: 403,
      }
    );
  }

  const url =
    new URL(request.url);

  const query =
    String(
      url.searchParams.get(
        "q"
      ) || ""
    )
      .trim()
      .slice(0, 160);

  const normalized =
    normalizeSearchText(
      query
    );

  if (
    normalized.length < 2
  ) {
    return NextResponse.json({
      success: true,
      query,
      total: 0,
      resources: [],
    });
  }

  const limit =
    positiveInteger(
      url.searchParams.get(
        "limit"
      ),
      40,
      100
    );

  /*
   * PostgreSQL combines:
   * - Full-text ranking
   * - Trigram similarity for typo tolerance
   * - ILIKE as a dependable partial-word fallback
   */
  const rankedRows =
    await prisma.$queryRaw(
      Prisma.sql`
        WITH search_query AS (
          SELECT
            websearch_to_tsquery(
              'english',
              ${query}
            ) AS tsq,
            ${normalized}::text
              AS needle
        )
        SELECT
          resource."id",

          (
            CASE
              WHEN
                resource."searchVector"
                  @@ search_query.tsq
              THEN
                ts_rank_cd(
                  resource."searchVector",
                  search_query.tsq,
                  32
                ) * 12
              ELSE 0
            END

            +

            similarity(
              COALESCE(
                resource."searchText",
                ''
              ),
              search_query.needle
            ) * 4

            +

            CASE
              WHEN lower(
                resource."title"
              ) =
              lower(${query})
              THEN 12
              WHEN lower(
                resource."title"
              )
              LIKE lower(
                ${`${query}%`}
              )
              THEN 7
              WHEN lower(
                resource."title"
              )
              LIKE lower(
                ${`%${query}%`}
              )
              THEN 4
              ELSE 0
            END

            +

            CASE
              WHEN
                resource."isPinned"
              THEN 0.5
              ELSE 0
            END
          )::double precision
            AS score

        FROM
          "LeagueResource"
            AS resource,
          search_query

        WHERE
          resource."leagueId" =
            ${leagueId}

          AND
          (
            resource."searchVector"
              @@ search_query.tsq

            OR

            COALESCE(
              resource."searchText",
              ''
            )
              ILIKE
              ${`%${query}%`}

            OR

            similarity(
              COALESCE(
                resource."searchText",
                ''
              ),
              search_query.needle
            ) >= 0.08
          )

        ORDER BY
          score DESC,
          resource."isPinned" DESC,
          resource."updatedAt" DESC

        LIMIT ${limit}
      `
    );

  const ids =
    rankedRows.map(
      (row) =>
        Number(row.id)
    );

  if (!ids.length) {
    return NextResponse.json({
      success: true,
      query,
      total: 0,
      resources: [],
    });
  }

  const resources =
    await prisma
      .leagueResource
      .findMany({
        where: {
          id: {
            in: ids,
          },

          leagueId,
        },

        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

  const resourceMap =
    new Map(
      resources.map(
        (resource) => [
          resource.id,
          resource,
        ]
      )
    );

  const scoreMap =
    new Map(
      rankedRows.map(
        (row) => [
          Number(row.id),
          Number(row.score || 0),
        ]
      )
    );

  const ordered =
    ids
      .map(
        (resourceId) =>
          resourceMap.get(
            resourceId
          )
      )
      .filter(Boolean)
      .map((resource) => ({
        ...resource,

        searchScore:
          scoreMap.get(
            resource.id
          ) || 0,

        searchSnippet:
          buildSearchSnippet(
            resource.searchText,
            query,
            [
              resource.description,
              resource.originalFileName,
              resource.externalUrl,
            ]
              .filter(Boolean)
              .join(" ")
          ),
      }));

  const [
    groupedCounts,
    userReactions,
  ] =
    await Promise.all([
      prisma
        .leagueResourceReaction
        .groupBy({
          by: [
            "resourceId",
            "reaction",
          ],

          where: {
            resourceId: {
              in: ids,
            },

            reaction: {
              in: [
                "UP",
                "DOWN",
              ],
            },
          },

          _count: {
            _all: true,
          },
        }),

      prisma
        .leagueResourceReaction
        .findMany({
          where: {
            resourceId: {
              in: ids,
            },

            userId,
          },

          select: {
            resourceId: true,
            reaction: true,
          },
        }),
    ]);

  return NextResponse.json({
    success: true,
    query,
    total:
      ordered.length,

    resources:
      addReactionSummary(
        ordered,
        groupedCounts,
        userReactions
      ),
  });
}
