import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import PublicLeagueViewClient from "@/components/public-league-view-client";
import {
  buildMatchStats,
  summarizeInningsDetailed,
  getBattingTeamId,
} from "@/lib/scoring";

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
      name: true,
      visibility: true,
    },
  });

  if (!league) {
    return {
      title: "League Not Found | Cric4All",
    };
  }

  return {
    title: `${league.name} | Cric4All`,
    description: `Follow ${league.name} cricket matches, scorecards, points table, stats, teams, and leaders on Cric4All.`,
    openGraph: {
      title: `${league.name} | Cric4All`,
      description: `Live cricket league portal for ${league.name}.`,
      type: "website",
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

  const safeLeague = JSON.parse(JSON.stringify(league));

  return <PublicLeagueViewClient league={safeLeague} />;
}