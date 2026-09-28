import Link from "next/link";
import { absoluteCric4AllUrl } from "@/lib/seo";

export const metadata = {
  title: "Cricket Statistics Explained | Cric4All Cricket Guide",
  description: "Batting, bowling and fielding numbers that tell the story. A practical community-cricket explanation from Cric4All.",
  alternates: { canonical: absoluteCric4AllUrl("/guides/cricket-statistics") },
};

export default function Page() {
  return <main className="c4-article-page"><article className="c4-article">
    <p className="c4-eyebrow">Cric4All Cricket Guide</p>
    <h1>Cricket Statistics Explained</h1>
    <p className="c4-article-intro">Cricket statistics become useful when the underlying deliveries are recorded consistently. A good scorecard should let a player understand not only a total, but how that performance was produced and how it compares across a season.</p>
    <h2>Batting runs and strike rate</h2><p>Runs are credited to the batter when scored from the bat. Strike rate is normally runs divided by balls faced multiplied by 100. Correct treatment of wides, no-balls and other non-standard deliveries is important because not every delivery affects balls faced in the same way.</p>
<h2>Batting average</h2><p>Batting average is based on runs divided by dismissals, not simply innings played. Not-outs therefore matter. A player with few innings can also have an eye-catching average, so context and qualification thresholds are useful when displaying leaders.</p>
<h2>Bowling wickets</h2><p>Not every dismissal is credited to the bowler. Run outs, for example, are team dismissals rather than bowler wickets. Accurate dismissal types prevent bowling leaderboards from awarding wickets incorrectly.</p>
<h2>Economy and bowling average</h2><p>Economy describes runs conceded per over, while bowling average compares runs conceded with wickets credited to the bowler. Both depend on consistent attribution of extras and legal deliveries.</p>
<h2>Fielding and wicketkeeping</h2><p>Catches, run-out involvement and wicketkeeping dismissals provide additional context beyond batting and bowling. They should be recorded from the actual match event rather than inferred from the final total.</p>
<h2>Season context</h2><p>Leaderboards, records, milestones, recent form and player comparisons become more meaningful when they are built from the same eligible set of completed matches. Cric4All uses recorded match history to connect individual scorecards with longer-term league views.</p>
    <div className="c4-article-actions"><Link href="/guides">All cricket guides</Link><Link href="/explore">Explore public leagues</Link><Link href="/help">Cric4All help</Link></div>
    <p className="c4-guide-disclaimer">This is a general scoring and league-management guide. Use the Laws of Cricket and your competition's official playing conditions when they specify a different procedure.</p>
  </article></main>;
}
