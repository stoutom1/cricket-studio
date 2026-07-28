import { Suspense } from "react";
import AITeamSplitterClient from "./AITeamSplitterClient";
import "./team-builder-v2.css";

function TeamBuilderLoading() {
  return (
    <main className="c4tb-page">
      <section className="c4tb-loading-card">
        <div className="c4tb-spinner" aria-hidden="true" />
        <h1>Loading Cric4All Team Builder</h1>
        <p>Preparing matches, player pools, availability polls, and statistics.</p>
      </section>
    </main>
  );
}

export default function AITeamSplitterPage() {
  return (
    <Suspense fallback={<TeamBuilderLoading />}>
      <AITeamSplitterClient />
    </Suspense>
  );
}
