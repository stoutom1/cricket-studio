import { del } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getLeagueResourceAccess } from "@/lib/resources/access";
import {
  cleanText,
  normalizeCategory,
  normalizeHttpUrl,
  normalizeVisibility,
} from "@/lib/resources/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveRequest(params) {
  const { id, resourceId } = await params;
  const leagueId = Number(id);
  const numericResourceId = Number(resourceId);
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || null;

  return {
    leagueId,
    resourceId: numericResourceId,
    userId,
  };
}

export async function PATCH(request, { params }) {
  const { leagueId, resourceId, userId } =
    await resolveRequest(params);

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

  if (!access.canManage) {
    return NextResponse.json(
      { error: "You cannot edit league resources." },
      { status: 403 }
    );
  }

  const existing = await prisma.leagueResource.findFirst({
    where: {
      id: resourceId,
      leagueId,
    },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Resource not found." },
      { status: 404 }
    );
  }

  const body = await request.json();
  const title = cleanText(body.title, 160);

  if (!title) {
    return NextResponse.json(
      { error: "Resource title is required." },
      { status: 400 }
    );
  }

  const data = {
    title,
    description: cleanText(body.description, 1200) || null,
    category: normalizeCategory(body.category),
    visibility: normalizeVisibility(body.visibility),
    isPinned: body.isPinned === true,
  };

  if (existing.resourceType === "LINK") {
    const externalUrl = normalizeHttpUrl(body.externalUrl);

    if (!externalUrl) {
      return NextResponse.json(
        { error: "Enter a valid http or https link." },
        { status: 400 }
      );
    }

    data.externalUrl = externalUrl;
  }

  const resource = await prisma.leagueResource.update({
    where: { id: resourceId },
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

  return NextResponse.json({
    success: true,
    resource,
  });
}

export async function DELETE(request, { params }) {
  const { leagueId, resourceId, userId } =
    await resolveRequest(params);

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

  if (!access.canManage) {
    return NextResponse.json(
      { error: "You cannot delete league resources." },
      { status: 403 }
    );
  }

  const existing = await prisma.leagueResource.findFirst({
    where: {
      id: resourceId,
      leagueId,
    },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Resource not found." },
      { status: 404 }
    );
  }

  await prisma.leagueResource.delete({
    where: { id: resourceId },
  });

  if (existing.blobUrl) {
    try {
      await del(existing.blobUrl);
    } catch (error) {
      console.error(
        "[LEAGUE_RESOURCE_BLOB_DELETE_FAILED]",
        {
          resourceId,
          blobUrl: existing.blobUrl,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        }
      );
    }
  }

  return NextResponse.json({
    success: true,
    deletedId: resourceId,
  });
}
