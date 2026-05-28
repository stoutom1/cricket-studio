import LiveScoreClient from "./LiveScoreClient";

export default async function Page({ params }) {
  const { matchId } = await params;

  return <LiveScoreClient matchId={matchId} />;
}