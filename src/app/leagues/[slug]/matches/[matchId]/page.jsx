"use server";

import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import "@/app/public-league-wow.css";
import SeoJsonLd from "@/components/seo-json-ld";
import MatchShareButton from "@/components/match-share-button";
import {
  buildPublicMatchResult,
} from "@/lib/public-match-result";
import {
  buildPostMatchExperience,
} from "@/lib/post-match-experience";
import {
  absoluteCric4AllUrl,
  publicPageRobots,
  seoDate,
} from "@/lib/seo";

function normalizeStatus(status) {
  return String(status || "SCHEDULED").toUpperCase();
}

function formatStatus(status) {
  return normalizeStatus(status).replaceAll("_", " ");
}

function getStatusClass(status) {
  const value = normalizeStatus(status);

  if (["LIVE", "IN_PROGRESS"].includes(value)) return "is-live";
  if (value === "SCHEDULED") return "is-scheduled";
  if (["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED"].includes(value)) {
    return "is-completed";
  }
  if (value === "ABANDONED") return "is-abandoned";

  return "is-neutral";
}

function calculateMatchSummary(balls = []) {
  const totalRuns = balls.reduce(
    (sum, ball) => sum + Number(ball.totalRuns || 0),
    0
  );

  const totalWickets = balls.filter(
    (ball) => ball.isWicket && ball.wicketType !== "RETIRED_HURT"
  ).length;

  const totalBalls = balls.filter((ball) => ball.legalDelivery).length;

  return {
    totalRuns,
    totalWickets,
    totalBalls,
    overs: `${Math.floor(totalBalls / 6)}.${totalBalls % 6}`,
  };
}

export async function generateMetadata({ params }) {
  const { slug, matchId } = await params;
  const numericMatchId = Number(matchId);

  const league = await prisma.league.findFirst({
    where: {
      slug,
      visibility: {
        in: ["PUBLIC", "UNLISTED"],
      },
    },
    include: {
      matches: {
        where: {
          id: numericMatchId,
        },
        include: {
          teamA: {
            include: {
              players: true,
            },
          },
          teamB: {
            include: {
              players: true,
            },
          },
          series: true,
          balls: true,
        },
      },
    },
  });

  const match = league?.matches?.[0];

  if (!league || !match) {
    return {
      title: "Match Not Found | Cric4All",
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
      `/leagues/${league.slug}/matches/${match.id}`
    );

  const resultText =
    buildPublicMatchResult(
      match
    );

  const normalizedStatus =
    normalizeStatus(
      match.status
    );

  const description =
    [
      "COMPLETED",
      "COMPLETED_LOCKED",
      "COMPLETED_CORRECTED",
      "ABANDONED",
    ].includes(
      normalizedStatus
    )
      ? `${match.teamA?.name} vs ${match.teamB?.name}: ${resultText}. View the cricket scorecard and match details from ${league.name} on Cric4All.`
      : `Follow ${match.teamA?.name} vs ${match.teamB?.name} in ${league.name}. View the cricket match center, scorecard, status and live-score link on Cric4All.`;

  return {
    title:
      `${match.teamA?.name} vs ${match.teamB?.name} Cricket Scorecard | ${league.name} | Cric4All`,
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
        `${match.teamA?.name} vs ${match.teamB?.name} | ${league.name}`,
      description,
      url:
        canonical,
      type:
        "website",
      siteName:
        "Cric4All",
      images: [
        {
          url:
            absoluteCric4AllUrl(
              `/leagues/${league.slug}/matches/${match.id}/share-card-v4`
            ),
          width:
            1200,
          height:
            630,
          type:
            "image/png",
          alt:
            `${match.teamA?.name} vs ${match.teamB?.name} Cric4All match result`,
        },
      ],
    },
    twitter: {
      card:
        "summary_large_image",
      title:
        `${match.teamA?.name} vs ${match.teamB?.name} | Cric4All`,
      description,
      images: [
        absoluteCric4AllUrl(
          `/leagues/${league.slug}/matches/${match.id}/share-card-v4`
        ),
      ],
    },
  };
}

export default async function PublicMatchPage({ params }) {
  const { slug, matchId } = await params;
  const numericMatchId = Number(matchId);

  const league = await prisma.league.findFirst({
    where: {
      slug,
      visibility: {
        in: ["PUBLIC", "UNLISTED"],
      },
    },
    include: {
      matches: {
        where: {
          id: numericMatchId,
        },
        include: {
          teamA: {
            include: {
              players: true,
            },
          },
          teamB: {
            include: {
              players: true,
            },
          },
          series: true,
          balls: true,
        },
      },
    },
  });

  if (!league || !league.matches?.length) {
    notFound();
  }

  const match = league.matches[0];
  const { totalRuns, totalWickets, overs } = calculateMatchSummary(
    match.balls || []
  );

  const status = match.status || "SCHEDULED";
  const statusClass = getStatusClass(status);

  const matchResultText =
    buildPublicMatchResult(
      match
    );

  const postMatchExperience =
    buildPostMatchExperience({
      match,
      league,
    });

  const matchDateLabel =
    new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    ).format(
      new Date(
        match.scheduledAt ||
          match.createdAt
      )
    );

  const isPublic =
    String(
      league.visibility ||
      ""
    ).toUpperCase() ===
    "PUBLIC";

  /*
   * Google requires a real physical Event location/address.
   *
   * When venueAddress is available, Cric4All emits SportsEvent with a Place
   * and one-line PostalAddress. When it is missing (older/imported matches),
   * Cric4All falls back to WebPage structured data instead of publishing an
   * invalid or invented Event location.
   */
  const hasRealVenueAddress =
    Boolean(
      String(
        match.venueAddress ||
        ""
      ).trim()
    );

  const canonicalMatchUrl =
    absoluteCric4AllUrl(
      `/leagues/${league.slug}/matches/${match.id}`
    );

  const jsonLd =
    isPublic &&
    hasRealVenueAddress
      ? {
          "@context":
            "https://schema.org",
          "@type":
            "SportsEvent",

          name:
            `${match.teamA?.name || "Team A"} vs ${match.teamB?.name || "Team B"}`,

          sport:
            "Cricket",

          url:
            canonicalMatchUrl,

          startDate:
            seoDate(
              match.scheduledAt ||
              match.createdAt
            ),

          endDate:
            match.endedAt
              ? seoDate(
                  match.endedAt
                )
              : undefined,

          eventStatus:
            normalizeStatus(status) ===
            "SCHEDULED"
              ? "https://schema.org/EventScheduled"
              : [
                  "COMPLETED",
                  "COMPLETED_LOCKED",
                  "COMPLETED_CORRECTED",
                ].includes(
                  normalizeStatus(status)
                )
                ? "https://schema.org/EventCompleted"
                : normalizeStatus(status) ===
                    "ABANDONED"
                  ? "https://schema.org/EventCancelled"
                  : "https://schema.org/EventScheduled",

          location: {
            "@type":
              "Place",

            name:
              String(
                match.venueName ||
                ""
              ).trim() ||
              undefined,

            address: {
              "@type":
                "PostalAddress",

              /*
               * Google explicitly permits an entire real address on one line
               * in PostalAddress.name. This keeps Cric4All's match setup simple
               * while still providing genuine physical-location information.
               */
              name:
                String(
                  match.venueAddress
                ).trim(),
            },
          },

          competitor: [
            {
              "@type":
                "SportsTeam",
              name:
                match.teamA?.name ||
                "Team A",
              sport:
                "Cricket",
              url:
                match.teamA?.id
                  ? absoluteCric4AllUrl(
                      `/leagues/${league.slug}/teams/${match.teamA.id}`
                    )
                  : undefined,
            },

            {
              "@type":
                "SportsTeam",
              name:
                match.teamB?.name ||
                "Team B",
              sport:
                "Cricket",
              url:
                match.teamB?.id
                  ? absoluteCric4AllUrl(
                      `/leagues/${league.slug}/teams/${match.teamB.id}`
                    )
                  : undefined,
            },
          ],

          organizer: {
            "@type":
              "SportsOrganization",
            name:
              league.name,
            sport:
              "Cricket",
            url:
              absoluteCric4AllUrl(
                `/leagues/${league.slug}`
              ),
          },

          description:
            matchResultText,
        }
      : isPublic
        ? {
            "@context":
              "https://schema.org",
            "@type":
              "WebPage",
            name:
              `${match.teamA?.name || "Team A"} vs ${match.teamB?.name || "Team B"} Cricket Match`,
            url:
              canonicalMatchUrl,
            description:
              matchResultText,
            datePublished:
              seoDate(
                match.createdAt
              ),
            dateModified:
              seoDate(
                match.lockedAt ||
                match.endedAt ||
                match.startedAt ||
                match.scheduledAt ||
                match.createdAt
              ),
            isPartOf: {
              "@type":
                "WebSite",
              name:
                "Cric4All",
              url:
                absoluteCric4AllUrl(
                  "/"
                ),
            },
          }
        : null;

  return (
    <>
      <SeoJsonLd
        data={
          jsonLd
        }
      />

      <main className="smp-page">
      <section className="smp-shell">
        <header className="smp-hero">
          <div className="smp-topline">
            <nav className="smp-breadcrumb" aria-label="Breadcrumb">
              <Link href="/explore">Explore</Link>
              <span>/</span>
              <Link href={`/leagues/${league.slug}`}>{league.name}</Link>
              <span>/</span>
              <strong>
                {match.teamA?.name || "Team A"} vs {match.teamB?.name || "Team B"}
              </strong>
            </nav>

            <span className={`smp-status-label ${statusClass}`}>
              <span aria-hidden="true" />
              {formatStatus(status)}
            </span>
          </div>

          <div className="smp-match-stage">
            <div className="smp-series-line">
              <span>{match.series?.name || "League match"}</span>
              {match.series?.year && <span>{match.series.year}</span>}
            </div>

            <div className="smp-teams">
              <div className="smp-team smp-team-a">
                <span className="smp-team-mark" aria-hidden="true">
                  {(match.teamA?.name || "A").slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <small>Team A</small>
                  <h1>{match.teamA?.name || "Team A"}</h1>
                </div>
              </div>

              <div className="smp-versus">
                <span>VS</span>
              </div>

              <div className="smp-team smp-team-b">
                <div>
                  <small>Team B</small>
                  <h1>{match.teamB?.name || "Team B"}</h1>
                </div>
                <span className="smp-team-mark" aria-hidden="true">
                  {(match.teamB?.name || "B").slice(0, 2).toUpperCase()}
                </span>
              </div>
            </div>

            <div className="smp-result-line">
              <p>{matchResultText}</p>
            </div>

            <div className="smp-actions">
              <Link href={`/leagues/${league.slug}`}>League</Link>
              <Link href="/explore">Explore</Link>

              <MatchShareButton
                className="smp-primary-action"
                leagueId={league.id}
                matchId={match.id}
                teamAName={match.teamA?.name || "Team A"}
                teamBName={match.teamB?.name || "Team B"}
                resultText={matchResultText}
                shareUrl={`${canonicalMatchUrl}/share-v5`}
              />

              {match.shareCode && (
                <a className="smp-primary-action" href={`/live/${match.shareCode}`}>
                  Open live scorecard
                </a>
              )}
            </div>
          </div>
        </header>

        <section
          className="smp-score-band smp-score-band--compact"
          aria-label="Match score summary"
        >
          <div>
            <span>Total runs</span>
            <strong>{totalRuns}</strong>
          </div>
          <div>
            <span>Overs</span>
            <strong>{overs}</strong>
          </div>
          <div>
            <span>Wickets</span>
            <strong>{totalWickets}</strong>
          </div>
          <div>
            <span>Scorecard</span>
            <strong>{match.shareCode ? "Available" : "Pending"}</strong>
          </div>
        </section>

        <section
          className="smp-match-meta-strip"
          aria-label="Match details"
        >
          <div>
            <span aria-hidden="true">🏆</span>
            <p>
              <small>Competition</small>
              <strong>{match.series?.name || league.name}</strong>
            </p>
          </div>

          <div>
            <span aria-hidden="true">📅</span>
            <p>
              <small>Date</small>
              <strong>{matchDateLabel}</strong>
            </p>
          </div>

          <div>
            <span aria-hidden="true">📍</span>
            <p>
              <small>Venue</small>
              <strong>
                {match.venueName ||
                  match.venueAddress ||
                  "Not set"}
              </strong>
            </p>
          </div>

          <div>
            <span aria-hidden="true">✅</span>
            <p>
              <small>Status</small>
              <strong>{formatStatus(status)}</strong>
            </p>
          </div>
        </section>

        {postMatchExperience ? (
          <section
            className="smp-post-match smp-post-match--compact"
            aria-labelledby="smp-post-match-title"
          >
            <div className="smp-post-match-heading smp-post-match-heading--compact">
              <div>
                <p>🏆 Match Intelligence</p>
                <h2 id="smp-post-match-title">
                  The performances that shaped the match
                </h2>
                <span>
                  Awards, turning points and the story of the game — calculated
                  from completed-match scoring data.
                </span>
              </div>

              <span className="smp-post-match-badge">
                Cric4All
              </span>
            </div>

            <article className="smp-story-feature">
              <span className="smp-story-feature-icon" aria-hidden="true">
                📝
              </span>

              <div>
                <small>Post-match story</small>
                <strong>{matchResultText}</strong>
                <p>{postMatchExperience.story}</p>
              </div>
            </article>

            <div className="smp-match-awards-grid smp-match-awards-grid--compact">
              {postMatchExperience.awards.map((award) => (
                <article
                  className={`smp-match-award smp-match-award--compact smp-match-award--${award.key.toLowerCase()}`}
                  key={award.key}
                >
                  <div className="smp-match-award-top">
                    <span
                      className="smp-match-award-icon"
                      aria-hidden="true"
                    >
                      {award.icon}
                    </span>

                    <div>
                      <small>{award.title}</small>
                      <strong>{award.playerName}</strong>
                      <em>{award.teamName || "League player"}</em>
                    </div>
                  </div>

                  <div className="smp-match-award-value">
                    {award.value}
                  </div>

                  <p>{award.subtitle}</p>

                  <details>
                    <summary>How calculated</summary>
                    <p>{award.explanation}</p>
                  </details>
                </article>
              ))}
            </div>

            <div className="smp-match-intelligence-grid smp-match-intelligence-grid--compact">
              {postMatchExperience.bestPartnership ? (
                <article className="smp-match-intelligence-card">
                  <span aria-hidden="true">🤝</span>
                  <div>
                    <small>Best partnership</small>
                    <strong>
                      {postMatchExperience.bestPartnership.playerNames.join(
                        " & "
                      )}
                    </strong>
                    <p>
                      {postMatchExperience.bestPartnership.runs} runs
                      {" · "}
                      {postMatchExperience.bestPartnership.balls} legal balls
                      {postMatchExperience.bestPartnership.teamName
                        ? ` · ${postMatchExperience.bestPartnership.teamName}`
                        : ""}
                    </p>
                  </div>
                </article>
              ) : null}

              {postMatchExperience.turningPoint ? (
                <article className="smp-match-intelligence-card">
                  <span aria-hidden="true">⚡</span>
                  <div>
                    <small>Turning point</small>
                    <strong>
                      Innings {postMatchExperience.turningPoint.inningsNo} · Over{" "}
                      {postMatchExperience.turningPoint.overNumber}
                    </strong>
                    <p>
                      {postMatchExperience.turningPoint.runs} runs
                      {" · "}
                      {postMatchExperience.turningPoint.wickets} wicket
                      {postMatchExperience.turningPoint.wickets === 1 ? "" : "s"}
                      {" · "}
                      {postMatchExperience.turningPoint.boundaries} boundaries
                    </p>
                  </div>
                </article>
              ) : null}
            </div>

            {match.shareCode ? (
              <div className="smp-scorecard-cta">
                <div>
                  <span aria-hidden="true">📺</span>
                  <p>
                    <small>Ball-by-ball scorecard</small>
                    <strong>Want the full innings detail?</strong>
                  </p>
                </div>

                <a href={`/live/${match.shareCode}`}>
                  Open scorecard
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="smp-live-summary">
            <div>
              <p>Match center</p>
              <h2>{matchResultText}</h2>
              <span>
                Match intelligence and awards appear automatically after the
                match is completed.
              </span>
            </div>

            {match.shareCode ? (
              <a href={`/live/${match.shareCode}`}>
                Open scorecard
                <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </section>
        )}
      </section>
      </main>
    </>
  );
}
