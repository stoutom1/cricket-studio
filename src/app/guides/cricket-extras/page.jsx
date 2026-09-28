import Link from "next/link";
import { absoluteCric4AllUrl } from "@/lib/seo";

export const metadata = {
  title: "Cricket Extras Explained | Cric4All Cricket Guide",
  description: "Wides, no-balls, byes and leg byes. A practical community-cricket explanation from Cric4All.",
  alternates: { canonical: absoluteCric4AllUrl("/guides/cricket-extras") },
};

export default function Page() {
  return <main className="c4-article-page"><article className="c4-article">
    <p className="c4-eyebrow">Cric4All Cricket Guide</p>
    <h1>Cricket Extras Explained</h1>
    <p className="c4-article-intro">Extras add to the team total without always being credited to the batter. Recording the correct extra type matters because it affects the innings total, batter statistics, bowler figures and the legal-ball count.</p>
    <h2>Wides</h2><p>A wide adds at least one extra and does not count as a legal delivery. Additional runs can be completed on the same ball. Because the delivery is not legal, the bowler must still deliver another legal ball before the over can finish.</p>
<h2>No-balls</h2><p>A no-ball adds a penalty extra and does not count as a legal delivery. Other runs may also be scored on the delivery. A scorer should keep the no-ball component separate from runs off the bat or other applicable runs so individual figures remain correct.</p>
<h2>Byes</h2><p>Byes are runs completed when the ball has not been hit by the bat and the conditions for a bye are met. They increase the team total but are not credited to the batter. They are also treated differently from wides and no-balls in bowling figures.</p>
<h2>Leg byes</h2><p>Leg byes are team extras arising after the ball contacts the batter rather than the bat, subject to the laws and playing conditions. As with byes, they are not batter runs, so choosing the correct scoring action matters.</p>
<h2>Legal deliveries and the over</h2><p>In standard six-ball cricket, wides and no-balls do not advance the legal-delivery count. Byes and leg byes can occur on legal balls. That difference affects when the over ends and which bowler is eligible for the following over.</p>
<h2>A scorer's practical check</h2><p>After an unusual delivery, verify four things: the team total change, batter runs, extra type and legal-ball count. If those four are right, the resulting scorecard is much less likely to drift out of balance.</p>
    <div className="c4-article-actions"><Link href="/guides">All cricket guides</Link><Link href="/explore">Explore public leagues</Link><Link href="/help">Cric4All help</Link></div>
    <p className="c4-guide-disclaimer">This is a general scoring and league-management guide. Use the Laws of Cricket and your competition's official playing conditions when they specify a different procedure.</p>
  </article></main>;
}
