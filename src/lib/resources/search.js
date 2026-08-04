const SEARCH_TEXT_LIMIT =
  Number(
    process.env
      .LEAGUE_RESOURCE_SEARCH_MAX_CHARS ||
      250000
  );

export function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^\p{L}\p{N}@._:/+-]+/gu,
      " "
    )
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function cleanExtractedText(value) {
  return String(value || "")
    .replace(/\u0000/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(
      0,
      Number.isFinite(
        SEARCH_TEXT_LIMIT
      )
        ? SEARCH_TEXT_LIMIT
        : 250000
    );
}

export function resourceSearchText(
  resource,
  extractedText = ""
) {
  let hostname = "";

  if (resource?.externalUrl) {
    try {
      hostname =
        new URL(
          resource.externalUrl
        ).hostname;
    } catch {
      hostname = "";
    }
  }

  return cleanExtractedText(
    [
      resource?.title,
      resource?.description,
      resource?.category,
      resource?.resourceType,
      resource?.visibility,
      resource?.originalFileName,
      resource?.contentType,
      resource?.externalUrl,
      hostname,
      extractedText,
    ]
      .filter(Boolean)
      .join("\n")
  );
}

export function searchTerms(value) {
  return normalizeSearchText(value)
    .split(" ")
    .map((term) => term.trim())
    .filter((term) => term.length > 1)
    .slice(0, 12);
}

export function buildSearchSnippet(
  searchText,
  query,
  fallback = ""
) {
  const source =
    cleanExtractedText(
      searchText || fallback
    );

  if (!source) {
    return "";
  }

  const normalizedSource =
    normalizeSearchText(source);

  const terms =
    searchTerms(query);

  let matchIndex = -1;

  for (const term of terms) {
    const index =
      normalizedSource.indexOf(
        term
      );

    if (
      index >= 0 &&
      (
        matchIndex < 0 ||
        index < matchIndex
      )
    ) {
      matchIndex = index;
    }
  }

  if (matchIndex < 0) {
    return source
      .replace(/\s+/g, " ")
      .slice(0, 190);
  }

  const start =
    Math.max(
      0,
      matchIndex - 70
    );

  const end =
    Math.min(
      source.length,
      matchIndex + 170
    );

  return [
    start > 0 ? "…" : "",
    source
      .slice(start, end)
      .replace(/\s+/g, " ")
      .trim(),
    end < source.length
      ? "…"
      : "",
  ].join("");
}
