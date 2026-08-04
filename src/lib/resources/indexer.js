import prisma from "@/lib/prisma";

import {
  extractLeagueResourceText,
} from "@/lib/resources/extract-text";
import {
  resourceSearchText,
} from "@/lib/resources/search";

export async function indexLeagueResource(
  resourceId,
  {
    extractFile = true,
  } = {}
) {
  const numericId =
    Number(resourceId);

  if (
    !Number.isInteger(
      numericId
    ) ||
    numericId <= 0
  ) {
    throw new Error(
      "Invalid resource ID."
    );
  }

  const resource =
    await prisma
      .leagueResource
      .findUnique({
        where: {
          id: numericId,
        },
      });

  if (!resource) {
    throw new Error(
      "Resource not found."
    );
  }

  await prisma
    .leagueResource
    .update({
      where: {
        id: numericId,
      },
      data: {
        searchStatus:
          "INDEXING",
        searchError:
          null,
      },
    });

  try {
    let extractedText =
      resource
        .extractedText ||
      "";

    let searchStatus =
      "READY";

    let searchError =
      null;

    if (
      extractFile &&
      resource
        .resourceType ===
        "FILE"
    ) {
      const extraction =
        await extractLeagueResourceText(
          resource
        );

      extractedText =
        extraction.text || "";

      searchStatus =
        extraction.status;

      searchError =
        extraction.reason;
    }

    const searchText =
      resourceSearchText(
        resource,
        extractedText
      );

    return prisma
      .leagueResource
      .update({
        where: {
          id: numericId,
        },
        data: {
          extractedText:
            extractedText ||
            null,

          searchText:
            searchText ||
            null,

          searchStatus,

          searchError,

          searchIndexedAt:
            new Date(),
        },
      });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    /*
     * Keep metadata searchable even when content extraction fails.
     */
    const metadataSearchText =
      resourceSearchText(
        resource,
        resource
          .extractedText ||
          ""
      );

    await prisma
      .leagueResource
      .update({
        where: {
          id: numericId,
        },
        data: {
          searchText:
            metadataSearchText ||
            null,

          searchStatus:
            "FAILED",

          searchError:
            message.slice(
              0,
              1000
            ),

          searchIndexedAt:
            new Date(),
        },
      });

    throw error;
  }
}
