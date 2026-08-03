import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getLeagueResourceAccess } from "@/lib/resources/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function resolveRequest(params) {
  const { id, resourceId } = await params;
  const session = await getServerSession(authOptions);

  return {
    leagueId: validPositiveInteger(id),
    resourceId: validPositiveInteger(resourceId),
    userId: session?.user?.id || null,
  };
}

async function reactionSummary(resourceId, userId) {
  const [counts, mine] = await Promise.all([
    prisma.leagueResourceReaction.groupBy({
      by: ["reaction"],
      where: {
        resourceId,
        reaction: { in: ["UP", "DOWN"] },
      },
      _count: { _all: true },
    }),
    prisma.leagueResourceReaction.findUnique({
      where: {
        resourceId_userId: { resourceId, userId },
      },
      select: { reaction: true },
    }),
  ]);

  let upCount = 0;
  let downCount = 0;

  for (const count of counts) {
    if (count.reaction === "UP") upCount = count._count._all;
    if (count.reaction === "DOWN") downCount = count._count._all;
  }

  return {
    upCount,
    downCount,
    myReaction: mine?.reaction || null,
  };
}

async function validateAccess({ leagueId, resourceId, userId }) {
  if (!userId) {
    return { error: "Unauthorized.", status: 401 };
  }

  if (!leagueId || !resourceId) {
    return { error: "Invalid league or resource.", status: 400 };
  }

  const access = await getLeagueResourceAccess({ leagueId, userId });

  if (!access.exists) {
    return { error: "League not found.", status: 404 };
  }

  if (!access.canView) {
    return { error: "You do not have access to this league.", status: 403 };
  }

  const resource = await prisma.leagueResource.findFirst({
    where: { id: resourceId, leagueId },
    select: { id: true },
  });

  if (!resource) {
    return { error: "Resource not found.", status: 404 };
  }

  return { access, resource };
}

export async function POST(request, { params }) {
  const resolved = await resolveRequest(params);
  const validation = await validateAccess(resolved);

  if (validation.error) {
    return NextResponse.json(
      { error: validation.error },
      { status: validation.status }
    );
  }

  const body = await request.json();
  const reaction = String(body?.reaction || "")
    .trim()
    .toUpperCase();

  if (!['UP', 'DOWN'].includes(reaction)) {
    return NextResponse.json(
      { error: "Reaction must be UP or DOWN." },
      { status: 400 }
    );
  }

  const existing = await prisma.leagueResourceReaction.findUnique({
    where: {
      resourceId_userId: {
        resourceId: resolved.resourceId,
        userId: resolved.userId,
      },
    },
    select: { id: true, reaction: true },
  });

  if (existing?.reaction === reaction) {
    await prisma.leagueResourceReaction.delete({
      where: { id: existing.id },
    });
  } else {
    await prisma.leagueResourceReaction.upsert({
      where: {
        resourceId_userId: {
          resourceId: resolved.resourceId,
          userId: resolved.userId,
        },
      },
      create: {
        resourceId: resolved.resourceId,
        userId: resolved.userId,
        reaction,
      },
      update: { reaction },
    });
  }

  return NextResponse.json({
    success: true,
    ...(await reactionSummary(
      resolved.resourceId,
      resolved.userId
    )),
  });
}

export async function DELETE(request, { params }) {
  const resolved = await resolveRequest(params);
  const validation = await validateAccess(resolved);

  if (validation.error) {
    return NextResponse.json(
      { error: validation.error },
      { status: validation.status }
    );
  }

  await prisma.leagueResourceReaction.deleteMany({
    where: {
      resourceId: resolved.resourceId,
      userId: resolved.userId,
    },
  });

  return NextResponse.json({
    success: true,
    ...(await reactionSummary(
      resolved.resourceId,
      resolved.userId
    )),
  });
}
