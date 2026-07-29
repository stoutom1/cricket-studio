import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canUseAIStrategy } from "@/lib/aiStrategyAccess";
import AITeamSplitterClient from "./AITeamSplitterClient";
import "./team-builder-v2.css";

export const runtime = "nodejs";

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

export default async function AITeamSplitterPage() {
  const session = await getServerSession(authOptions);
  const allowAIStrategy = canUseAIStrategy(session?.user?.email);

  return (
    <Suspense fallback={<TeamBuilderLoading />}>
      <AITeamSplitterClient allowAIStrategy={allowAIStrategy} />
    </Suspense>
  );
}
