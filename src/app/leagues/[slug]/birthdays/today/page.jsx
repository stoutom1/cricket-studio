import BirthdayTodayClient from "./BirthdayTodayClient";

export default async function BirthdayTodayPage({
  params,
  searchParams,
}) {
  const resolvedParams = await params;
  const resolvedSearchParams =
    await searchParams;

  console.log(
    "BIRTHDAY PAGE PARAMS:",
    resolvedParams
  );

  const rawLeagueId =
    Object.values(resolvedParams ?? {})[0];

  const leagueId = Number(rawLeagueId);

  console.log(
    "BIRTHDAY PAGE VALUES:",
    {
      rawLeagueId,
      leagueId,
      isInteger:
        Number.isInteger(leagueId),
    }
  );

  if (
    !Number.isInteger(leagueId) ||
    leagueId <= 0
  ) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Page parameter error</h2>

        <pre>
          {JSON.stringify(
            {
              resolvedParams,
              rawLeagueId,
              leagueId:
                Number.isNaN(leagueId)
                  ? "NaN"
                  : leagueId,
            },
            null,
            2
          )}
        </pre>
      </div>
    );
  }

  const rawBirthdayId =
    resolvedSearchParams?.birthdayId;

  const birthdayId =
    rawBirthdayId !== undefined
      ? Number(rawBirthdayId)
      : null;

  return (
    <div>
      <BirthdayTodayClient
        leagueId={leagueId}
        initialBirthdayId={
          Number.isInteger(birthdayId) &&
          birthdayId > 0
            ? birthdayId
            : null
        }
      />
    </div>
  );
}