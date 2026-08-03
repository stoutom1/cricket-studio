import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getLeagueResourceAccess } from "@/lib/resources/access";
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

  return NextResponse.json({
    success: true,
    league: access.league,
    canManage: access.canManage,
    resources,
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

  if (!access.canManage) {
    return NextResponse.json(
      { error: "You cannot add league resources." },
      { status: 403 }
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
    };
  }

  const resource = await prisma.leagueResource.create({
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

  return NextResponse.json(
    { success: true, resource },
    { status: 201 }
  );
}
