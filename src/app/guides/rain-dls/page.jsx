import Link from "next/link";
import { absoluteCric4AllUrl } from "@/lib/seo";

export const metadata = {
  title: "Rain, Reduced Overs & DLS | Cric4All Cricket Guide",
  description: "A practical guide for community cricket scorers. A practical community-cricket explanation from Cric4All.",
  alternates: { canonical: absoluteCric4AllUrl("/guides/rain-dls") },
};

export default function Page() {
  return <main className="c4-article-page"><article className="c4-article">
    <p className="c4-eyebrow">Cric4All Cricket Guide</p>
    <h1>Rain, Reduced Overs & DLS</h1>
    <p className="c4-article-intro">Rain can change more than the number of overs left in a cricket match. A scorer needs to preserve the score at the interruption, understand the revised playing conditions and record any target or innings adjustment supplied by the match officials or competition.</p>
    <h2>Record the interruption accurately</h2><p>Before changing anything, preserve the current score, wickets, legal balls, striker, non-striker and bowler. The exact state at the interruption can matter when the match resumes or when a revised target is determined.</p>
<h2>Reduced overs</h2><p>If the available playing time is shortened, the innings allocation may be reduced. The scorer should use the revised number supplied under the competition's playing conditions rather than independently estimating how many overs remain.</p>
<h2>What DLS is for</h2><p>The Duckworth-Lewis-Stern method is designed to set a revised target in limited-overs cricket when playing time is lost. It considers resources represented by overs remaining and wickets lost. It is not simply a proportional reduction of the original target.</p>
<h2>Do not invent a target</h2><p>For an official competition, the revised target should come from the authorized DLS calculation or the match officials using the competition's approved process. Cric4All can support rain/DLS match workflows, but the governing playing conditions remain authoritative.</p>
<h2>When play resumes</h2><p>Confirm the revised innings length or target before the next delivery. Check the batting pair and bowler, then make sure the score display communicates the new chase requirement clearly to players and spectators.</p>
<h2>After the match</h2><p>The completed scorecard should preserve enough context to explain why the innings length or target differs from the original setup. That makes the result understandable later instead of leaving a seemingly unexplained score.</p>
    <div className="c4-article-actions"><Link href="/guides">All cricket guides</Link><Link href="/explore">Explore public leagues</Link><Link href="/help">Cric4All help</Link></div>
    <p className="c4-guide-disclaimer">This is a general scoring and league-management guide. Use the Laws of Cricket and your competition's official playing conditions when they specify a different procedure.</p>
  </article></main>;
}
