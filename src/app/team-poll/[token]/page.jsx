import TeamPollClient from "./TeamPollClient";

export default async function TeamPollPage({ params }) {
  const { token } = await params;
  return <TeamPollClient token={token} />;
}