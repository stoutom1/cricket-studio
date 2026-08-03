import { get } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getLeagueResourceAccess } from "@/lib/resources/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentDisposition(fileName, download) {
  const safeName = String(fileName || "download")
    .replace(/[\r\n"]/g, "_");

  return `${download ? "attachment" : "inline"}; filename="${safeName}"`;
}

export async function GET(request, { params }) {
  const { id, resourceId } = await params;
  const leagueId = Number(id);
  const numericResourceId = Number(resourceId);

  const resource = await prisma.leagueResource.findFirst({
    where: {
      id: numericResourceId,
      leagueId,
      resourceType: "FILE",
    },
  });

  if (!resource?.blobUrl) {
    return new NextResponse("Resource file not found.", {
      status: 404,
    });
  }

  if (resource.visibility !== "PUBLIC") {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

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

    if (!access.canView) {
      return NextResponse.json(
        { error: "You cannot access this file." },
        { status: 403 }
      );
    }
  }

  const result = await get(resource.blobUrl, {
    access: "private",
    ifNoneMatch:
      request.headers.get("if-none-match") || undefined,
  });

  if (!result) {
    return new NextResponse("Resource file not found.", {
      status: 404,
    });
  }

  if (result.statusCode === 304) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: result.blob.etag,
        "Cache-Control": "private, no-cache",
      },
    });
  }

  const download =
    new URL(request.url).searchParams.get("download") === "1";

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type":
        result.blob.contentType ||
        resource.contentType ||
        "application/octet-stream",
      "Content-Disposition": contentDisposition(
        resource.originalFileName,
        download
      ),
      "X-Content-Type-Options": "nosniff",
      ETag: result.blob.etag,
      "Cache-Control": "private, no-cache",
    },
  });
}
