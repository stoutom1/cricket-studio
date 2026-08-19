import {
  notFound,
} from "next/navigation";
import {
  absoluteCric4AllUrl,
} from "@/lib/seo";
import {
  getLiveShareMatch,
} from "@/lib/live-share";
import LiveShareRedirect from "./live-share-redirect";

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

  if (!data) {
    return {
      title:
        "Cric4All Live Cricket Score",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const {
    match,
  } = data;

  const teamA =
    match.teamA?.name ||
    "Team A";

  const teamB =
    match.teamB?.name ||
    "Team B";

  const shareUrl =
    absoluteCric4AllUrl(
      `/live/${shareCode}/share-v1`
    );

  const imageUrl =
    absoluteCric4AllUrl(
      `/live/${shareCode}/share-card-v1.png`
    );

  const canonical =
    match.league?.slug &&
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

  const title =
    data.isFinal
      ? `${teamA} vs ${teamB} | Cric4All Match Result`
      : `${teamA} vs ${teamB} | Cric4All Live Score`;

  return {
    title,

    description:
      data.description,

    robots: {
      index: false,
      follow: true,
    },

    alternates: {
      canonical,
    },

    openGraph: {
      title,
      description:
        data.description,
      url:
        shareUrl,
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
            `${teamA} vs ${teamB} Cric4All ${data.isFinal ? "result" : "live score"}`,
        },
      ],
    },

    twitter: {
      card:
        "summary_large_image",
      title,
      description:
        data.description,
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

export default async function LiveShareLandingPage({
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

  if (!data) {
    notFound();
  }

  const {
    match,
  } = data;

  const destination =
    `/live/${encodeURIComponent(
      shareCode
    )}`;

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
          {data.isFinal
            ? "🏆 Cric4All Match Result"
            : "🔴 Cric4All Live Score"}
        </strong>

        <p
          style={{
            margin:
              "10px 0 0",
            lineHeight:
              1.5,
            fontWeight:
              800,
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
          }}
        >
          {data.isFinal
            ? data.resultText
            : `${data.currentTeamName} ${data.currentSummary.runs}/${data.currentSummary.wickets} (${data.currentSummary.overs} ov)`}
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
          Opening the spectator scorecard…
        </p>

        <a
          href={
            destination
          }
          style={{
            display:
              "inline-flex",
            marginTop:
              14,
          }}
        >
          Open Live Scorecard
        </a>

        <LiveShareRedirect
          href={
            destination
          }
        />
      </section>
    </main>
  );
}
