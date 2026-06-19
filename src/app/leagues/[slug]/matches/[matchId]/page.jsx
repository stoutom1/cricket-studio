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

  return (
    <main className="public-league-portal">
      <section className="public-league-hero">
        <div className="public-breadcrumb">
          <Link href="/explore">Explore</Link>
          <span>/</span>
          <Link href={`/leagues/${league.slug}`}>{league.name}</Link>
          <span>/</span>
          <strong>
            {match.teamA?.name} vs {match.teamB?.name}
          </strong>
        </div>

        <h1>
          {match.teamA?.name} vs {match.teamB?.name}
        </h1>

        <p>
          {match.series?.name || "No Series"} • {match.status || "SCHEDULED"}
        </p>

        <div className="public-league-badges">
          <span>{match.status || "SCHEDULED"}</span>
          {match.series?.year ? <span>{match.series.year}</span> : null}
        </div>
      </section>

      <section className="public-section">
        <h2>Match Center</h2>
<section className="public-section">
  <h2>Match Summary</h2>

  <div className="public-card-grid">
    <div className="public-card">
      <span>Status</span>
      <strong>{match.status || "SCHEDULED"}</strong>
    </div>

    <div className="public-card">
      <span>Series</span>
      <strong>{match.series?.name || "No Series"}</strong>
    </div>

    <div className="public-card">
      <span>Total Runs</span>
      <strong>{totalRuns || 0}</strong>
    </div>

    <div className="public-card">
      <span>Overs Bowled</span>
      <strong>{overs}</strong>
    </div>

    <div className="public-card">
      <span>Wickets</span>
      <strong>{totalWickets || 0}</strong>
    </div>
  </div>
</section>
        {match.shareCode ? (
          <a className="public-action-primary" href={`/live/${match.shareCode}`}>
            🏏 Open Live Scorecard
          </a>
        ) : (
          <div className="public-empty-state">
            <strong>No scorecard yet</strong>
            <span>This match has not been shared or scored yet.</span>
          </div>
        )}
      </section>
    </main>
  );
}