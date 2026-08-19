import LiveScoreClient from "./LiveScoreClient";
import prisma from "@/lib/prisma";
import {
  absoluteCric4AllUrl,
} from "@/lib/seo";

export async function generateMetadata({
  params,
}) {
  const {
    matchId: shareCode,
  } = await params;

  const match =
    await prisma.match.findUnique({
      where: {
        shareCode:
          String(
            shareCode ||
            ""
          ),
      },
      select: {
        id: true,
        statusText: true,
        teamA: {
          select: {
            name: true,
          },
        },
        teamB: {
          select: {
            name: true,
          },
        },
        league: {
          select: {
            slug: true,
            visibility: true,
          },
        },
      },
    });

  const teamA =
    match?.teamA?.name ||
    "Team A";

  const teamB =
    match?.teamB?.name ||
    "Team B";

  const publicCanonical =
    match?.league?.slug &&
    String(
      match.league.visibility ||
      ""
    ).toUpperCase() ===
      "PUBLIC"
      ? absoluteCric4AllUrl(
          `/leagues/${match.league.slug}/matches/${match.id}`
        )
      : absoluteCric4AllUrl(
          "/"
        );

  const statusText =
    String(
      match?.statusText ||
      ""
    ).trim();

  const description =
    statusText &&
    ![
      "LIVE",
      "SCHEDULED",
      "MATCH COMPLETED",
    ].includes(
      statusText.toUpperCase()
    )
      ? `${teamA} vs ${teamB}: ${statusText}. Follow the Cric4All scorecard and match details.`
      : `Follow ${teamA} vs ${teamB} live on Cric4All with score, scorecard and ball-by-ball match updates.`;

  return {
    title:
      `${teamA} vs ${teamB} Live Cricket Score | Cric4All`,
    description,
    robots: {
      index: false,
      follow: true,
      nocache: true,
    },
    alternates: {
      canonical:
        publicCanonical,
    },
    openGraph: {
      title:
        `${teamA} vs ${teamB} | Cric4All Live Score`,
      description,
      url:
        absoluteCric4AllUrl(
          `/live/${shareCode}`
        ),
      type:
        "website",
      siteName:
        "Cric4All",
    },
    twitter: {
      card:
        "summary",
      title:
        `${teamA} vs ${teamB} | Cric4All Live Score`,
      description,
    },
  };
}

export default async function Page({
  params,
}) {
  const {
    matchId,
  } = await params;

  return (
    <LiveScoreClient
      matchId={
        matchId
      }
    />
  );
}
