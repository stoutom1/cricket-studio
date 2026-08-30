import { getAdsTxtPublisherId } from "@/lib/ads";

export const dynamic = "force-dynamic";

export async function GET() {
  const publisherId = getAdsTxtPublisherId();

  const body = publisherId
    ? `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`
    : [
        "# Cric4All ads.txt",
        "# Configure NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT=ca-pub-...",
        "# (or GOOGLE_ADSENSE_PUBLISHER_ID=pub-...) before enabling ads.",
        "",
      ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
