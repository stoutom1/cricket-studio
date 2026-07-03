import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-lite">
      <section className="home-hero-lite">
        <div className="home-badge">🏏 Cric4All • Live Cricket Scoring</div>

        <h1>Score cricket matches live. Share scorecards instantly.</h1>

        <p>
          Cric4All helps local leagues, teams, and scorers manage matches,
          live scorecards, stats, commentary, and spectator links.
        </p>

        <div className="home-actions-lite">
          <Link href="/dashboard" className="home-primary">
            Open Dashboard
          </Link>

          <Link href="/login" className="home-secondary">
            Sign In
          </Link>
        </div>

        <div className="home-trust-row">
          <span>⚡ Fast scoring</span>
          <span>📊 Player stats</span>
          <span>🔗 Live share links</span>
        </div>
      </section>
    </main>
  );
}