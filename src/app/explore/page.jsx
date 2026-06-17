import prisma from "@/lib/prisma";
import Link from "next/link";
import ExploreClient from "@/components/explore-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Explore Public Cricket Leagues | Cric4All",
  description:
    "Discover public cricket leagues, teams, matches, and live scoreboards on Cric4All.",
};

export default async function ExplorePage() {
  const leagues = await prisma.league.findMany({
    where: {
      visibility: "PUBLIC",
    },
    include: {
      teams: {
        include: {
          players: true,
        },
      },
      series: true,
      matches: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main className="explore-page">
      <section className="explore-hero">
        <span className="explore-badge">🌐 Public Leagues</span>
        <h1>Explore Cricket Leagues</h1>
        <p>
          Discover public cricket leagues, live matches, teams, series, and
          results powered by Cric4All.
        </p>
      </section>

{!leagues.length ? (
  <section className="explore-empty">
    <h2>No public leagues yet</h2>
    <p>
      Public leagues will appear here when league owners choose Public
      visibility.
    </p>
  </section>
) : (
  <ExploreClient leagues={leagues} />
)}
    </main>
  );
}