import prisma from "@/lib/prisma";
import ExploreClient from "@/components/explore-client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Explore Public Cricket Leagues | Cric4All",
  description:
    "Discover public cricket leagues, teams, matches, and live scoreboards on Cric4All.",
};

export default async function ExplorePage() {
  const session = await getServerSession(authOptions);

let followedLeagueIds = [];
if (session?.user?.email) {
  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    include: {
      leagueFollowers: true,
    },
  });

  followedLeagueIds =
    user?.leagueFollowers?.map(
      (f) => f.leagueId
    ) || [];
}
  const leagues = await prisma.league.findMany({
    where: { visibility: "PUBLIC" },
    include: {
      teams: { include: { players: true } },
      series: true,
      matches: true,
    },
    orderBy: { createdAt: "desc" },
  });
const leaguesWithFollow = leagues.map((league) => ({
  ...league,
  isFollowing: followedLeagueIds.includes(
    league.id
  ),
}));


  return <ExploreClient leagues={leaguesWithFollow} />;
}