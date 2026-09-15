import Link from "next/link";
import GrowthTracker from "@/components/growth-tracker";
import { absoluteCric4AllUrl } from "@/lib/seo";

export const metadata = {
  title: "Cric4All | Free Cricket Scoring, League Management & Live Scorecards",
  description: "Score cricket matches online or offline, manage leagues and teams, share live scorecards, track player stats, and explore community cricket on Cric4All.",
  alternates: { canonical: absoluteCric4AllUrl("/") },
  robots: { index: true, follow: true },
};

const features = [
  ["🏏", "Ball-by-ball scoring", "Record runs, extras, wickets, striker changes and bowlers while Cric4All builds the scorecard as the match happens."],
  ["📴", "Offline-friendly match day", "Keep the scorer workflow practical when ground connectivity is unreliable, then continue with the same match experience."],
  ["📊", "Statistics with context", "Turn completed matches into batting, bowling, partnership, form, milestone, record and leaderboard views for the cricket community."],
  ["🌍", "Public spectator experience", "Share public league and match pages so players, families and supporters can follow fixtures, results and scorecards without scorer access."],
  ["🏆", "League management", "Organize teams, players, fixtures, standings, permissions and league workflows in the same place as match scoring."],
  ["🌧", "Real match situations", "Support rain and DLS workflows, super overs, powerplays and other match-day situations that simple score counters do not cover."],
];

export default function HomePage() {
  return (
    <main className="home-lite c4-content-home">
      <GrowthTracker eventType="LANDING_VIEW" />
      <section className="home-hero-lite">
        <div className="home-hero-grid">
          <div className="home-left">
            <div className="home-badge">🏏 Cric4All • Score Anywhere</div>
            <h1>Cricket scoring built for the whole match day.</h1>
            <p>From the first ball to the final scorecard, Cric4All helps community cricket teams score matches, manage leagues, publish results and preserve the performances that matter.</p>
            <div className="home-actions-lite home-action-grid">
              <Link href="/score-now" className="home-action-card home-primary"><span className="home-action-icon">🏏</span><span className="home-action-label">Score a Match</span></Link>
              <Link href="/explore" className="home-action-card home-signin-cta"><span className="home-action-icon">🌍</span><span className="home-action-label">Explore Cricket</span></Link>
              <Link href="/login" className="home-action-card home-dashboard-cta"><span className="home-action-icon">🔐</span><span className="home-action-label">Sign In</span></Link>
            </div>
            <div className="home-trust-row"><span>⚡ Quick setup</span><span>📴 Offline capable</span><span>🌧 Rain / DLS</span><span>🔗 Share live</span></div>
          </div>
          <div className="home-right">
            <div className="feature-card"><span>🏏</span><h3>Live Scoring</h3><p>Ball-by-ball scoring that becomes a lasting scorecard.</p></div>
            <div className="feature-card"><span>📊</span><h3>Cricket Records</h3><p>Use completed matches to build meaningful player and league history.</p></div>
            <div className="feature-card"><span>🌍</span><h3>Share the Game</h3><p>Give spectators a public view without exposing scoring controls.</p></div>
          </div>
        </div>
      </section>

      <section className="c4-editorial-section" aria-labelledby="why-cric4all">
        <p className="c4-eyebrow">Built around real community cricket</p>
        <h2 id="why-cric4all">More than a scoreboard</h2>
        <p className="c4-lead">A cricket match creates much more than a final total. There are partnerships, spells, wickets, milestones, standings and stories across a season. Cric4All keeps those pieces connected so a league can score today and still understand the season later.</p>
        <div className="c4-feature-grid">{features.map(([icon,title,text]) => <article className="c4-content-card" key={title}><span className="c4-card-icon">{icon}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="c4-editorial-section c4-soft-section">
        <div className="c4-two-column">
          <div><p className="c4-eyebrow">For scorers</p><h2>Keep the match moving</h2><p>Scorers need fast controls, but they also need safeguards. Cric4All tracks innings state, strike, bowlers and match progress while keeping the public spectator experience separate from scorer actions.</p><Link className="c4-text-link" href="/guides/cricket-scoring">Read the cricket scoring guide →</Link></div>
          <div><p className="c4-eyebrow">For players and spectators</p><h2>Make completed matches useful</h2><p>Public Cric4All pages can turn match data into scorecards, standings, statistics, records and recent form. That gives a cricket community a useful destination before, during and after match day.</p><Link className="c4-text-link" href="/explore">Explore public leagues →</Link></div>
        </div>
      </section>

      <section className="c4-editorial-section">
        <p className="c4-eyebrow">Learn Cric4All</p><h2>Useful cricket resources</h2>
        <div className="c4-resource-grid">
          <Link href="/guides/cricket-scoring"><strong>Cricket scoring guide</strong><span>Understand runs, extras, wickets, overs and the scorer workflow.</span></Link>
          <Link href="/guides/league-management"><strong>League management guide</strong><span>Plan teams, fixtures, roles, public pages and season records.</span></Link>
          <Link href="/help"><strong>Cric4All help</strong><span>Step-by-step guidance for creating leagues, teams and matches.</span></Link>
          <Link href="/about"><strong>About Cric4All</strong><span>Why the platform exists and how it serves community cricket.</span></Link>
        </div>
      </section>
    </main>
  );
}
