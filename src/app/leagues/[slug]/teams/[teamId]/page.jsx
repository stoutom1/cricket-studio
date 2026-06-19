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
    <main className="public-league-portal">
      <section className="public-league-hero">
        <div className="public-breadcrumb">
  <Link href="/explore">Explore</Link>
  <span>/</span>
  <Link href={`/leagues/${league.slug}`}>{league.name}</Link>
  <span>/</span>
  <strong>{team.name}</strong>
</div>

        <h1>{team.name}</h1>

        <p>
          Public team profile for {league.name}.
        </p>

        <div className="public-league-badges">
          <span>{team.players?.length || 0} players</span>
          <span>{league.visibility}</span>
        </div>
      </section>
<section className="public-section">
  <h2>Team Summary</h2>

  <div className="public-card-grid">
    <div className="public-card">
      <span>Players</span>
      <strong>{team.players?.length || 0}</strong>
    </div>

    <div className="public-card">
      <span>Matches</span>
      <strong>{teamMatches.length}</strong>
    </div>

    <div className="public-card">
      <span>Wins</span>
      <strong>{wins}</strong>
    </div>

    <div className="public-card">
      <span>Losses</span>
      <strong>{losses}</strong>
    </div>
  </div>
</section>
      <section className="public-section">
        <h2>Players</h2>

        <div className="public-card-grid">
          {team.players.map((player) => (
<Link
  key={player.id}
  href={`/leagues/${league.slug}/players/${player.id}`}
  className="public-card public-card-link"
>
              <span>Player</span>
              <strong>{player.name}</strong>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}