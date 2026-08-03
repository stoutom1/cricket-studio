import { handleUpload } from "@vercel/blob/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getLeagueResourceAccess } from "@/lib/resources/access";
import {
  LEAGUE_RESOURCE_ALLOWED_CONTENT_TYPES,
  LEAGUE_RESOURCE_MAX_FILE_SIZE,
} from "@/lib/resources/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const { id } = await params;
  const leagueId = Number(id);
  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id;

        if (!userId) {
          throw new Error("Unauthorized upload request.");
        }

        const access = await getLeagueResourceAccess({
          leagueId,
          userId,
        });

        if (!access.exists || !access.canManage) {
          throw new Error(
            "You do not have permission to upload league resources."
          );
        }

        const expectedPrefix = `league-resources/${leagueId}/`;

        if (!String(pathname).startsWith(expectedPrefix)) {
          throw new Error("Invalid upload destination.");
        }

        return {
          allowedContentTypes:
            LEAGUE_RESOURCE_ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes:
            LEAGUE_RESOURCE_MAX_FILE_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            leagueId,
            uploadedById: userId,
          }),
        };
      },
      onUploadCompleted: async () => {
        // The browser creates the LeagueResource metadata row
        // immediately after the private Blob upload succeeds.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[LEAGUE_RESOURCE_UPLOAD_FAILED]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to authorize the upload.",
      },
      { status: 400 }
    );
  }
}
