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
function buildPublicLeaders(matches) {
  const batting = new Map();
  const bowling = new Map();

  for (const match of matches || []) {
    for (const ball of match.balls || []) {
      if (ball.strikerId) {
        const key = Number(ball.strikerId);

        if (!batting.has(key)) {
          batting.set(key, {
            playerId: key,
            playerName: ball.striker?.name || "Unknown",
            teamName: ball.striker?.team?.name || "",
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
          });
        }

        const row = batting.get(key);

        if (ball.extraType !== "WIDE") {
          row.balls += 1;
        }

        row.runs += Number(ball.batterRuns || 0);

        if (Number(ball.batterRuns || 0) === 4) row.fours += 1;
        if (Number(ball.batterRuns || 0) === 6) row.sixes += 1;
      }

      if (ball.bowlerId) {
        const key = Number(ball.bowlerId);

        if (!bowling.has(key)) {
          bowling.set(key, {
            playerId: key,
            playerName: ball.bowler?.name || "Unknown",
            teamName: ball.bowler?.team?.name || "",
            wickets: 0,
            balls: 0,
            runs: 0,
          });
        }

        const row = bowling.get(key);

        if (ball.legalDelivery) {
          row.balls += 1;
        }

        const bowlerRuns =
          ball.extraType === "BYE" || ball.extraType === "LEGBYE"
            ? 0
            : Number(ball.totalRuns || 0);

        row.runs += bowlerRuns;

        if (
          ball.isWicket &&
          !["RUN_OUT", "RETIRED_HURT", "RETIRED_OUT"].includes(ball.wicketType)
        ) {
          row.wickets += 1;
        }
      }
    }
  }

  const battingStats = [...batting.values()].map((row) => ({
    ...row,
    strikeRate:
      row.balls > 0 ? ((row.runs / row.balls) * 100).toFixed(2) : "0.00",
  }));

  const bowlingStats = [...bowling.values()].map((row) => ({
    ...row,
    economy:
      row.balls > 0 ? ((row.runs / row.balls) * 6).toFixed(2) : "0.00",
  }));

  return {
    battingStats,
    bowlingStats,
    topRunScorer: [...battingStats].sort((a, b) => b.runs - a.runs)[0],
    topSixHitter: [...battingStats].sort((a, b) => b.sixes - a.sixes)[0],
    bestStrikeRate: [...battingStats]
      .filter((p) => p.balls >= 5)
      .sort((a, b) => Number(b.strikeRate) - Number(a.strikeRate))[0],
    topWicketTaker: [...bowlingStats].sort((a, b) => b.wickets - a.wickets)[0],
    bestEconomy: [...bowlingStats]
      .filter((p) => p.balls >= 6)
      .sort((a, b) => Number(a.economy) - Number(b.economy))[0],
  };
}
function formatOversFromBalls(legalBalls) {
  const overs = Math.floor(Number(legalBalls || 0) / 6);
  const balls = Number(legalBalls || 0) % 6;
  return `${overs}.${balls}`;
}

function buildPublicPointsTable(matches, teams) {
  const table = new Map();

  teams.forEach((team) => {
    table.set(Number(team.id), {
      teamId: team.id,
      teamName: team.name,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      points: 0,
    });
  });

  matches
    .filter((m) =>
      ["COMPLETED", "COMPLETED_LOCKED"].includes(normalizeStatus(m.status))
    )
    .forEach((match) => {
      const teamA = table.get(Number(match.teamAId));
      const teamB = table.get(Number(match.teamBId));

      if (!teamA || !teamB) return;

      teamA.played += 1;
      teamB.played += 1;

      const result = String(match.resultText || "").toLowerCase();

      if (result.includes(teamA.teamName.toLowerCase())) {
        teamA.won += 1;
        teamA.points += 2;
        teamB.lost += 1;
      } else if (result.includes(teamB.teamName.toLowerCase())) {
        teamB.won += 1;
        teamB.points += 2;
        teamA.lost += 1;
      } else if (result.includes("tied")) {
        teamA.tied += 1;
        teamB.tied += 1;
        teamA.points += 1;
        teamB.points += 1;
      }
    });

  return [...table.values()].sort(
    (a, b) => b.points - a.points || b.won - a.won
  );
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
balls: {
  include: {
    striker: {
      include: {
        team: true,
      },
    },
    bowler: {
      include: {
        team: true,
      },
    },
  },
  orderBy: [
    { inningsNo: "asc" },
    { sequence: "asc" },
  ],
},
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
const pointsTable = buildPublicPointsTable(league.matches, league.teams);
const {
  topRunScorer,
  topSixHitter,
  bestStrikeRate,
  topWicketTaker,
  bestEconomy,
} = buildPublicLeaders(league.matches);

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

        <section className="public-section">
  <div className="public-section-head">
    <h2>📈 Points Table</h2>
    <span>{pointsTable.length}</span>
  </div>

  <div className="public-table-wrap">
    <table className="public-table">
      <thead>
        <tr>
          <th>Team</th>
          <th>P</th>
          <th>W</th>
          <th>L</th>
          <th>T</th>
          <th>Pts</th>
        </tr>
      </thead>

      <tbody>
        {pointsTable.map((row, index) => (
          <tr key={row.teamId}>
            <td>
              <strong>#{index + 1}</strong> {row.teamName}
            </td>
            <td>{row.played}</td>
            <td>{row.won}</td>
            <td>{row.lost}</td>
            <td>{row.tied}</td>
            <td>
              <strong>{row.points}</strong>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</section>
<section className="public-section">
  <div className="public-section-head">
    <h2>🏆 League Leaders</h2>
  </div>

  <div className="public-leaders-grid">

<div className="leader-card">
  <div className="leader-label">
    🏏 Most Runs
  </div>

  <div className="leader-player">
    {topRunScorer?.playerName}
  </div>

  <div className="leader-team">
    {topRunScorer?.teamName}
  </div>

  <div className="leader-value">
    {topRunScorer?.runs}
  </div>
</div>


    <div className="leader-card">
  <div className="leader-label">
    🎯 Most Wickets
  </div>

  <div className="leader-player">
    {topWicketTaker?.playerName}
  </div>

  <div className="leader-team">
    {topWicketTaker?.teamName}
  </div>
</div>


  <div className="leader-card">
  <div className="leader-label">💥 Most Sixes</div>
  <div className="leader-player">{topSixHitter?.playerName || "No data yet"}</div>
  <div className="leader-team">{topSixHitter?.teamName || ""}</div>
  <div className="leader-value">{topSixHitter?.sixes || 0}</div>
</div>

  </div>
</section>
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