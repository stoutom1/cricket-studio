import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import PublicLeagueViewClient from "@/components/public-league-view-client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  buildMatchStats,
  summarizeInningsDetailed,
  getBattingTeamId,
} from "@/lib/scoring";
import SeoJsonLd from "@/components/seo-json-ld";
import {
  absoluteCric4AllUrl,
  publicPageRobots,
} from "@/lib/seo";

export async function generateMetadata({ params }) {
  const { slug } = await params;

  const league = await prisma.league.findFirst({
    where: {
      slug,
      visibility: {
        in: ["PUBLIC", "UNLISTED"],
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
      createdAt: true,
      _count: {
        select: {
          teams: true,
          matches: true,
          leagueFollowers: true,
        },
      },
    },
  });

  if (!league) {
    return {
      title: "League Not Found | Cric4All",
    };
  }

  const isPublic =
    String(
      league.visibility ||
      ""
    ).toUpperCase() ===
    "PUBLIC";

  const canonical =
    absoluteCric4AllUrl(
      `/leagues/${league.slug}`
    );

  const description =
    `Follow ${league.name} on Cric4All: cricket matches, live scorecards, results, points table, teams, player statistics and league leaders. ${league._count.teams} team${league._count.teams === 1 ? "" : "s"} and ${league._count.matches} recorded match${league._count.matches === 1 ? "" : "es"}.`;

  return {
    title:
      `${league.name} Cricket League | Scores, Teams & Stats | Cric4All`,
    description,
    alternates: {
      canonical,
    },
    robots:
      publicPageRobots(
        isPublic
      ),
    openGraph: {
      title:
        `${league.name} Cricket League | Cric4All`,
      description,
      url:
        canonical,
      type:
        "website",
      siteName:
        "Cric4All",
    },
    twitter: {
      card:
        "summary",
      title:
        `${league.name} Cricket League | Cric4All`,
      description,
    },
  };
}

export default async function PublicLeaguePage({ params }) {
  const { slug } = await params;

  const league = await prisma.league.findFirst({
    where: {
      slug,
      visibility: {
        in: ["PUBLIC", "UNLISTED"],
      },
    },
    include: {
      series: {
        orderBy: [{ year: "desc" }, { name: "asc" }],
      },
      teams: {
        include: {
          players: {
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      },
      matches: {
        include: {
          teamA: true,
          teamB: true,
          series: true,
balls: {
  include: {
    striker: {
      include: {
        team: true,
      },
    },
    bowler: {
      include: {
        team: true,
      },
    },
  },
  orderBy: [
    { inningsNo: "asc" },
    { sequence: "asc" },
    { id: "asc" },
  ],
},
        },
        orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!league) {
    notFound();
  }

  const session = await getServerSession(authOptions);

let isFollowing = false;

if (session?.user?.email && league?.id) {
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (user) {
    const follow = await prisma.leagueFollower.findUnique({
      where: {
        userId_leagueId: {
          userId: user.id,
          leagueId: league.id,
        },
      },
    });

    isFollowing = Boolean(follow);
  }
}

const leagueForClient = {
  ...JSON.parse(
    JSON.stringify(
      league
    )
  ),
  id:
    Number(
      league.id
    ),
  leagueId:
    Number(
      league.id
    ),
  slug:
    String(
      league.slug ||
      slug
    ),
  isFollowing,
};

  const safeLeague = JSON.parse(JSON.stringify(league));

  const isPublic =
    String(
      league.visibility ||
      ""
    ).toUpperCase() ===
    "PUBLIC";

  const jsonLd =
    isPublic
      ? {
          "@context":
            "https://schema.org",
          "@type":
            "SportsOrganization",
          name:
            league.name,
          url:
            absoluteCric4AllUrl(
              `/leagues/${league.slug}`
            ),
          sport:
            "Cricket",
          description:
            `Public cricket league on Cric4All with ${league.teams.length} team${league.teams.length === 1 ? "" : "s"} and ${league.matches.length} recorded match${league.matches.length === 1 ? "" : "es"}.`,
          subOrganization:
            league.teams.map(
              (team) => ({
                "@type":
                  "SportsTeam",
                name:
                  team.name,
                sport:
                  "Cricket",
                url:
                  absoluteCric4AllUrl(
                    `/leagues/${league.slug}/teams/${team.id}`
                  ),
              })
            ),
        }
      : null;

  return (
    <>
      <SeoJsonLd
        data={
          jsonLd
        }
      />

      <PublicLeagueViewClient
        league={
          leagueForClient
        }
        numericLeagueId={
          Number(
            league.id
          )
        }
      />
    </>
  );
}