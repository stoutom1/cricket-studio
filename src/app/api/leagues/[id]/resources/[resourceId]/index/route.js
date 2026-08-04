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

  if (!access.canAddEdit) {
    return NextResponse.json(
      {
        error:
          "Only league members can index Knowledge Center resources.",
      },
      {
        status: 403,
      }
    );
  }

  const existing =
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

  if (!existing) {
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

  try {
    const resource =
      await indexLeagueResource(
        numericResourceId,
        {
          extractFile: true,
        }
      );

    return NextResponse.json({
      success: true,
      resourceId:
        resource.id,
      searchStatus:
        resource.searchStatus,
      searchError:
        resource.searchError,
      searchIndexedAt:
        resource.searchIndexedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to index the resource.",
      },
      {
        status: 500,
      }
    );
  }
}
