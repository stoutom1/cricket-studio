import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  addResourcePersonalization,
  getResourcePersonalization,
} from "@/lib/resources/personalization";
import { getLeagueResourceAccess } from "@/lib/resources/access";
import {
  indexLeagueResource,
} from "@/lib/resources/indexer";
import {
  resourceSearchText,
} from "@/lib/resources/search";
import {
  cleanText,
  normalizeCategory,
  normalizeHttpUrl,
  normalizeResourceType,
  normalizeVisibility,
} from "@/lib/resources/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getCurrentUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id || null;
}

function addReactionSummary(resources, groupedCounts, userReactions) {
  const countMap = new Map();

  for (const row of groupedCounts) {
    const key = `${row.resourceId}:${row.reaction}`;
    countMap.set(key, row._count?._all || 0);
  }

  const myReactionMap = new Map(
    userReactions.map((row) => [row.resourceId, row.reaction])
  );

  return resources.map((resource) => ({
    ...resource,
    upCount: countMap.get(`${resource.id}:UP`) || 0,
    downCount: countMap.get(`${resource.id}:DOWN`) || 0,
    myReaction: myReactionMap.get(resource.id) || null,
  }));
}

export async function GET(request, { params }) {
  const { id } = await params;
  const leagueId = Number(id);
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const access = await getLeagueResourceAccess({
    leagueId,
    userId,
  });

  if (!access.exists) {
    return NextResponse.json(
      { error: "League not found." },
      { status: 404 }
    );
  }

  if (!access.canView) {
    return NextResponse.json(
      { error: "You do not have access to this league." },
      { status: 403 }
    );
  }

  const resources = await prisma.leagueResource.findMany({
    where: { leagueId },
    orderBy: [
      { isPinned: "desc" },
      { sortOrder: "asc" },
      { updatedAt: "desc" },
    ],
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

  const resourceIds = resources.map((resource) => resource.id);

  const [
    groupedCounts,
    userReactions,
    personalization,
  ] = resourceIds.length
    ? await Promise.all([
        prisma.leagueResourceReaction.groupBy({
          by: ["resourceId", "reaction"],
          where: {
            resourceId: { in: resourceIds },
            reaction: { in: ["UP", "DOWN"] },
          },
          _count: { _all: true },
        }),
        prisma.leagueResourceReaction.findMany({
          where: {
            resourceId: { in: resourceIds },
            userId,
          },
          select: {
            resourceId: true,
            reaction: true,
          },
        }),
        getResourcePersonalization({
          resourceIds,
          userId,
          leagueId,
        }),
      ])
    : [
        [],
        [],
        await getResourcePersonalization({
          resourceIds: [],
          userId,
          leagueId,
        }),
      ];

  const summarizedResources =
    addReactionSummary(
      resources,
      groupedCounts,
      userReactions
    );

  return NextResponse.json({
    success: true,
    league: access.league,
    canAddEdit:
      access.canAddEdit,
    canDelete:
      access.canDelete,

    /*
     * Backward-compatible response field.
     */
    canManage:
      access.canAddEdit,

    collections:
      personalization.collections,

    resources:
      addResourcePersonalization(
        summarizedResources,
        personalization
      ),
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const leagueId = Number(id);
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const access = await getLeagueResourceAccess({
    leagueId,
    userId,
  });

  if (!access.exists) {
    return NextResponse.json(
      { error: "League not found." },
      { status: 404 }
    );
  }

  if (!access.canAddEdit) {
    return NextResponse.json(
      {
        error:
          "Only league members can add Knowledge Center resources.",
      },
      {
        status: 403,
      }
    );
  }

  const body = await request.json();
  const resourceType = normalizeResourceType(body.resourceType);
  const title = cleanText(body.title, 160);
  const description = cleanText(body.description, 1200) || null;
  const category = normalizeCategory(body.category);
  const visibility = normalizeVisibility(body.visibility);

  if (!title) {
    return NextResponse.json(
      { error: "Resource title is required." },
      { status: 400 }
    );
  }

  let data = {
    leagueId,
    createdById: userId,
    title,
    description,
    category,
    resourceType,
    visibility,
    isPinned: body.isPinned === true,
    sortOrder: Number.isInteger(Number(body.sortOrder))
      ? Number(body.sortOrder)
      : 0,
  };

  if (resourceType === "LINK") {
    const externalUrl = normalizeHttpUrl(body.externalUrl);

    if (!externalUrl) {
      return NextResponse.json(
        { error: "Enter a valid http or https link." },
        { status: 400 }
      );
    }

    data = {
      ...data,
      externalUrl,
      searchStatus:
        "READY",
    };
  } else {
    const blobUrl = cleanText(body.blobUrl, 2000);
    const blobPathname = cleanText(body.blobPathname, 1000);
    const originalFileName = cleanText(body.originalFileName, 255);
    const contentType = cleanText(body.contentType, 150);
    const fileSize = Number(body.fileSize);

    if (!blobUrl || !blobPathname || !originalFileName) {
      return NextResponse.json(
        { error: "Uploaded file details are incomplete." },
        { status: 400 }
      );
    }

    data = {
      ...data,
      blobUrl,
      blobPathname,
      originalFileName,
      contentType: contentType || null,
      fileSize:
        Number.isFinite(fileSize) && fileSize >= 0
          ? Math.round(fileSize)
          : null,

      searchStatus:
        "PENDING",
    };
  }

  data.searchText =
    resourceSearchText(
      data,
      ""
    ) || null;

  let resource =
    await prisma
      .leagueResource
      .create({
        data,
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

  try {
    await indexLeagueResource(
      resource.id,
      {
        extractFile:
          resourceType ===
          "FILE",
      }
    );

    resource =
      await prisma
        .leagueResource
        .findUnique({
          where: {
            id:
              resource.id,
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
  } catch (indexError) {
    console.error(
      "[LEAGUE_RESOURCE_INDEX_FAILED]",
      {
        resourceId:
          resource.id,

        error:
          indexError instanceof Error
            ? indexError.message
            : String(
                indexError
              ),
      }
    );
  }

  return NextResponse.json(
    {
      success: true,
      resource: {
        ...resource,
        upCount: 0,
        downCount: 0,
        myReaction: null,
      },
    },
    { status: 201 }
  );
}
