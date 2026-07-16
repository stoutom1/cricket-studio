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

function getInitials(name) {
  return (
    String(name || "Player")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "PL"
  );
}

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
    <main className="spp-page">
      <section className="spp-shell">
        <header className="spp-hero">
          <div className="spp-topline">
            <nav className="spp-breadcrumb" aria-label="Breadcrumb">
              <Link href="/explore">Explore</Link>
              <span>/</span>
              <Link href={`/leagues/${league.slug}`}>{league.name}</Link>
              <span>/</span>
              <Link href={`/leagues/${league.slug}/teams/${player.teamId}`}>
                {player.teamName}
              </Link>
              <span>/</span>
              <strong>{player.name}</strong>
            </nav>

            <span className="spp-public-label">
              <span aria-hidden="true" />
              Public player
            </span>
          </div>

          <div className="spp-hero-main">
            <div className="spp-player-identity">
              <span className="spp-player-mark" aria-hidden="true">
                {getInitials(player.name)}
              </span>

              <div>
                <p className="spp-kicker">Cric4All Player Profile</p>
                <h2>{player.name}</h2>
                <p className="spp-subtitle">
                  <strong>{player.teamName}</strong> · {league.name}
                </p>
              </div>
            </div>

            <div className="spp-actions">
              <Link href={`/leagues/${league.slug}`}>Back to league</Link>
              <Link href={`/leagues/${league.slug}/teams/${player.teamId}`}>
                Back to team
              </Link>
              <Link className="spp-primary-action" href="/explore">
                Explore leagues
              </Link>
            </div>
          </div>

          <div className="spp-career-line">
            <span><b>{runs}</b> Runs</span>
            <span><b>{wickets}</b> Wickets</span>
            <span><b>{playerMatches.length}</b> Appearances</span>
            <span><b>{strikeRate}</b> Strike rate</span>
            <span><b>{economy}</b> Economy</span>
          </div>
        </header>

        <div className="spp-content">
          <section className="spp-profile-grid">
            <div className="spp-main-column">
              <section className="spp-stats-section">
                <div className="spp-section-heading">
                  <div>
                    <p>Career snapshot</p>
                    <h2>Player statistics</h2>
                  </div>

                  <span>{player.teamName}</span>
                </div>

                <div className="spp-discipline-grid">
                  <article className="spp-discipline">
                    <div className="spp-discipline-heading">
                      <div>
                        <p>Batting</p>
                        <h3>{runs} runs</h3>
                      </div>
                    </div>

                    <div className="spp-stat-list">
                      <div>
                        <span>Runs</span>
                        <strong>{runs}</strong>
                      </div>

                      <div>
                        <span>Balls faced</span>
                        <strong>{ballsFaced}</strong>
                      </div>

                      <div>
                        <span>Strike rate</span>
                        <strong>{strikeRate}</strong>
                      </div>

                      <div>
                        <span>Fours</span>
                        <strong>{fours}</strong>
                      </div>

                      <div>
                        <span>Sixes</span>
                        <strong>{sixes}</strong>
                      </div>
                    </div>
                  </article>

                  <article className="spp-discipline">
                    <div className="spp-discipline-heading">
                      <div>
                        <p>Bowling</p>
                        <h3>{wickets} wickets</h3>
                      </div>
                    </div>

                    <div className="spp-stat-list">
                      <div>
                        <span>Wickets</span>
                        <strong>{wickets}</strong>
                      </div>

                      <div>
                        <span>Overs</span>
                        <strong>{overs}</strong>
                      </div>

                      <div>
                        <span>Runs conceded</span>
                        <strong>{runsConceded}</strong>
                      </div>

                      <div>
                        <span>Economy</span>
                        <strong>{economy}</strong>
                      </div>
                    </div>
                  </article>
                </div>
              </section>

              <section className="spp-history-section">
                <div className="spp-section-heading">
                  <div>
                    <p>Recent appearances</p>
                    <h2>Match history</h2>
                  </div>

                  <span>
                    {playerMatches.length}{" "}
                    {playerMatches.length === 1 ? "appearance" : "appearances"}
                  </span>
                </div>

                {playerMatches.length === 0 ? (
                  <div className="spp-empty">
                    <span aria-hidden="true">—</span>
                    <div>
                      <strong>No match history yet</strong>
                      <p>This player has not appeared in scored matches yet.</p>
                    </div>
                  </div>
                ) : (
                  <div className="spp-match-list">
                    {playerMatches.map((match, index) => {
                      const statusClass = getStatusClass(match.status);

                      return (
                        <article className="spp-match-row" key={match.id}>
                          <span className="spp-match-number" aria-hidden="true">
                            {String(index + 1).padStart(2, "0")}
                          </span>

                          <div className="spp-match-copy">
                            <div className="spp-match-title-line">
                              <span className={`spp-status ${statusClass}`}>
                                <span aria-hidden="true" />
                                {formatStatus(match.status)}
                              </span>
                              <strong>{match.title}</strong>
                            </div>

                            <div className="spp-performance-line">
                              <span><b>{match.runs}</b> runs</span>
                              <span><b>{match.balls}</b> balls</span>
                              <span><b>{match.wickets}</b> wickets</span>
                            </div>
                          </div>

                          {match.shareCode ? (
                            <a href={`/live/${match.shareCode}`}>
                              Scorecard
                              <span aria-hidden="true">→</span>
                            </a>
                          ) : (
                            <span className="spp-unavailable">No scorecard</span>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <aside className="spp-side-column">
              <section className="spp-player-summary">
                <p>Player overview</p>
                <h2>{player.name}</h2>
                <span>
                  Public batting, bowling and match-performance data generated
                  from scored league matches.
                </span>
              </section>

              <section className="spp-summary-list">
                <div>
                  <span>Team</span>
                  <strong>{player.teamName}</strong>
                </div>

                <div>
                  <span>League</span>
                  <strong>{league.name}</strong>
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
                  <span>Strike rate</span>
                  <strong>{strikeRate}</strong>
                </div>

                <div>
                  <span>Economy</span>
                  <strong>{economy}</strong>
                </div>
              </section>
            </aside>
          </section>

          <footer className="spp-footer-note">
            This public profile updates automatically as new league deliveries
            are scored.
          </footer>
        </div>
      </section>
    </main>
  );
}