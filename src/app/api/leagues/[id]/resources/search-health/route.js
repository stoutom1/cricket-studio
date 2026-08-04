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
export const revalidate = 0;

const KNOWN_STATUSES =
  new Set([
    "READY",
    "PENDING",
    "INDEXING",
    "METADATA_ONLY",
    "FAILED",
  ]);

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

  if (
    !Number.isInteger(
      leagueId
    ) ||
    leagueId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid league ID.",
      },
      {
        status: 400,
      }
    );
  }

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

  if (!access.canDelete) {
    return NextResponse.json(
      {
        error:
          "Search health requires permission-management access.",
      },
      {
        status: 403,
      }
    );
  }

  const resources =
    await prisma
      .leagueResource
      .findMany({
        where: {
          leagueId,
        },

        orderBy: [
          {
            searchStatus:
              "asc",
          },
          {
            updatedAt:
              "desc",
          },
        ],

        select: {
          id: true,
          title: true,
          resourceType: true,
          originalFileName: true,
          externalUrl: true,
          contentType: true,
          fileSize: true,
          searchStatus: true,
          searchError: true,
          searchIndexedAt: true,
          updatedAt: true,
        },
      });

  const summary = {
    total:
      resources.length,
    ready: 0,
    pending: 0,
    indexing: 0,
    metadataOnly: 0,
    failed: 0,
  };

  for (
    const resource of
    resources
  ) {
    const status =
      KNOWN_STATUSES.has(
        resource.searchStatus
      )
        ? resource.searchStatus
        : "PENDING";

    if (status === "READY") {
      summary.ready += 1;
    } else if (
      status === "INDEXING"
    ) {
      summary.indexing += 1;
    } else if (
      status ===
      "METADATA_ONLY"
    ) {
      summary.metadataOnly += 1;
    } else if (
      status === "FAILED"
    ) {
      summary.failed += 1;
    } else {
      summary.pending += 1;
    }
  }

  const statusPriority = {
    FAILED: 0,
    PENDING: 1,
    INDEXING: 2,
    METADATA_ONLY: 3,
    READY: 4,
  };

  const orderedResources =
    [...resources].sort(
      (left, right) => {
        const leftPriority =
          statusPriority[
            left.searchStatus
          ] ?? 1;

        const rightPriority =
          statusPriority[
            right.searchStatus
          ] ?? 1;

        if (
          leftPriority !==
          rightPriority
        ) {
          return (
            leftPriority -
            rightPriority
          );
        }

        return (
          new Date(
            right.updatedAt
          ).getTime() -
          new Date(
            left.updatedAt
          ).getTime()
        );
      }
    );

  return NextResponse.json({
    success: true,
    league: {
      id:
        access.league.id,
      name:
        access.league.name,
    },
    summary,
    resources:
      orderedResources,
    checkedAt:
      new Date().toISOString(),
  });
}
