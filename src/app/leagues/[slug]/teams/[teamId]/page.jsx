import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import "@/app/public-league-wow.css";

function normalizeStatus(status) {
  return String(status || "SCHEDULED").toUpperCase();
}

function getInitials(name) {
  return (
    String(name || "Team")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "TM"
  );
}

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
      normalizeStatus(match.status)
    )
  );

  const wins = completedMatches.filter((match) =>
    String(match.statusText || "")
      .toLowerCase()
      .includes(String(team.name || "").toLowerCase())
  ).length;

  const losses = completedMatches.length - wins;
  const playerCount = team.players?.length || 0;
  const winRate = completedMatches.length
    ? Math.round((wins / completedMatches.length) * 100)
    : 0;

  return (
    <main className="stp-page">
      <section className="stp-shell">
        <header className="stp-hero">
          <div className="stp-topline">
            <nav className="stp-breadcrumb" aria-label="Breadcrumb">
              <Link href="/explore">Explore</Link>
              <span>/</span>
              <Link href={`/leagues/${league.slug}`}>{league.name}</Link>
              <span>/</span>
              <strong>{team.name}</strong>
            </nav>

            <span className="stp-public-label">
              <span aria-hidden="true" />
              Public team
            </span>
          </div>

          <div className="stp-hero-main">
            <div className="stp-team-identity">
              <span className="stp-team-mark" aria-hidden="true">
                {getInitials(team.name)}
              </span>

              <div>
                <p className="stp-kicker">Cric4All Team Profile</p>
                <h1>{team.name}</h1>
                <p className="stp-subtitle">
                  Competing in <strong>{league.name}</strong>
                </p>
              </div>
            </div>

            <div className="stp-actions">
              <Link href={`/leagues/${league.slug}`}>Back to league</Link>
              <Link className="stp-primary-action" href="/explore">
                Explore leagues
              </Link>
            </div>
          </div>

          <div className="stp-record-line">
            <span><b>{playerCount}</b> Players</span>
            <span><b>{teamMatches.length}</b> Matches</span>
            <span><b>{wins}</b> Wins</span>
            <span><b>{losses}</b> Losses</span>
            <span>
              <b>{completedMatches.length ? `${winRate}%` : "—"}</b> Win rate
            </span>
          </div>
        </header>

        <div className="stp-content">
          <section className="stp-summary">
            <div className="stp-section-heading">
              <div>
                <p>Team record</p>
                <h2>Season overview</h2>
              </div>

              <span>
                {completedMatches.length
                  ? `${wins} wins from ${completedMatches.length} completed matches`
                  : "No completed matches yet"}
              </span>
            </div>

            <div className="stp-summary-list">
              <div>
                <span>Squad size</span>
                <strong>{playerCount}</strong>
                <small>Registered players</small>
              </div>

              <div>
                <span>Total fixtures</span>
                <strong>{teamMatches.length}</strong>
                <small>League matches involving this team</small>
              </div>

              <div>
                <span>Wins</span>
                <strong>{wins}</strong>
                <small>Completed matches won</small>
              </div>

              <div>
                <span>Losses</span>
                <strong>{losses}</strong>
                <small>Completed matches lost</small>
              </div>

              <div>
                <span>Win rate</span>
                <strong>{completedMatches.length ? `${winRate}%` : "—"}</strong>
                <small>Based on completed matches</small>
              </div>
            </div>
          </section>

          <section className="stp-roster">
            <div className="stp-section-heading">
              <div>
                <p>Team directory</p>
                <h2>Squad</h2>
              </div>

              <span>
                {playerCount} {playerCount === 1 ? "player" : "players"}
              </span>
            </div>

            {playerCount ? (
              <div className="stp-player-list">
                {team.players.map((player, index) => (
                  <Link
                    key={player.id}
                    href={`/leagues/${league.slug}/players/${player.id}`}
                    className="stp-player-row"
                  >
                    <span className="stp-player-number" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="stp-player-avatar" aria-hidden="true">
                      {getInitials(player.name)}
                    </span>

                    <span className="stp-player-copy">
                      <small>Player</small>
                      <strong>{player.name}</strong>
                    </span>

                    <span className="stp-player-action">
                      View profile
                      <b aria-hidden="true">→</b>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="stp-empty">
                <span aria-hidden="true">—</span>
                <div>
                  <strong>No players yet</strong>
                  <p>Players will appear here once they are added.</p>
                </div>
              </div>
            )}
          </section>

          <footer className="stp-footer-note">
            This public team profile updates automatically from the league roster
            and match records.
          </footer>
        </div>
      </section>
    </main>
  );
}
