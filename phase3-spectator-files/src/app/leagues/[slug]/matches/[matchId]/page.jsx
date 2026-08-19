"use server";

import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import "@/app/public-league-wow.css";

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
          teamA: true,
          teamB: true,
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

  return {
    title: `${match.teamA?.name} vs ${match.teamB?.name} | ${league.name} | Cric4All`,
    description: `View ${match.teamA?.name} vs ${match.teamB?.name} match center, scorecard, series, and match status for ${league.name}.`,
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
          teamA: true,
          teamB: true,
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
    match.statusText ||
    (normalizeStatus(status).includes("COMPLETED")
      ? "Match completed"
      : "Match details will update as scoring progresses.");

  const matchInfoItems = [
    ["League", league.name],
    ["Series", match.series?.name || "No Series"],
    ["Status", formatStatus(status)],
    ["Scorecard", match.shareCode ? "Available" : "Not shared yet"],
  ];

  return (
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
              {match.shareCode && (
                <a className="smp-primary-action" href={`/live/${match.shareCode}`}>
                  Open live scorecard
                </a>
              )}
            </div>
          </div>
        </header>

        <section className="smp-score-band" aria-label="Match score summary">
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

        <div className="smp-content">
          <section className="smp-main-column">
            <div className="smp-section-heading">
              <div>
                <p>Match center</p>
                <h2>Match overview</h2>
              </div>
              <span>Everything a spectator needs at a glance</span>
            </div>

            <div className="smp-overview-list">
              <div>
                <span>Status</span>
                <strong>{formatStatus(status)}</strong>
                <small>Current match state</small>
              </div>

              <div>
                <span>Series</span>
                <strong>{match.series?.name || "No Series"}</strong>
                <small>
                  {match.series?.year
                    ? `Season ${match.series.year}`
                    : "Competition details"}
                </small>
              </div>

              <div>
                <span>Total runs</span>
                <strong>{totalRuns}</strong>
                <small>Runs recorded in this match</small>
              </div>

              <div>
                <span>Overs</span>
                <strong>{overs}</strong>
                <small>Calculated from legal deliveries</small>
              </div>

              <div>
                <span>Wickets</span>
                <strong>{totalWickets}</strong>
                <small>Retired hurt excluded</small>
              </div>
            </div>

            {match.shareCode ? (
              <section className="smp-scorecard-panel">
                <div>
                  <p>Live scorecard</p>
                  <h2>Follow every delivery</h2>
                  <span>
                    Open the spectator scorecard for live scoring, innings details,
                    and ball-by-ball updates.
                  </span>
                </div>

                <a href={`/live/${match.shareCode}`}>
                  View live scorecard
                  <span aria-hidden="true">→</span>
                </a>
              </section>
            ) : (
              <section className="smp-empty">
                <span aria-hidden="true">—</span>
                <div>
                  <strong>No scorecard yet</strong>
                  <p>This match has not been scored or shared yet.</p>
                </div>
              </section>
            )}
          </section>

          <aside className="smp-side-column">
            <section className="smp-story">
              <p>Match status</p>
              <h2>{matchResultText}</h2>
              <span>
                This public match page updates from the league scoring data and
                gives spectators a direct path to the live scorecard whenever it
                is available.
              </span>
            </section>

            <section className="smp-info-list">
              {matchInfoItems.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
