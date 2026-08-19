import LiveScoreClient from "./LiveScoreClient";
import {
  absoluteCric4AllUrl,
} from "@/lib/seo";
import {
  getLiveShareMatch,
} from "@/lib/live-share";

export async function generateMetadata({
  params,
}) {
  const {
    matchId:
      shareCode,
  } = await params;

  const data =
    await getLiveShareMatch(
      shareCode
    );

  const match =
    data?.match;

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
          `/live/${shareCode}`
        );

  const imageUrl =
    absoluteCric4AllUrl(
      `/live/${shareCode}/share-card-v1.png`
    );

  const description =
    data?.description ||
    `Follow ${teamA} vs ${teamB} live on Cric4All with score, scorecard and ball-by-ball match updates.`;

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
            `${teamA} vs ${teamB} Cric4All live cricket score`,
        },
      ],
    },

    twitter: {
      card:
        "summary_large_image",
      title:
        `${teamA} vs ${teamB} | Cric4All Live Score`,
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
