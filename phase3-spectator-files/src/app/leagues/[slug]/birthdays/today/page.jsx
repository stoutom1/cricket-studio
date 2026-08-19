import {
  getServerSession,
} from "next-auth";
import {
  redirect,
} from "next/navigation";

import {
  authOptions,
} from "@/lib/auth";
import {
  requireBirthdayViewer,
} from "@/lib/leagueBirthdayAccess";

import BirthdayTodayClient from "./BirthdayTodayClient";

export default async function BirthdayTodayPage({
  params,
  searchParams,
}) {
  const resolvedParams =
    await params;

  const resolvedSearchParams =
    await searchParams;

  const rawLeagueId =
    resolvedParams?.slug ??
    resolvedParams?.id ??
    resolvedParams?.leagueId ??
    Object.values(
      resolvedParams ??
      {}
    )[0];

  const leagueId =
    Number(rawLeagueId);

  if (
    !Number.isInteger(
      leagueId
    ) ||
    leagueId <= 0
  ) {
    return (
      <div
        style={{
          padding: 20,
        }}
      >
        <h2>
          Page parameter error
        </h2>

        <p>
          A valid league ID is required.
        </p>
      </div>
    );
  }

  const session =
    await getServerSession(
      authOptions
    );

  if (
    !session?.user?.email
  ) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(
        `/leagues/${leagueId}/birthdays/today`
      )}`
    );
  }

  const access =
    await requireBirthdayViewer({
      userId:
        session.user.id,

      email:
        session.user.email,

      leagueId,
    });

  if (!access.allowed) {
    return (
      <main className="birthday-page">
        <section className="birthday-error-card">
          <div className="birthday-error-icon">
            !
          </div>

          <div>
            <h2>
              Birthday access unavailable
            </h2>

            <p>
              {access.error}
            </p>
          </div>
        </section>
      </main>
    );
  }

  const rawBirthdayId =
    resolvedSearchParams
      ?.birthdayId;

  const birthdayId =
    rawBirthdayId !==
    undefined
      ? Number(
          rawBirthdayId
        )
      : null;

  return (
    <BirthdayTodayClient
      leagueId={
        leagueId
      }
      readOnly={
        access.isReadOnly
      }
      initialBirthdayId={
        Number.isInteger(
          birthdayId
        ) &&
        birthdayId > 0
          ? birthdayId
          : null
      }
    />
  );
}
