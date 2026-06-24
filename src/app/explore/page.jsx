import prisma from "@/lib/prisma";
import ExploreClient from "@/components/explore-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Explore Public Cricket Leagues | Cric4All",
  description:
    "Discover public cricket leagues, teams, matches, and live scoreboards on Cric4All.",
};

export default async function ExplorePage() {
  const leagues = await prisma.league.findMany({
    where: { visibility: "PUBLIC" },
    include: {
      teams: { include: { players: true } },
      series: true,
      matches: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return <ExploreClient leagues={leagues} />;
}