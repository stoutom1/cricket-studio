import BirthdayTodayClient from "./BirthdayTodayClient";

export default async function BirthdayTodayPage({
  params,
  searchParams,
}) {
  const { leagueId } = await params;
  const { birthdayId } = await searchParams;

  return (
    <BirthdayTodayClient
      leagueId={Number(leagueId)}
      initialBirthdayId={
        birthdayId ? Number(birthdayId) : null
      }
    />
  );
}