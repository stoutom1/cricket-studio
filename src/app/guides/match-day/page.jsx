import Link from "next/link";
import { absoluteCric4AllUrl } from "@/lib/seo";

export const metadata = {
  title: "Community Cricket Match-Day Guide | Cric4All Cricket Guide",
  description: "From preparation and kit to the final scorecard. A practical community-cricket explanation from Cric4All.",
  alternates: { canonical: absoluteCric4AllUrl("/guides/match-day") },
};

export default function Page() {
  return <main className="c4-article-page"><article className="c4-article">
    <p className="c4-eyebrow">Cric4All Cricket Guide</p>
    <h1>Community Cricket Match-Day Guide</h1>
    <p className="c4-article-intro">A smooth match day begins before the toss. Community cricket often depends on volunteers, shared equipment and changing availability, so a small amount of preparation can prevent delays once players arrive at the ground.</p>
    <h2>Confirm the fixture</h2><p>Check the teams, venue, start time, overs and any competition-specific rules. Make sure captains and the scorer know whether rain rules, powerplays or a tie-break procedure could apply.</p>
<h2>Confirm players and roles</h2><p>Review the available squad and identify the people responsible for captaincy, wicketkeeping and scoring. If your league uses permissions, make sure the scorer can access the match before arriving at the ground.</p>
<h2>Know where the kit is</h2><p>Shared cricket kit can easily become a match-day problem. Record who currently holds it and who is responsible for bringing it to the next fixture. Cric4All includes kit tracking and configured reminder workflows for leagues that use them.</p>
<h2>Set up scoring after the toss</h2><p>Confirm who bats first, then select the opening striker, non-striker and bowler. Verify the innings length before recording the first ball.</p>
<h2>Check during natural breaks</h2><p>Use over breaks, wickets and drinks breaks to compare the total, wickets, extras and player figures. Correcting one recent delivery is much easier than reconstructing several overs later.</p>
<h2>Finish the record</h2><p>At the end, confirm the result, final innings state and any special outcome such as DLS or a Super Over. A complete match record then supports public scorecards, player statistics, standings and the league's longer history.</p>
    <div className="c4-article-actions"><Link href="/guides">All cricket guides</Link><Link href="/explore">Explore public leagues</Link><Link href="/help">Cric4All help</Link></div>
    <p className="c4-guide-disclaimer">This is a general scoring and league-management guide. Use the Laws of Cricket and your competition's official playing conditions when they specify a different procedure.</p>
  </article></main>;
}
