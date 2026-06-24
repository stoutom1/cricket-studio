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
        teamId: team.id,
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
        title: `${match.teamA?.name || "Team A"} vs ${
          match.teamB?.name || "Team B"
        }`,
        status: match.status,
        runs: matchRuns,
        balls: matchBallsFaced,
        wickets: matchWickets,
      };
    })
    .filter(Boolean)
    .slice(0, 10);

  return (
    <main className="public-league-portal public-wow-page">
      <section className="public-wow-hero public-one-piece-card">
        <div className="public-wow-top">
          <div className="public-breadcrumb">
            <Link href="/explore">Explore</Link>
            <span>/</span>
            <Link href={`/leagues/${league.slug}`}>{league.name}</Link>
            <span>/</span>
            <Link href={`/leagues/${league.slug}/teams/${player.teamId}`}>
              {player.teamName}
            </Link>
            <span>/</span>
            <strong>{player.name}</strong>
          </div>

          <div className="spectator-pill">🏏 Player Profile</div>
        </div>

        <div className="public-wow-hero-main">
          <div>
            <h2>{player.name}</h2>
            <p>
              Public player profile for {league.name}. View batting, bowling,
              match history, and team information in one premium cricket profile.
            </p>
          </div>

          <div className="public-wow-stats">
            <div>
              <span>Team</span>
              <strong>{player.teamName}</strong>
            </div>

            <div>
              <span>Runs</span>
              <strong>{runs}</strong>
            </div>

            <div>
              <span>Wickets</span>
              <strong>{wickets}</strong>
            </div>

            <div>
              <span>Matches</span>
              <strong>{playerMatches.length}</strong>
            </div>
          </div>
        </div>

        <div className="public-wow-controls player-profile-actions">
          <Link href={`/leagues/${league.slug}`}>🏆 Back to League</Link>
          <Link href={`/leagues/${league.slug}/teams/${player.teamId}`}>
            👥 Back to Team
          </Link>
          <Link href="/explore">🧭 Explore Leagues</Link>
        </div>

        <div className="public-tab-content">
          <div className="public-section-head">
            <h2>Player Stats</h2>
          </div>

          <div className="public-card-grid player-stat-grid">
            <div className="public-card">
              <span>Runs</span>
              <strong>{runs}</strong>
              <small>Total batting runs</small>
            </div>

            <div className="public-card">
              <span>Balls Faced</span>
              <strong>{ballsFaced}</strong>
              <small>Legal balls faced</small>
            </div>

            <div className="public-card">
              <span>Strike Rate</span>
              <strong>{strikeRate}</strong>
              <small>Runs per 100 balls</small>
            </div>

            <div className="public-card">
              <span>4s / 6s</span>
              <strong>
                {fours} / {sixes}
              </strong>
              <small>Boundaries hit</small>
            </div>

            <div className="public-card">
              <span>Wickets</span>
              <strong>{wickets}</strong>
              <small>Bowling wickets</small>
            </div>

            <div className="public-card">
              <span>Overs</span>
              <strong>{overs}</strong>
              <small>Overs bowled</small>
            </div>

            <div className="public-card">
              <span>Runs Conceded</span>
              <strong>{runsConceded}</strong>
              <small>Bowling runs</small>
            </div>

            <div className="public-card">
              <span>Economy</span>
              <strong>{economy}</strong>
              <small>Runs per over</small>
            </div>
          </div>

          <div className="public-section-head player-history-head">
            <h2>Recent Match History</h2>
            <span className="team-roster-count">
              {playerMatches.length} appearances
            </span>
          </div>

          {playerMatches.length === 0 ? (
            <div className="public-empty-state">
              <strong>📭 No match history yet</strong>
              <span>This player has not appeared in scored matches yet.</span>
            </div>
          ) : (
            <div className="public-match-list player-history-list">
              {playerMatches.map((match) => (
                <div
                  key={match.id}
                  className="public-match-card public-match-card-pro"
                >
                  <div className="public-match-main">
                    <span className="public-match-status">
                      {match.status || "SCHEDULED"}
                    </span>

                    <strong>{match.title}</strong>

                    <small>
                      {match.runs} runs off {match.balls} balls •{" "}
                      {match.wickets} wickets
                    </small>
                  </div>

                  {match.shareCode && (
                    <a href={`/live/${match.shareCode}`}>Scorecard</a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}