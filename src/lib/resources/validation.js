export const LEAGUE_RESOURCE_CATEGORIES = [
  "RULES",
  "VENUES",
  "RESTAURANTS",
  "HOTELS",
  "CONTACTS",
  "FORMS",
  "SPONSORS",
  "TRAINING",
  "DOCUMENTS",
  "IMAGES",
  "VIDEOS",
  "LINKS",
  "OTHER",
];

export const LEAGUE_RESOURCE_VISIBILITIES = [
  "LEAGUE",
  "PUBLIC",
];

export const LEAGUE_RESOURCE_TYPES = [
  "FILE",
  "LINK",
];

export const LEAGUE_RESOURCE_ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
];

export const LEAGUE_RESOURCE_MAX_FILE_SIZE =
  25 * 1024 * 1024;

export function cleanText(value, maxLength = 500) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

export function normalizeCategory(value) {
  const normalized = cleanText(value, 30).toUpperCase();

  return LEAGUE_RESOURCE_CATEGORIES.includes(normalized)
    ? normalized
    : "OTHER";
}

export function normalizeVisibility(value) {
  const normalized = cleanText(value, 20).toUpperCase();

  return LEAGUE_RESOURCE_VISIBILITIES.includes(normalized)
    ? normalized
    : "LEAGUE";
}

export function normalizeResourceType(value) {
  const normalized = cleanText(value, 20).toUpperCase();

  return LEAGUE_RESOURCE_TYPES.includes(normalized)
    ? normalized
    : "LINK";
}

export function normalizeHttpUrl(value) {
  const raw = cleanText(value, 2000);

  if (!raw) return "";

  try {
    const parsed = new URL(raw);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

export function safeFileName(value) {
  const cleaned = cleanText(value, 180)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "resource-file";
}
