import Link from "next/link";
import { absoluteCric4AllUrl } from "@/lib/seo";

export const metadata = {
  title: "Super Overs Explained | Cric4All Cricket Guide",
  description: "How tied limited-overs matches can be decided. A practical community-cricket explanation from Cric4All.",
  alternates: { canonical: absoluteCric4AllUrl("/guides/super-over") },
};

export default function Page() {
  return <main className="c4-article-page"><article className="c4-article">
    <p className="c4-eyebrow">Cric4All Cricket Guide</p>
    <h1>Super Overs Explained</h1>
    <p className="c4-article-intro">A Super Over is an additional short contest used by some competitions to decide a match that is tied after the regulation innings. The exact procedure is controlled by the competition's playing conditions, so the scorer should confirm those rules before the match.</p>
    <h2>When a Super Over applies</h2><p>Not every tied cricket match uses a Super Over. Some competitions allow a tie to stand, while others use a Super Over or another tie-break procedure. The scorer should follow the rules for that specific league or tournament.</p>
<h2>Treat it as additional match data</h2><p>The regulation innings should remain intact. A Super Over is additional scoring information used to determine the result; it should not overwrite or distort the original tied totals.</p>
<h2>Set the participants carefully</h2><p>Confirm the batting team, eligible batters and bowler under the playing conditions. Because the contest is so short, a mistaken player selection can immediately make the scorecard confusing.</p>
<h2>Record every delivery</h2><p>Runs, extras, wickets and legal balls still matter. Wides and no-balls can be especially significant in a one-over contest because they add runs and generally require another legal delivery.</p>
<h2>Result presentation</h2><p>After the tie-break is complete, the public result should make clear that the regulation match was tied and that the final outcome was decided by the Super Over. Cric4All's scoring and scorecard workflows are designed to keep the additional innings visible rather than presenting the match as an unresolved tie.</p>
<h2>Check local rules</h2><p>Eligibility, wicket limits and repeated tie procedures can differ. The competition's official playing conditions should always take precedence over a generic explanation.</p>
    <div className="c4-article-actions"><Link href="/guides">All cricket guides</Link><Link href="/explore">Explore public leagues</Link><Link href="/help">Cric4All help</Link></div>
    <p className="c4-guide-disclaimer">This is a general scoring and league-management guide. Use the Laws of Cricket and your competition's official playing conditions when they specify a different procedure.</p>
  </article></main>;
}
