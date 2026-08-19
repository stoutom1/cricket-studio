import MatchDayCommandCenter from "./MatchDayCommandCenter";

export const dynamic =
  "force-dynamic";
export const revalidate = 0;

export default async function MatchDayPage({
  params,
}) {
  const {
    slug,
  } = await params;

  return (
    <MatchDayCommandCenter
      leagueId={Number(slug)}
    />
  );
}
