import Link from "next/link";
import { absoluteCric4AllUrl } from "@/lib/seo";

export const metadata = {
  title: "Net Run Rate Explained | Cric4All Cricket Guide",
  description: "How net run rate works in cricket. A practical community-cricket explanation from Cric4All.",
  alternates: { canonical: absoluteCric4AllUrl("/guides/net-run-rate") },
};

export default function Page() {
  return <main className="c4-article-page"><article className="c4-article">
    <p className="c4-eyebrow">Cric4All Cricket Guide</p>
    <h1>Net Run Rate Explained</h1>
    <p className="c4-article-intro">Net run rate (NRR) is a way of comparing how quickly a team scores with how quickly its opponents score across the matches included in a competition. It is useful in league tables because two teams can finish level on points but have performed very differently with the bat and ball.</p>
    <h2>The basic idea</h2><p>For a set of matches, calculate the team's total runs scored divided by the overs it faced, then subtract the opponents' total runs divided by the overs they faced. The result is a rate difference, not a percentage. A positive NRR means the team's scoring rate has exceeded the rate it conceded over the matches included.</p>
<h2>Overs are not decimal numbers</h2><p>An over written as 7.3 means seven complete overs plus three balls, not 7.3 decimal overs. In six-ball cricket, 7.3 overs represents 45 legal balls, or 7.5 overs when converted for arithmetic. This distinction is one of the most common sources of incorrect manual NRR calculations.</p>
<h2>All-out innings need competition rules</h2><p>Many competitions treat a team that is bowled out before using its full allocation as having faced the full quota of overs for NRR purposes. Reduced-overs matches and competition-specific regulations can change the calculation. Always use the playing conditions that govern the competition rather than assuming every tournament uses identical rules.</p>
<h2>A simple example</h2><p>Suppose Team A scores 150 in 20 overs and concedes 130 in 20 overs. Its scoring rate is 7.50 runs per over and its conceded rate is 6.50. For that example, the rate difference is +1.00. Across a season, the calculation uses the aggregate runs and applicable overs from all included matches rather than averaging individual match NRR values.</p>
<h2>Why accurate scoring matters</h2><p>NRR depends on the underlying match totals and legal-ball counts. Wides and no-balls add runs but do not consume a legal delivery, while other events can affect both score and balls. Accurate ball-by-ball records make the season calculation much more dependable.</p>
<h2>What to check before publishing standings</h2><p>Confirm which matches count, how abandoned or no-result games are treated, whether an all-out innings uses the full allocation, and whether any competition-specific adjustments apply. Then make sure the displayed table and the competition's official playing conditions agree.</p>
    <div className="c4-article-actions"><Link href="/guides">All cricket guides</Link><Link href="/explore">Explore public leagues</Link><Link href="/help">Cric4All help</Link></div>
    <p className="c4-guide-disclaimer">This is a general scoring and league-management guide. Use the Laws of Cricket and your competition's official playing conditions when they specify a different procedure.</p>
  </article></main>;
}
