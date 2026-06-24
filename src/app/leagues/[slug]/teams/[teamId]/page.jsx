import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export async function generateMetadata({ params }) {
  const { slug, teamId } = await params;

  const league = await prisma.league.findFirst({
    where: {
      slug,
      visibility: {
        in: ["PUBLIC", "UNLISTED"],
      },
    },
    include: {
      teams: {
        where: {
          id: Number(teamId),
        },
      },
    },
  });

  const team = league?.teams?.[0];

  if (!league || !team) {
    return {
      title: "Team Not Found | Cric4All",
    };
  }

  return {
    title: `${team.name} | ${league.name} | Cric4All`,
    description: `View ${team.name} team roster, matches, results, and public cricket profile for ${league.name}.`,
  };
}

export default async function PublicTeamPage({ params }) {
  const { slug, teamId } = await params;

  const league = await prisma.league.findFirst({
    where: {
      slug,
      visibility: {
        in: ["PUBLIC", "UNLISTED"],
      },
    },
    include: {
      teams: {
        where: {
          id: Number(teamId),
        },
        include: {
          players: {
            orderBy: { name: "asc" },
          },
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

  if (!league || !league.teams?.length) {
    notFound();
  }

  const team = league.teams[0];

  const teamMatches = league.matches.filter(
    (match) =>
      Number(match.teamAId) === Number(team.id) ||
      Number(match.teamBId) === Number(team.id)
  );

  const completedMatches = teamMatches.filter((match) =>
    ["COMPLETED", "COMPLETED_LOCKED"].includes(
      String(match.status || "").toUpperCase()
    )
  );

  const wins = completedMatches.filter((match) =>
    String(match.statusText || "")
      .toLowerCase()
      .includes(String(team.name || "").toLowerCase())
  ).length;

  const losses = completedMatches.length - wins;

  return (
    <main className="public-league-portal public-wow-page">
      <section className="public-wow-hero public-one-piece-card">
        <div className="public-wow-top">
          <div className="public-breadcrumb">
            <Link href="/explore">Explore</Link>
            <span>/</span>
            <Link href={`/leagues/${league.slug}`}>{league.name}</Link>
            <span>/</span>
            <strong>{team.name}</strong>
          </div>

          <div className="spectator-pill">👥 Team Profile</div>
        </div>

        <div className="public-wow-hero-main">
          <div>
            <h2>{team.name}</h2>
            <p>
              Public team profile for {league.name}. View roster, match record,
              results, and player links in one place.
            </p>
          </div>

          <div className="public-wow-stats">
            <div>
              <span>Players</span>
              <strong>{team.players?.length || 0}</strong>
            </div>

            <div>
              <span>Matches</span>
              <strong>{teamMatches.length}</strong>
            </div>

            <div>
              <span>Wins</span>
              <strong>{wins}</strong>
            </div>

            <div>
              <span>Losses</span>
              <strong>{losses}</strong>
            </div>
          </div>
        </div>

        <div className="public-wow-controls team-profile-actions">
          <Link href={`/leagues/${league.slug}`}>🏆 Back to League</Link>
          <Link href="/explore">🧭 Explore Leagues</Link>
        </div>

        <div className="public-tab-content">
          <div className="public-section-head">
            <h2>Team Summary</h2>
          </div>

          <div className="public-card-grid">
            <div className="public-card">
              <span>Players</span>
              <strong>{team.players?.length || 0}</strong>
              <small>Registered roster</small>
            </div>

            <div className="public-card">
              <span>Matches</span>
              <strong>{teamMatches.length}</strong>
              <small>Total fixtures</small>
            </div>

            <div className="public-card">
              <span>Wins</span>
              <strong>{wins}</strong>
              <small>Completed matches</small>
            </div>

            <div className="public-card">
              <span>Losses</span>
              <strong>{losses}</strong>
              <small>Completed matches</small>
            </div>
          </div>

          <div className="public-section-head team-roster-head">
            <h2>Players</h2>
            <span className="team-roster-count">
              {team.players?.length || 0} players
            </span>
          </div>

          {team.players?.length ? (
            <div className="public-card-grid team-player-grid">
              {team.players.map((player) => (
                <Link
                  key={player.id}
                  href={`/leagues/${league.slug}/players/${player.id}`}
                  className="public-card public-card-link team-player-card"
                >
                  <span>Player</span>
                  <strong>{player.name}</strong>
                  <small>View player profile →</small>
                </Link>
              ))}
            </div>
          ) : (
            <div className="public-empty-state">
              <strong>👥 No players yet</strong>
              <span>Players will appear here once they are added.</span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}