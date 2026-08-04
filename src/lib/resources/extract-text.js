import {
  get,
} from "@vercel/blob";

import {
  cleanExtractedText,
} from "@/lib/resources/search";

const MAX_INDEX_BYTES =
  Number(
    process.env
      .LEAGUE_RESOURCE_SEARCH_MAX_BYTES ||
      15 * 1024 * 1024
  );

const TEXT_CONTENT_TYPES =
  new Set([
    "text/plain",
    "text/csv",
    "text/html",
    "text/xml",
    "application/json",
    "application/xml",
  ]);

function extensionOf(fileName) {
  const value =
    String(fileName || "")
      .toLowerCase();

  const index =
    value.lastIndexOf(".");

  return index >= 0
    ? value.slice(index)
    : "";
}

async function streamToBuffer(
  stream
) {
  const response =
    new Response(stream);

  const arrayBuffer =
    await response.arrayBuffer();

  return Buffer.from(
    arrayBuffer
  );
}

async function extractPdf(buffer) {
  const {
    PDFParse,
  } =
    await import(
      "pdf-parse"
    );

  const parser =
    new PDFParse({
      data:
        new Uint8Array(
          buffer
        ),
    });

  try {
    const result =
      await parser.getText();

    return result?.text || "";
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer) {
  const imported =
    await import("mammoth");

  const mammoth =
    imported.default ||
    imported;

  const result =
    await mammoth
      .extractRawText({
        buffer,
      });

  return result?.value || "";
}

function extractionType(
  resource
) {
  const contentType =
    String(
      resource?.contentType ||
      ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

  const extension =
    extensionOf(
      resource
        ?.originalFileName
    );

  if (
    contentType ===
      "application/pdf" ||
    extension === ".pdf"
  ) {
    return "PDF";
  }

  if (
    contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === ".docx"
  ) {
    return "DOCX";
  }

  if (
    TEXT_CONTENT_TYPES.has(
      contentType
    ) ||
    [
      ".txt",
      ".csv",
      ".json",
      ".html",
      ".htm",
      ".xml",
      ".md",
    ].includes(extension)
  ) {
    return "TEXT";
  }

  return "UNSUPPORTED";
}

export async function extractLeagueResourceText(
  resource
) {
  if (
    resource?.resourceType !==
      "FILE" ||
    !resource?.blobUrl
  ) {
    return {
      text: "",
      status: "READY",
      reason: null,
    };
  }

  const type =
    extractionType(resource);

  if (
    type === "UNSUPPORTED"
  ) {
    return {
      text: "",
      status:
        "METADATA_ONLY",
      reason:
        "File contents are not indexed for this file type.",
    };
  }

  const fileSize =
    Number(
      resource.fileSize || 0
    );

  if (
    fileSize > MAX_INDEX_BYTES
  ) {
    return {
      text: "",
      status:
        "METADATA_ONLY",
      reason:
        `File exceeds the ${Math.round(
          MAX_INDEX_BYTES /
            1024 /
            1024
        )} MB text-indexing limit.`,
    };
  }

  const result =
    await get(
      resource.blobUrl,
      {
        access: "private",
      }
    );

  if (!result?.stream) {
    throw new Error(
      "The private Blob file could not be retrieved for indexing."
    );
  }

  const buffer =
    await streamToBuffer(
      result.stream
    );

  let text = "";

  if (type === "PDF") {
    text =
      await extractPdf(
        buffer
      );
  } else if (
    type === "DOCX"
  ) {
    text =
      await extractDocx(
        buffer
      );
  } else {
    text =
      new TextDecoder(
        "utf-8",
        {
          fatal: false,
        }
      ).decode(buffer);
  }

  return {
    text:
      cleanExtractedText(
        text
      ),
    status: "READY",
    reason: null,
  };
}
