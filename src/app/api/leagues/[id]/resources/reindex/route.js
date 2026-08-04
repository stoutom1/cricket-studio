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
  indexLeagueResource,
} from "@/lib/resources/indexer";

export const runtime =
  "nodejs";
export const dynamic =
  "force-dynamic";
export const maxDuration = 60;

export async function POST(
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

  if (!access.canDelete) {
    return NextResponse.json(
      {
        error:
          "Rebuilding the league search index requires permission-management access.",
      },
      {
        status: 403,
      }
    );
  }

  const url =
    new URL(request.url);

  const requestedLimit =
    Number(
      url.searchParams.get(
        "limit"
      ) || 20
    );

  const requestedAfterId =
    Number(
      url.searchParams.get(
        "afterId"
      ) || 0
    );

  const limit =
    Number.isInteger(
      requestedLimit
    )
      ? Math.min(
          Math.max(
            requestedLimit,
            1
          ),
          50
        )
      : 20;

  const afterId =
    Number.isInteger(
      requestedAfterId
    ) &&
    requestedAfterId > 0
      ? requestedAfterId
      : 0;

  const resources =
    await prisma
      .leagueResource
      .findMany({
        where: {
          leagueId,

          ...(afterId > 0
            ? {
                id: {
                  gt: afterId,
                },
              }
            : {}),
        },

        orderBy: {
          id: "asc",
        },

        take:
          limit + 1,

        select: {
          id: true,
          title: true,
        },
      });

  const hasMore =
    resources.length >
    limit;

  const batch =
    hasMore
      ? resources.slice(
          0,
          limit
        )
      : resources;

  const summary = {
    checked:
      batch.length,
    indexed: 0,
    metadataOnly: 0,
    failed: 0,
    details: [],
  };

  for (
    const resource of
    batch
  ) {
    try {
      const indexed =
        await indexLeagueResource(
          resource.id,
          {
            extractFile: true,
          }
        );

      if (
        indexed.searchStatus ===
        "METADATA_ONLY"
      ) {
        summary.metadataOnly += 1;
      } else {
        summary.indexed += 1;
      }

      summary.details.push({
        resourceId:
          resource.id,
        title:
          resource.title,
        status:
          indexed.searchStatus,
        error:
          indexed.searchError,
      });
    } catch (error) {
      summary.failed += 1;

      summary.details.push({
        resourceId:
          resource.id,
        title:
          resource.title,
        status:
          "FAILED",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  const nextAfterId =
    batch.length
      ? batch[
          batch.length - 1
        ].id
      : afterId;

  return NextResponse.json({
    success:
      summary.failed === 0,

    summary,

    pagination: {
      limit,
      afterId,
      nextAfterId,
      hasMore,
    },
  });
}
