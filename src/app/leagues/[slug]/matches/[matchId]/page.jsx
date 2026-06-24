import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export async function generateMetadata({ params }) {
  const { slug, matchId } = await params;

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
          id: Number(matchId),
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

  const totalRuns = match.balls?.reduce(
  (sum, ball) => sum + Number(ball.totalRuns || 0),
  0
);

const totalWickets = match.balls?.filter(
  (ball) => ball.isWicket && ball.wicketType !== "RETIRED_HURT"
).length;
const balls = await prisma.ball.findMany({
  where: { matchId: match.id },
});
const totalBalls = match.balls?.filter((ball) => ball.legalDelivery).length;

const overs = `${Math.floor((totalBalls || 0) / 6)}.${(totalBalls || 0) % 6}`;


  return {
    title: `${match.teamA?.name} vs ${match.teamB?.name} | ${league.name} | Cric4All`,
    description: `View ${match.teamA?.name} vs ${match.teamB?.name} match center, scorecard, series, and match status for ${league.name}.`,
  };
}

export default async function PublicMatchPage({ params }) {
  const { slug, matchId } = await params;

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
    id: Number(matchId),
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
  const totalRuns = (match.balls || []).reduce(
  (sum, ball) => sum + Number(ball.totalRuns || 0),
  0
);

const totalWickets = (match.balls || []).filter(
  (ball) => ball.isWicket && ball.wicketType !== "RETIRED_HURT"
).length;

const totalBalls = (match.balls || []).filter(
  (ball) => ball.legalDelivery
).length;

const overs = `${Math.floor(totalBalls / 6)}.${totalBalls % 6}`;
const matchResultText =
  match.statusText ||
  (String(match.status || "").toUpperCase().includes("COMPLETED")
    ? "Match completed"
    : "Match details will update as scoring progresses.");

const matchInfoItems = [
  ["League", league.name],
  ["Series", match.series?.name || "No Series"],
  ["Status", match.status || "SCHEDULED"],
  ["Scorecard", match.shareCode ? "Available" : "Not shared yet"],
];

return (
  <main className="public-league-portal public-wow-page">
    <section className="public-wow-hero public-one-piece-card">
      <div className="public-wow-top">
        <div className="public-breadcrumb">
          <Link href="/explore">Explore</Link>
          <span>/</span>
          <Link href={`/leagues/${league.slug}`}>
            {league.name}
          </Link>
          <span>/</span>
          <strong>
            {match.teamA?.name} vs {match.teamB?.name}
          </strong>
        </div>

        <div className="spectator-pill">
          🏏 Match Center
        </div>
      </div>

      <div className="public-wow-hero-main">
        <div>
          <h2>
            {match.teamA?.name} vs {match.teamB?.name}
          </h2>

          <p>
            {match.series?.name || "No Series"}
            {match.series?.year
              ? ` • ${match.series.year}`
              : ""}
            {" • "}
            {match.status || "SCHEDULED"}
          </p>
        </div>

        <div className="public-wow-stats">
          <div>
            <span>Status</span>
            <strong>
              {match.status || "SCHEDULED"}
            </strong>
          </div>

          <div>
            <span>Runs</span>
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
        </div>
      </div>

      <div className="public-wow-controls match-actions">
        <Link href={`/leagues/${league.slug}`}>
          🏆 League
        </Link>

        <Link href="/explore">
          🧭 Explore
        </Link>

        {match.shareCode && (
          <a href={`/live/${match.shareCode}`}>
            🏏 Live Scorecard
          </a>
        )}
      </div>

      <div className="public-tab-content">
        <div className="public-section-head">
          <h2>Match Summary</h2>
        </div>

        <div className="public-card-grid match-summary-grid">
          <div className="public-card">
            <span>Status</span>
            <strong>
              {match.status || "SCHEDULED"}
            </strong>
            <small>Current state</small>
          </div>

          <div className="public-card">
            <span>Series</span>
            <strong>
              {match.series?.name || "No Series"}
            </strong>
            <small>Tournament</small>
          </div>

          <div className="public-card">
            <span>Total Runs</span>
            <strong>{totalRuns}</strong>
            <small>Match runs</small>
          </div>

          <div className="public-card">
            <span>Overs</span>
            <strong>{overs}</strong>
            <small>Legal deliveries</small>
          </div>

          <div className="public-card">
            <span>Wickets</span>
            <strong>{totalWickets}</strong>
            <small>Dismissals</small>
          </div>
        </div>

        {match.shareCode ? (
          <>
            <div className="public-section-head match-center-head">
              <h2>Live Match Center</h2>
            </div>

            <div className="match-live-card">
              <div>
                <strong>
                  {match.teamA?.name}
                </strong>

                <span>vs</span>

                <strong>
                  {match.teamB?.name}
                </strong>
              </div>

              <a
                className="public-action-primary"
                href={`/live/${match.shareCode}`}
              >
                🏏 Open Live Scorecard
              </a>
            </div>
            <div className="match-extra-panel">
  <div className="match-story-card">
    <span>🏁 Match Result</span>
    <strong>{matchResultText}</strong>
    <p>
      This public match center gives spectators quick access to the match status,
      summary, scorecard, league context, and live scoring link when available.
    </p>
  </div>

  <div className="match-info-grid">
    {matchInfoItems.map(([label, value]) => (
      <div key={label}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    ))}
  </div>
</div>
          </>
        ) : (
          <div className="public-empty-state">
            <strong>
              📭 No scorecard yet
            </strong>

            <span>
              This match has not been scored or
              shared yet.
            </span>
          </div>
        )}
      </div>
    </section>
  </main>
);
}