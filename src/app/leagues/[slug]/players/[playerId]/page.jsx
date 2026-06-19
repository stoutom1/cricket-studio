import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export async function generateMetadata({ params }) {
  const { slug, playerId } = await params;

  const league = await prisma.league.findFirst({
    where: {
      slug,
      visibility: {
        in: ["PUBLIC", "UNLISTED"],
      },
    },
    include: {
      teams: {
        include: {
          players: true,
        },
      },
    },
  });

  const player = league?.teams
    ?.flatMap((team) =>
      team.players.map((p) => ({
        ...p,
        teamName: team.name,
      }))
    )
    ?.find((p) => Number(p.id) === Number(playerId));

  if (!league || !player) {
    return {
      title: "Player Not Found | Cric4All",
    };
  }

  return {
    title: `${player.name} | ${player.teamName} | Cric4All`,
    description: `View ${player.name}'s cricket profile, stats, match history, and team information on Cric4All.`,
  };
}

export default async function PublicPlayerPage({ params }) {
  const { slug, playerId } = await params;

const league = await prisma.league.findFirst({
  where: {
    slug,
    visibility: {
      in: ["PUBLIC", "UNLISTED"],
    },
  },
  include: {
    teams: {
      include: {
        players: true,
      },
    },
matches: {
  include: {
    teamA: true,
    teamB: true,
    balls: true,
  },
  orderBy: [{ createdAt: "desc" }],
},
  },
});

  if (!league) notFound();

  const player = league.teams
    .flatMap((team) =>
      team.players.map((p) => ({
        ...p,
        teamName: team.name,
      }))
    )
    .find((p) => Number(p.id) === Number(playerId));

  if (!player) notFound();
const balls = league.matches.flatMap((match) => match.balls || []);

const battingBalls = balls.filter(
  (ball) => Number(ball.strikerId) === Number(player.id)
);

const bowlingBalls = balls.filter(
  (ball) => Number(ball.bowlerId) === Number(player.id)
);

const runs = battingBalls.reduce(
  (sum, ball) => sum + Number(ball.runsOffBat || 0),
  0
);

const ballsFaced = battingBalls.filter(
  (ball) =>
    ball.extraType !== "WIDE" &&
    ball.extraType !== "NOBALL" &&
    ball.wicketType !== "RETIRED_HURT"
).length;

const fours = battingBalls.filter(
  (ball) => Number(ball.runsOffBat) === 4
).length;

const sixes = battingBalls.filter(
  (ball) => Number(ball.runsOffBat) === 6
).length;

const wickets = bowlingBalls.filter(
  (ball) =>
    ball.isWicket &&
    !["RUN_OUT", "RETIRED_OUT", "RETIRED_HURT"].includes(ball.wicketType) &&
    ball.extraType !== "NOBALL"
).length;

const legalBowls = bowlingBalls.filter(
  (ball) =>
    ball.legalDelivery &&
    ball.extraType !== "WIDE" &&
    ball.extraType !== "NOBALL" &&
    ball.wicketType !== "RETIRED_HURT"
).length;

const runsConceded = bowlingBalls.reduce((sum, ball) => {
  if (["BYE", "LEGBYE"].includes(ball.extraType)) return sum;
  return sum + Number(ball.totalRuns || 0);
}, 0);

const strikeRate = ballsFaced
  ? ((runs / ballsFaced) * 100).toFixed(2)
  : "0.00";

const economy = legalBowls
  ? ((runsConceded / legalBowls) * 6).toFixed(2)
  : "0.00";

const overs = `${Math.floor(legalBowls / 6)}.${legalBowls % 6}`;

const playerMatches = league.matches
  .map((match) => {
    const matchBalls = match.balls || [];

    const batting = matchBalls.filter(
      (ball) => Number(ball.strikerId) === Number(player.id)
    );

    const bowling = matchBalls.filter(
      (ball) => Number(ball.bowlerId) === Number(player.id)
    );

    const matchRuns = batting.reduce(
      (sum, ball) => sum + Number(ball.runsOffBat || 0),
      0
    );

    const matchBallsFaced = batting.filter(
      (ball) =>
        ball.extraType !== "WIDE" &&
        ball.extraType !== "NOBALL" &&
        ball.wicketType !== "RETIRED_HURT"
    ).length;

    const matchWickets = bowling.filter(
      (ball) =>
        ball.isWicket &&
        !["RUN_OUT", "RETIRED_OUT", "RETIRED_HURT"].includes(ball.wicketType) &&
        ball.extraType !== "NOBALL"
    ).length;

    if (!batting.length && !bowling.length) return null;

    return {
      id: match.id,
      shareCode: match.shareCode,
      title: `${match.teamA?.name || "Team A"} vs ${match.teamB?.name || "Team B"}`,
      status: match.status,
      runs: matchRuns,
      balls: matchBallsFaced,
      wickets: matchWickets,
    };
  })
  .filter(Boolean)
  .slice(0, 10);

  return (
    <main className="public-league-portal">
      <section className="public-league-hero">
        <div className="public-breadcrumb">
  <Link href="/explore">Explore</Link>
  <span>/</span>
  <Link href={`/leagues/${league.slug}`}>{league.name}</Link>
  <span>/</span>
  <strong>{player.name}</strong>
</div>

        <h1>{player.name}</h1>

        <p>
          Public player profile for {league.name}.
        </p>

        <div className="public-league-badges">
          <span>{player.teamName}</span>
          <span>{league.visibility}</span>
        </div>
      </section>

<section className="public-section">
  <h2>Player Stats</h2>

  <div className="public-card-grid">
    <div className="public-card">
      <span>Runs</span>
      <strong>{runs}</strong>
    </div>

    <div className="public-card">
      <span>Balls Faced</span>
      <strong>{ballsFaced}</strong>
    </div>

    <div className="public-card">
      <span>Strike Rate</span>
      <strong>{strikeRate}</strong>
    </div>

    <div className="public-card">
      <span>4s / 6s</span>
      <strong>{fours} / {sixes}</strong>
    </div>

    <div className="public-card">
      <span>Wickets</span>
      <strong>{wickets}</strong>
    </div>

    <div className="public-card">
      <span>Overs</span>
      <strong>{overs}</strong>
    </div>

    <div className="public-card">
      <span>Runs Conceded</span>
      <strong>{runsConceded}</strong>
    </div>

    <div className="public-card">
      <span>Economy</span>
      <strong>{economy}</strong>
    </div>
  </div>
</section>
<section className="public-section">
  <h2>Recent Match History</h2>

  {playerMatches.length === 0 ? (
    <div className="public-empty-state">
      <strong>📭 No match history yet</strong>
      <span>This player has not appeared in scored matches yet.</span>
    </div>
  ) : (
    <div className="public-match-list">
      {playerMatches.map((match) => (
        <div key={match.id} className="public-match-card">
          <div>
            <strong>{match.title}</strong>
            <span>
              {match.status || "SCHEDULED"} • {match.runs} runs off{" "}
              {match.balls} balls • {match.wickets} wickets
            </span>
          </div>

          {match.shareCode && (
            <a href={`/live/${match.shareCode}`}>Scorecard</a>
          )}
        </div>
      ))}
    </div>
  )}
</section>
    </main>
  );
}