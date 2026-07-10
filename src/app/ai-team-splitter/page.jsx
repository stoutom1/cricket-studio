import { Suspense } from "react";
import AITeamSplitterClient from "./AITeamSplitterClient";

function TeamSplitterLoading() {
  return (
    <main className="ai-splitter-page">
      <section className="ai-splitter-hero">
        <span className="ai-kicker">Cric4All Team Builder</span>
        <h1>⚖️ Availability & Balanced Teams</h1>
        <p>Loading your league teams and player pools...</p>
      </section>

      <section className="ai-splitter-card">
        <div className="ai-empty-box">
          Loading Team Builder...
        </div>
      </section>
    </main>
  );
}

export default function AITeamSplitterPage() {
  return (
    <Suspense fallback={<TeamSplitterLoading />}>
      <AITeamSplitterClient />
    </Suspense>
  );
}