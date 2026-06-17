import prisma from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

function prettyStatus(status) {
  return String(status || "SCHEDULED")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function PublicLeaguePage({ params }) {
  const { slug } = await params;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      series: {
        orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      },
      teams: {
        include: {
          players: {
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      },
      matches: {
        include: {
          teamA: true,
          teamB: true,
          series: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!league || league.visibility === "PRIVATE") {
    return (
      <main className="public-league-page">
        <section className="public-league-hero">
          <h1>League not available</h1>
          <p>This league is private or does not exist.</p>
        </section>
      </main>
    );
  }

  const totalPlayers = league.teams.reduce(
    (sum, team) => sum + (team.players?.length || 0),
    0
  );

  const completedMatches = league.matches.filter((match) =>
    ["COMPLETED", "COMPLETED_LOCKED"].includes(normalizeStatus(match.status))
  );

  const activeMatches = league.matches.filter((match) =>
    ["IN_PROGRESS", "LIVE"].includes(normalizeStatus(match.status))
  );

  const upcomingMatches = league.matches.filter(
    (match) =>
      !["COMPLETED", "COMPLETED_LOCKED", "IN_PROGRESS", "LIVE"].includes(
        normalizeStatus(match.status)
      )
  );

  const featuredMatch =
    activeMatches[0] || upcomingMatches[0] || completedMatches[0] || null;

  return (
    <main className="public-league-page">
      <section className="public-league-hero">
        <div className="public-league-hero-main">
          <span className="public-league-badge">
            {league.visibility === "PUBLIC"
              ? "🌐 Public League"
              : "🔗 Unlisted League"}
          </span>

          <h1>{league.name}</h1>

          <p>
            Live scores, fixtures, results, teams, and series — powered by
            Cric4All.
          </p>

          <div className="public-hero-actions">
            {featuredMatch?.shareCode && (
              <Link
                className="public-primary-link"
                href={`/live/${featuredMatch.shareCode}`}
              >
                🏟️ View Match Center
              </Link>
            )}

            <span className="public-soft-pill">
              🏏 View-only public page
            </span>
          </div>
        </div>

        <div className="public-league-stats">
          <div>
            <strong>{league.teams.length}</strong>
            <span>Teams</span>
          </div>

          <div>
            <strong>{totalPlayers}</strong>
            <span>Players</span>
          </div>

          <div>
            <strong>{league.series.length}</strong>
            <span>Series</span>
          </div>

          <div>
            <strong>{league.matches.length}</strong>
            <span>Matches</span>
          </div>
        </div>
      </section>

      {activeMatches.length > 0 && (
        <section className="public-live-card">
          <div>
            <span className="live-dot">● LIVE NOW</span>
            <h2>
              {activeMatches[0].teamA?.name} vs {activeMatches[0].teamB?.name}
            </h2>
            <p>
              {activeMatches[0].series?.name
                ? `${activeMatches[0].series.name} • `
                : ""}
              {prettyStatus(activeMatches[0].status)}
            </p>
          </div>

          {activeMatches[0].shareCode && (
            <Link
              className="public-primary-link"
              href={`/live/${activeMatches[0].shareCode}`}
            >
              Watch Live
            </Link>
          )}
        </section>
      )}

      <section className="public-section">
        <div className="public-section-head">
          <h2>📅 Series</h2>
          <span>{league.series.length}</span>
        </div>

        {!league.series.length ? (
          <div className="public-empty-box">
            No series created yet. Matches may still exist as standalone games.
          </div>
        ) : (
          <div className="public-series-strip">
            {league.series.map((series) => (
              <div key={series.id} className="public-series-chip">
                <strong>{series.name}</strong>
                <span>{series.year}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="public-grid-two">
        <div className="public-section">
          <div className="public-section-head">
            <h2>👥 Teams</h2>
            <span>{league.teams.length}</span>
          </div>

          <div className="public-team-grid">
            {league.teams.map((team) => (
              <div key={team.id} className="public-team-card">
                <strong>🏏 {team.name}</strong>
                <span>{team.players.length} players</span>
              </div>
            ))}
          </div>
        </div>

        <div className="public-section">
          <div className="public-section-head">
            <h2>⭐ League Snapshot</h2>
          </div>

          <div className="public-snapshot-list">
            <div>
              <strong>{completedMatches.length}</strong>
              <span>Completed matches</span>
            </div>

            <div>
              <strong>{upcomingMatches.length}</strong>
              <span>Upcoming / scheduled</span>
            </div>

            <div>
              <strong>{activeMatches.length}</strong>
              <span>Currently live</span>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-section-head">
          <h2>🏏 Upcoming / Active Matches</h2>
          <span>{activeMatches.length + upcomingMatches.length}</span>
        </div>

        {activeMatches.length + upcomingMatches.length === 0 ? (
          <div className="public-empty-box">No upcoming matches.</div>
        ) : (
          <div className="public-match-list">
            {[...activeMatches, ...upcomingMatches].map((match) => (
              <div key={match.id} className="public-match-card">
                <div>
                  <strong>
                    {match.teamA?.name} vs {match.teamB?.name}
                  </strong>

                  <span>
                    {match.series?.name ? `${match.series.name} • ` : ""}
                    {prettyStatus(match.status)}
                  </span>
                </div>

                {match.shareCode ? (
                  <Link
                    className="public-match-button"
                    href={`/live/${match.shareCode}`}
                  >
                    🏟️ Open Live Score
                  </Link>
                ) : (
                  <span className="public-muted">No live link</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="public-section">
        <div className="public-section-head">
          <h2>✅ Recent Results</h2>
          <span>{completedMatches.length}</span>
        </div>

        {!completedMatches.length ? (
          <div className="public-empty-box">No completed matches yet.</div>
        ) : (
          <div className="public-match-list">
            {completedMatches.slice(0, 8).map((match) => (
              <div key={match.id} className="public-match-card result">
                <div>
                  <strong>
                    {match.teamA?.name} vs {match.teamB?.name}
                  </strong>

                  <span>
                    {match.series?.name ? `${match.series.name} • ` : ""}
                    {prettyStatus(match.status)}
                  </span>
                </div>

                {match.shareCode ? (
                  <Link
                    className="public-match-button"
                    href={`/live/${match.shareCode}`}
                  >
                    📋 View Scorecard
                  </Link>
                ) : (
                  <span className="public-muted">No scorecard link</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="public-powered-card">
        <strong>🏏 Powered by Cric4All</strong>
        <span>
          Create leagues, score matches, and share live cricket with your
          community.
        </span>
      </footer>
    </main>
  );
}