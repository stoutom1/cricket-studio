import {
  absoluteCric4AllUrl,
} from "@/lib/seo";

export default function robots() {
  return {
    rules: [
      {
        userAgent:
          "*",
        allow:
          "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/dashboard/",
          "/login",
          "/register",
          "/reset-password",
        ],
      },
    ],
    sitemap:
      absoluteCric4AllUrl(
        "/sitemap.xml"
      ),
    host:
      absoluteCric4AllUrl(
        "/"
      ),
  };
}
