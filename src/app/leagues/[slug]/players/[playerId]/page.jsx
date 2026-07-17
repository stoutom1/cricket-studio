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
  if (
    ["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED"].includes(value)
  ) {
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
      })),
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
      })),
    )
    .find((p) => Number(p.id) === Number(playerId));

  if (!player) notFound();

  const balls = league.matches.flatMap((match) => match.balls || []);

  const battingBalls = balls.filter(
    (ball) => Number(ball.strikerId) === Number(player.id),
  );

  const bowlingBalls = balls.filter(
    (ball) => Number(ball.bowlerId) === Number(player.id),
  );

  const runs = battingBalls.reduce(
    (sum, ball) => sum + Number(ball.runsOffBat || 0),
    0,
  );

  const ballsFaced = battingBalls.filter(
    (ball) =>
      ball.extraType !== "WIDE" &&
      ball.extraType !== "NOBALL" &&
      ball.wicketType !== "RETIRED_HURT",
  ).length;

  const fours = battingBalls.filter(
    (ball) => Number(ball.runsOffBat) === 4,
  ).length;

  const sixes = battingBalls.filter(
    (ball) => Number(ball.runsOffBat) === 6,
  ).length;

  const wickets = bowlingBalls.filter(
    (ball) =>
      ball.isWicket &&
      !["RUN_OUT", "RETIRED_OUT", "RETIRED_HURT"].includes(ball.wicketType) &&
      ball.extraType !== "NOBALL",
  ).length;

  const legalBowls = bowlingBalls.filter(
    (ball) =>
      ball.legalDelivery &&
      ball.extraType !== "WIDE" &&
      ball.extraType !== "NOBALL" &&
      ball.wicketType !== "RETIRED_HURT",
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
        (ball) => Number(ball.strikerId) === Number(player.id),
      );

      const bowling = matchBalls.filter(
        (ball) => Number(ball.bowlerId) === Number(player.id),
      );

      const matchRuns = batting.reduce(
        (sum, ball) => sum + Number(ball.runsOffBat || 0),
        0,
      );

      const matchBallsFaced = batting.filter(
        (ball) =>
          ball.extraType !== "WIDE" &&
          ball.extraType !== "NOBALL" &&
          ball.wicketType !== "RETIRED_HURT",
      ).length;

      const matchWickets = bowling.filter(
        (ball) =>
          ball.isWicket &&
          !["RUN_OUT", "RETIRED_OUT", "RETIRED_HURT"].includes(
            ball.wicketType,
          ) &&
          ball.extraType !== "NOBALL",
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
    <main className="spf-page">
      <section className="spf-shell">
        <header className="spf-hero">
          <div className="spf-topbar">
            <nav className="spf-back-nav" aria-label="Player navigation">
              <Link href="/explore" className="spf-back-button">
                <span aria-hidden="true">←</span>
                Explore
              </Link>

              <Link
                href={`/leagues/${league.slug}`}
                className="spf-context-link"
              >
                {league.name}
              </Link>

              <Link
                href={`/leagues/${league.slug}/teams/${player.teamId}`}
                className="spf-context-link"
              >
                {player.teamName}
              </Link>

              <strong>{player.name}</strong>
            </nav>

            <span className="spf-public-badge">
              <span aria-hidden="true" />
              Public player profile
            </span>
          </div>

          <div className="spf-hero-main">
            <div className="spf-player-identity">
              <div className="spf-player-avatar" aria-hidden="true">
                {getInitials(player.name)}
              </div>

              <div className="spf-player-copy">
                <p className="spf-eyebrow">Cric4All player profile</p>
                <h1>{player.name}</h1>

                <p className="spf-subtitle">
                  <Link href={`/leagues/${league.slug}/teams/${player.teamId}`}>
                    {player.teamName}
                  </Link>
                  <span aria-hidden="true">•</span>
                  <Link href={`/leagues/${league.slug}`}>{league.name}</Link>
                </p>
              </div>
            </div>

            <div className="spf-actions">
              <Link href={`/leagues/${league.slug}/teams/${player.teamId}`}>
                <span aria-hidden="true">←</span>
                Team profile
              </Link>

              <Link href={`/leagues/${league.slug}`}>League home</Link>

              <Link className="spf-action-primary" href="/explore">
                Explore leagues
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div className="spf-profile-note">
            <span aria-hidden="true">🏏</span>
            <p>
              Career statistics and recent performances are calculated from
              scored matches in {league.name}.
            </p>
          </div>
        </header>

        <div className="spf-content">
          <section className="spf-performance-section">
            <div className="spf-section-heading">
              <div>
                <p>Performance overview</p>
                <h2>Career statistics</h2>
              </div>

              <span>
                {playerMatches.length}{" "}
                {playerMatches.length === 1 ? "appearance" : "appearances"}
              </span>
            </div>

            <div className="spf-discipline-grid">
              <article className="spf-discipline-card spf-batting-card">
                <header>
                  <div className="spf-discipline-icon" aria-hidden="true">
                    🏏
                  </div>

                  <div>
                    <span>Batting</span>
                    <h3>Batting record</h3>
                  </div>
                </header>

                <div className="spf-stat-grid">
                  <div className="spf-stat-primary">
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

              <article className="spf-discipline-card spf-bowling-card">
                <header>
                  <div className="spf-discipline-icon" aria-hidden="true">
                    🎯
                  </div>

                  <div>
                    <span>Bowling</span>
                    <h3>Bowling record</h3>
                  </div>
                </header>

                <div className="spf-stat-grid">
                  <div className="spf-stat-primary">
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

          <section className="spf-history-section">
            <div className="spf-section-heading">
              <div>
                <p>Recent appearances</p>
                <h2>Match history</h2>
              </div>

              <span>Latest {Math.min(playerMatches.length, 10)} matches</span>
            </div>

            {playerMatches.length === 0 ? (
              <div className="spf-empty-state">
                <span aria-hidden="true">◌</span>

                <div>
                  <strong>No match history yet</strong>
                  <p>This player has not appeared in any scored matches.</p>
                </div>
              </div>
            ) : (
              <div className="spf-match-list">
                {playerMatches.map((match, index) => {
                  const statusClass = getStatusClass(match.status);

                  return (
                    <article className="spf-match-row" key={match.id}>
                      <span className="spf-match-number" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <div className="spf-match-main">
                        <div className="spf-match-title">
                          <span className={`spf-status ${statusClass}`}>
                            <span aria-hidden="true" />
                            {formatStatus(match.status)}
                          </span>

                          <strong>{match.title}</strong>
                        </div>

                        <div className="spf-match-performance">
                          <span>
                            <b>{match.runs}</b>
                            runs
                          </span>

                          <span>
                            <b>{match.balls}</b>
                            balls
                          </span>

                          <span>
                            <b>{match.wickets}</b>
                            wickets
                          </span>
                        </div>
                      </div>

                      {match.shareCode ? (
                        <a
                          className="spf-scorecard-link"
                          href={`/live/${match.shareCode}`}
                        >
                          Scorecard
                          <span aria-hidden="true">→</span>
                        </a>
                      ) : (
                        <span className="spf-unavailable">No scorecard</span>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <footer className="spf-footer-note">
            <span aria-hidden="true">↻</span>
            This public profile updates automatically as new league deliveries
            are scored.
          </footer>
        </div>
      </section>
    </main>
  );
}