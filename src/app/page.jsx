import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-lite">
      <section className="home-hero-lite">
        <div className="home-hero-grid">
          <div className="home-left">
            <div className="home-badge">🏏 Cric4All • Live Cricket Scoring</div>

            <h2>Professional cricket scoring for leagues, clubs and tournaments.</h2>

            <p>
              Manage live scoring, scorecards, player statistics, AI insights,
              league management and spectator sharing from one simple platform.
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
          </div>

          <div className="home-right">
            <div className="feature-card">
              <span>🏏</span>
              <h3>Live Scoring</h3>
              <p>Ball-by-ball scoring with professional scorecards.</p>
            </div>

            <div className="feature-card">
              <span>📊</span>
              <h3>Player Statistics</h3>
              <p>Batting, bowling, fielding, captaincy and wicketkeeping records.</p>
            </div>

            <div className="feature-card">
              <span>🌍</span>
              <h3>Share Live</h3>
              <p>Public spectator links for friends, family and clubs.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}