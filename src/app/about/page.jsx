import Link from "next/link";
import { absoluteCric4AllUrl } from "@/lib/seo";

export const metadata = {
  title: "About Cric4All | Community Cricket Scoring",
  description: "Learn why Cric4All was created and how it connects cricket scoring, league management, statistics and spectator pages.",
  alternates: { canonical: absoluteCric4AllUrl("/about") },
};

export default function AboutPage() {
  return (
    <main className="c4-article-page">
      <article className="c4-article">
        <p className="c4-eyebrow">About Cric4All</p>
        <h1>Helping community cricket keep a better record of the game</h1>
        <p className="c4-article-intro">Cric4All is a comprehensive cricket scoring and league-management platform designed for clubs, leagues, academies, tournaments and local cricket communities. It is operated by VSJ Serv LLC and built around a simple idea: match-day scoring should be practical for scorers and useful to players and spectators long after the match ends.</p>

        <h2>Why Cric4All exists</h2>
        <p>Community cricket often relies on volunteers. The scorer may also be a player, captain or organizer, and the ground may not have dependable connectivity. Players still want accurate scorecards, season statistics and an easy way to share the game. Cric4All brings those jobs together instead of treating scoring as an isolated counter.</p>

        <h2>What the platform enables</h2>
        <ul className="c4-article-list">
          <li>Create and manage leagues</li><li>Manage teams and player rosters</li><li>Create and schedule matches</li><li>Score matches ball-by-ball</li><li>Track batting and bowling statistics</li><li>Manage tournaments and standings</li><li>Share live scoreboards with spectators</li>
        </ul>

        <h2>From a ball to a season</h2>
        <p>A delivery can change the score, striker, bowler figures, partnership and match situation at the same time. Cric4All records ball-by-ball events so completed matches contribute to scorecards, standings, player statistics, records, milestones and other league views.</p>

        <h2>Designed for different people around the same match</h2>
        <p>Scorers need controls and validation. League organizers need teams, fixtures, roles and administration. Players want their performances and history. Spectators want a clean public view. Cric4All separates those experiences while keeping them connected to the same match data.</p>

        <h2>Core features</h2>
        <ul className="c4-article-list"><li>Live and offline-friendly scoring</li><li>League management</li><li>Player statistics and match history</li><li>Role-based access</li><li>Mobile-friendly scorer and spectator experiences</li><li>Rain/DLS workflows, super overs and powerplays</li></ul>

        <h2>Our mission</h2>
        <p>To make cricket scoring simple, powerful and accessible for cricket communities while preserving the records and performances that make every season meaningful.</p>

        <div className="c4-article-actions"><Link href="/explore">Explore public cricket</Link><Link href="/guides/cricket-scoring">Read the scoring guide</Link><Link href="/help">Open Cric4All help</Link><Link href="/contact">Contact Cric4All</Link></div>
        <p className="c4-version-note">Cric4All • Version 1.0</p>
      </article>
    </main>
  );
}
