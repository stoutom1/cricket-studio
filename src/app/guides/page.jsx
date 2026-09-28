import Link from "next/link";
import { absoluteCric4AllUrl } from "@/lib/seo";

export const metadata = {
  title: "Cricket Guides | Scoring, NRR, DLS, Statistics & Match Day | Cric4All",
  description: "Practical Cric4All cricket guides covering scoring, extras, net run rate, rain and DLS, Super Overs, statistics, league management and community match day.",
  alternates: { canonical: absoluteCric4AllUrl("/guides") },
};

export default function GuidesPage() {
  return <main className="c4-article-page"><section className="c4-guides-hub">
    <p className="c4-eyebrow">CRIC4ALL CRICKET KNOWLEDGE HUB</p>
    <h1>Practical cricket guides for scorers, players and league organizers</h1>
    <p className="c4-article-intro">These guides explain the cricket concepts that sit behind Cric4All's scoring and league workflows. They are written for community cricket: clear enough for a new scorer, but detailed enough to be useful when a match creates an unusual situation.</p>
    <div className="c4-guide-grid">
          <Link className="c4-guide-card" href="/guides/cricket-scoring"><h2>Cricket Scoring Guide</h2><p>Runs, extras, wickets, legal deliveries and scorer checks.</p><span>Read guide →</span></Link>
          <Link className="c4-guide-card" href="/guides/league-management"><h2>League Management Guide</h2><p>Teams, fixtures, roles, public pages and season administration.</p><span>Read guide →</span></Link>
          <Link className="c4-guide-card" href="/guides/net-run-rate"><h2>Net Run Rate Explained</h2><p>How net run rate works in cricket.</p><span>Read guide →</span></Link>
          <Link className="c4-guide-card" href="/guides/cricket-extras"><h2>Cricket Extras Explained</h2><p>Wides, no-balls, byes and leg byes.</p><span>Read guide →</span></Link>
          <Link className="c4-guide-card" href="/guides/rain-dls"><h2>Rain, Reduced Overs & DLS</h2><p>A practical guide for community cricket scorers.</p><span>Read guide →</span></Link>
          <Link className="c4-guide-card" href="/guides/super-over"><h2>Super Overs Explained</h2><p>How tied limited-overs matches can be decided.</p><span>Read guide →</span></Link>
          <Link className="c4-guide-card" href="/guides/cricket-statistics"><h2>Cricket Statistics Explained</h2><p>Batting, bowling and fielding numbers that tell the story.</p><span>Read guide →</span></Link>
          <Link className="c4-guide-card" href="/guides/match-day"><h2>Community Cricket Match-Day Guide</h2><p>From preparation and kit to the final scorecard.</p><span>Read guide →</span></Link>
    </div>
    <p className="c4-guide-disclaimer">Competition rules and official playing conditions take precedence where they differ from a general guide.</p>
  </section></main>;
}
