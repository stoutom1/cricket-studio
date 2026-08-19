export const CRIC4ALL_SITE_URL =
  String(
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://cric4all.app"
  )
    .trim()
    .replace(/\/+$/, "");

export function absoluteCric4AllUrl(path = "/") {
  const normalizedPath =
    String(path || "/").startsWith("/")
      ? String(path || "/")
      : `/${String(path || "")}`;

  return `${CRIC4ALL_SITE_URL}${normalizedPath}`;
}

export function publicPageRobots(isPublic) {
  if (!isPublic) {
    return {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
      },
    };
  }

  return {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  };
}

export function seoDate(value) {
  if (!value) {
    return undefined;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  return Number.isNaN(date.getTime())
    ? undefined
    : date.toISOString();
}
