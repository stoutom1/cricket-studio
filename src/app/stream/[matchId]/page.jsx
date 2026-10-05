import StreamOverlayClient from "@/components/stream-overlay-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cric4All Live Stream Overlay",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function StreamOverlayPage({
  params,
}) {
  const { matchId } = await params;

  return (
    <StreamOverlayClient
      matchId={String(matchId || "")}
    />
  );
}
