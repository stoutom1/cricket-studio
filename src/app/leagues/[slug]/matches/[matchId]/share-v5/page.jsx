import {
  notFound,
} from "next/navigation";
import prisma from "@/lib/prisma";
import {
  buildPublicMatchResult,
} from "@/lib/public-match-result";
import {
  absoluteCric4AllUrl,
} from "@/lib/seo";
import ShareRedirect from "./share-redirect";

async function getShareMatch(
  slug,
  matchId
) {
  const id =
    Number(matchId);

  if (
    !slug ||
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  const league =
    await prisma.league.findFirst({
      where: {
        slug:
          String(slug),
        visibility: {
          in: [
            "PUBLIC",
            "UNLISTED",
          ],
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        matches: {
          where: {
            id,
          },
          take: 1,
          select: {
            id: true,
            status: true,
            statusText: true,
            battingFirstTeamId: true,
            maxWicketsPerInnings: true,
            teamAId: true,
            teamBId: true,
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
            balls: {
              select: {
                inningsNo: true,
                totalRuns: true,
                isWicket: true,
                wicketType: true,
                legalDelivery: true,
              },
            },
          },
        },
      },
    });

  const match =
    league?.matches?.[0];

  if (!league || !match) {
    return null;
  }

  return {
    league,
    match,
  };
}

export async function generateMetadata({
  params,
}) {
  const {
    slug,
    matchId,
  } = await params;

  const data =
    await getShareMatch(
      slug,
      matchId
    );

  if (!data) {
    return {
      title:
        "Cric4All Match Result",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const {
    league,
    match,
  } = data;

  const teamA =
    match.teamA?.name ||
    "Team A";

  const teamB =
    match.teamB?.name ||
    "Team B";

  const result =
    buildPublicMatchResult(
      match
    );

  const canonical =
    absoluteCric4AllUrl(
      `/leagues/${league.slug}/matches/${match.id}`
    );

  const shareUrl =
    absoluteCric4AllUrl(
      `/leagues/${league.slug}/matches/${match.id}/share-v5`
    );

  const imageUrl =
    absoluteCric4AllUrl(
      `/leagues/${league.slug}/matches/${match.id}/share-card-v5.png`
    );

  const title =
    `${teamA} vs ${teamB} | ${league.name}`;

  const description =
    `${result}. View the full cricket scorecard on Cric4All.`;

  return {
    title:
      `${title} | Cric4All`,

    description,

    alternates: {
      canonical,
    },

    robots: {
      index: false,
      follow: true,
    },

    openGraph: {
      title,
      description,
      url:
        shareUrl,
      siteName:
        "Cric4All",
      type:
        "website",
      images: [
        {
          url:
            imageUrl,
          secureUrl:
            imageUrl,
          width:
            1200,
          height:
            630,
          type:
            "image/png",
          alt:
            `${teamA} vs ${teamB} Cric4All result`,
        },
      ],
    },

    twitter: {
      card:
        "summary_large_image",
      title:
        `${teamA} vs ${teamB} | Cric4All`,
      description,
      images: [
        imageUrl,
      ],
    },

    other: {
      "og:image:secure_url":
        imageUrl,
    },
  };
}

export default async function MatchShareLandingPage({
  params,
}) {
  const {
    slug,
    matchId,
  } = await params;

  const data =
    await getShareMatch(
      slug,
      matchId
    );

  if (!data) {
    notFound();
  }

  const {
    league,
    match,
  } = data;

  const canonicalPath =
    `/leagues/${league.slug}/matches/${match.id}`;

  const result =
    buildPublicMatchResult(
      match
    );

  return (
    <main
      style={{
        minHeight:
          "60vh",
        display:
          "grid",
        placeItems:
          "center",
        padding:
          24,
      }}
    >
      <section
        style={{
          width:
            "min(640px, 100%)",
          padding:
            22,
          borderRadius:
            18,
          border:
            "1px solid rgba(148,163,184,.18)",
          background:
            "rgba(15,23,42,.72)",
        }}
      >
        <strong
          style={{
            display:
              "block",
            fontSize:
              20,
          }}
        >
          🏏 Cric4All Match Result
        </strong>

        <p
          style={{
            margin:
              "10px 0 0",
            lineHeight:
              1.5,
          }}
        >
          {match.teamA?.name ||
            "Team A"}{" "}
          vs{" "}
          {match.teamB?.name ||
            "Team B"}
        </p>

        <p
          style={{
            margin:
              "8px 0 0",
            lineHeight:
              1.5,
            fontWeight:
              800,
          }}
        >
          🏆 {result}
        </p>

        <p
          style={{
            margin:
              "10px 0 0",
            opacity:
              0.75,
            lineHeight:
              1.45,
          }}
        >
          Opening the full Cric4All Match Center…
        </p>

        <a
          href={
            canonicalPath
          }
          style={{
            display:
              "inline-flex",
            marginTop:
              14,
          }}
        >
          Open Match Center
        </a>

        <ShareRedirect
          href={
            canonicalPath
          }
        />
      </section>
    </main>
  );
}
