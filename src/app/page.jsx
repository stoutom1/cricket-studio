import Link from "next/link";
import GrowthTracker from "@/components/growth-tracker";

export default function HomePage() {
  return (
    <main className="home-lite">
      <GrowthTracker eventType="LANDING_VIEW" />
      <section className="home-hero-lite">
        <div className="home-hero-grid">
          <div className="home-left">
            <div className="home-badge">🏏 Cric4All • Score Anywhere</div>

            <h2>Start scoring a real cricket match in about a minute.</h2>

            <p>
              Live and offline scoring, DLS/rain workflows, scorecards, player
              statistics, AI insights, league management, and spectator sharing
              from one cricket platform.
            </p>

            <div className="home-actions-lite">
              <Link
                href="/score-now"
                className="home-primary"
                style={{
                  textAlign: "center",
                }}
              >
                🏏 Score a Match Free
              </Link>

              <Link href="/dashboard" className="home-secondary">
                Open Dashboard
              </Link>

              <Link href="/login" className="home-secondary">
                Sign In
              </Link>
            </div>

            <div className="home-trust-row">
              <span>⚡ Quick setup</span>
              <span>📴 Offline capable</span>
              <span>🌧 Rain / DLS</span>
              <span>🔗 Share live</span>
            </div>

            <p
              style={{
                marginTop: 12,
                fontSize: 13,
                opacity: 0.76,
              }}
            >
              No app install required to get started. Create the match first,
              then Cric4All opens the normal scorer workflow.
            </p>
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