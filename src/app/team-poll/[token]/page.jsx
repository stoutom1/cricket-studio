import TeamPollClient from "./TeamPollClient";

export default async function TeamPollPage({
  params,
  searchParams,
}) {
  const {
    token,
  } = await params;

  const resolvedSearchParams =
    await searchParams;

  return (
    <TeamPollClient
      token={token}
      returnTo={
        resolvedSearchParams
          ?.returnTo ||
        ""
      }
    />
  );
}
