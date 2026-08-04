"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "./match-day.module.css";

function formatDate(value) {
  if (!value) {
    return "Schedule not set";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Schedule not set";
  }

  return date.toLocaleString(
    undefined,
    {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function statusLabel(value) {
  return String(value || "SCHEDULED")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function matchIsLive(match) {
  return [
    "LIVE",
    "IN_PROGRESS",
  ].includes(
    match.status
  );
}

function nextAction(match) {
  if (
    !match.availability
      ?.pollId
  ) {
    return {
      label:
        "Create availability poll",
      href:
        `/ai-team-splitter?leagueId=${match.leagueId || ""}&matchId=${match.id}`,
      icon: "📲",
    };
  }

  if (
    match.readiness
      ?.percentage < 80
  ) {
    return {
      label:
        "Prepare match",
      href:
        `/ai-team-splitter?leagueId=${match.leagueId || ""}&matchId=${match.id}`,
      icon: "⚙️",
    };
  }

  if (matchIsLive(match)) {
    return {
      label:
        "Continue scoring",
      href:
        `/dashboard?tab=scoring&matchId=${match.id}`,
      icon: "🏏",
    };
  }

  return {
    label:
      "Open scoring",
    href:
      `/dashboard?tab=scoring&matchId=${match.id}`,
    icon: "🏏",
  };
}

function ScoreLine({
  innings,
}) {
  if (!innings) {
    return (
      <span className={styles.scoreEmpty}>
        Not started
      </span>
    );
  }

  return (
    <strong className={styles.scoreValue}>
      {innings.runs}/
      {innings.wickets}
      <small>
        {innings.overs} ov
      </small>
    </strong>
  );
}

export default function MatchDayCommandCenter({
  leagueId,
}) {
  const [
    data,
    setData,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    selectedMatchId,
    setSelectedMatchId,
  ] = useState(null);

  const loadCommandCenter =
    useCallback(
      async ({
        background = false,
      } = {}) => {
        if (
          !Number.isInteger(
            Number(leagueId)
          ) ||
          Number(leagueId) <= 0
        ) {
          setError(
            "Invalid league ID."
          );
          setLoading(false);
          return;
        }

        if (background) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        try {
          const response =
            await fetch(
              `/api/leagues/${leagueId}/match-day-command-center`,
              {
                cache:
                  "no-store",
              }
            );

          const result =
            await response.json();

          if (!response.ok) {
            throw new Error(
              result?.error ||
              "Unable to load Match Day."
            );
          }

          setData(
            result
          );

          setSelectedMatchId(
            (current) => {
              if (
                current &&
                result.matches
                  ?.some(
                    (match) =>
                      match.id ===
                      current
                  )
              ) {
                return current;
              }

              const live =
                result.matches
                  ?.find(
                    matchIsLive
                  );

              return (
                live?.id ||
                result.matches?.[0]
                  ?.id ||
                null
              );
            }
          );
        } catch (failure) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Unable to load Match Day."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [leagueId]
    );

  useEffect(() => {
    loadCommandCenter();
  }, [
    loadCommandCenter,
  ]);

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          loadCommandCenter({
            background: true,
          });
        },
        60000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [
    loadCommandCenter,
  ]);

  const selectedMatch =
    useMemo(
      () =>
        data?.matches?.find(
          (match) =>
            match.id ===
            selectedMatchId
        ) ||
        data?.matches?.[0] ||
        null,
      [
        data,
        selectedMatchId,
      ]
    );

  const summary =
    useMemo(() => {
      const matches =
        data?.matches || [];

      return {
        live:
          matches.filter(
            matchIsLive
          ).length,

        upcoming:
          matches.filter(
            (match) =>
              !matchIsLive(
                match
              ) &&
              ![
                "COMPLETED",
                "FINISHED",
              ].includes(
                match.status
              )
          ).length,

        ready:
          matches.filter(
            (match) =>
              match.readiness
                ?.percentage >=
              80
          ).length,

        attention:
          matches.filter(
            (match) =>
              match.readiness
                ?.percentage <
              80
          ).length,
      };
    }, [data]);

  if (loading) {
    return (
      <main className={styles.page}>
        <section className={styles.loadingCard}>
          <span
            className={styles.spinner}
            aria-hidden="true"
          />

          <strong>
            Preparing Match Day…
          </strong>

          <p>
            Loading schedules, availability, kit responsibility, and scoring status.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroTop}>
            <Link
              href="/dashboard"
              className={styles.backLink}
            >
              ← Dashboard
            </Link>

            <div className={styles.heroBadge}>
              <span
                aria-hidden="true"
              >
                🎛️
              </span>
              Match operations
            </div>
          </div>

          <div className={styles.heroMain}>
            <div>
              <span className={styles.eyebrow}>
                CRIC4ALL MATCH DAY
              </span>

              <h1>
                {data?.league
                  ?.name ||
                  "Match Day Command Center"}
              </h1>

              <p>
                One place to coordinate availability, balanced teams, kit responsibility, scoring, spectator sharing, and post-match follow-up.
              </p>
            </div>

            <button
              type="button"
              className={styles.refreshButton}
              disabled={
                refreshing
              }
              onClick={() =>
                loadCommandCenter({
                  background:
                    true,
                })
              }
            >
              <span
                className={
                  refreshing
                    ? styles.refreshing
                    : ""
                }
                aria-hidden="true"
              >
                ↻
              </span>

              {refreshing
                ? "Refreshing…"
                : "Refresh"}
            </button>
          </div>

          <div className={styles.kpis}>
            <article>
              <span>🔴</span>
              <div>
                <strong>
                  {summary.live}
                </strong>
                <small>Live now</small>
              </div>
            </article>

            <article>
              <span>📅</span>
              <div>
                <strong>
                  {summary.upcoming}
                </strong>
                <small>Upcoming</small>
              </div>
            </article>

            <article>
              <span>✅</span>
              <div>
                <strong>
                  {summary.ready}
                </strong>
                <small>Match-ready</small>
              </div>
            </article>

            <article>
              <span>⚠️</span>
              <div>
                <strong>
                  {summary.attention}
                </strong>
                <small>Need attention</small>
              </div>
            </article>
          </div>
        </header>

        {error && (
          <div
            className={styles.error}
            role="alert"
          >
            <strong>
              Match Day could not load
            </strong>
            <span>{error}</span>

            <button
              type="button"
              onClick={() =>
                loadCommandCenter()
              }
            >
              Try again
            </button>
          </div>
        )}

        {!error &&
        !data?.matches
          ?.length ? (
          <section className={styles.empty}>
            <span
              aria-hidden="true"
            >
              🗓️
            </span>

            <h2>
              No upcoming matches
            </h2>

            <p>
              Schedule a match first, then return here to coordinate the full match-day workflow.
            </p>

            <Link
              href="/dashboard?tab=matches"
            >
              Create or schedule match
            </Link>
          </section>
        ) : null}

        {data?.matches
          ?.length ? (
          <>
            <section className={styles.matchRailSection}>
              <div className={styles.sectionHeading}>
                <div>
                  <span>
                    MATCH QUEUE
                  </span>
                  <h2>
                    Choose a match
                  </h2>
                </div>

                <small>
                  Auto-refreshes every minute
                </small>
              </div>

              <div className={styles.matchRail}>
                {data.matches.map(
                  (match) => (
                    <button
                      key={
                        match.id
                      }
                      type="button"
                      className={
                        selectedMatch
                          ?.id ===
                        match.id
                          ? styles.matchChipActive
                          : ""
                      }
                      onClick={() =>
                        setSelectedMatchId(
                          match.id
                        )
                      }
                    >
                      <span
                        className={
                          matchIsLive(
                            match
                          )
                            ? styles.liveDot
                            : styles.scheduleDot
                        }
                      />

                      <div>
                        <strong>
                          {match.teamAName}
                          <em>vs</em>
                          {match.teamBName}
                        </strong>

                        <small>
                          {formatDate(
                            match.scheduledAt
                          )}
                        </small>
                      </div>

                      <b>
                        {match.readiness
                          ?.percentage ||
                          0}
                        %
                      </b>
                    </button>
                  )
                )}
              </div>
            </section>

            {selectedMatch && (
              <MatchWorkspace
                leagueId={
                  leagueId
                }
                match={
                  selectedMatch
                }
                permissions={
                  data.permissions
                }
              />
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}

function MatchWorkspace({
  leagueId,
  match,
  permissions,
}) {
  const action =
    nextAction({
      ...match,
      leagueId,
    });

  const teamBuilderHref =
    `/ai-team-splitter?leagueId=${leagueId}&matchId=${match.id}`;

  const scoringHref =
    `/dashboard?tab=scoring&matchId=${match.id}`;

  const kitHref =
    `/dashboard?tab=kit&leagueId=${leagueId}&matchId=${match.id}`;

  const resourcesHref =
    `/leagues/${leagueId}/resources`;

  const spectatorHref =
    match.shareCode
      ? `/live/${match.shareCode}`
      : `/dashboard?tab=scoring&matchId=${match.id}`;

  return (
    <section className={styles.workspace}>
      <div className={styles.matchHero}>
        <div className={styles.matchIdentity}>
          <div className={styles.matchStatusRow}>
            <span
              className={`${styles.statusPill} ${
                matchIsLive(
                  match
                )
                  ? styles.statusLive
                  : ""
              }`}
            >
              {matchIsLive(
                match
              ) && (
                <i />
              )}

              {statusLabel(
                match.status
              )}
            </span>

            {match.series
              ?.name && (
              <span className={styles.seriesPill}>
                {match.series.name}
              </span>
            )}
          </div>

          <h2>
            {match.teamAName}
            <span>vs</span>
            {match.teamBName}
          </h2>

          <p>
            {formatDate(
              match.scheduledAt
            )}
            {" • "}
            {match.oversPerInnings}
            {" overs per innings"}
          </p>
        </div>

        <div className={styles.readinessDial}>
          <strong>
            {match.readiness
              ?.percentage ||
              0}
            %
          </strong>
          <span>
            Match readiness
          </span>
        </div>
      </div>

      <div className={styles.progressTrack}>
        <span
          style={{
            width:
              `${
                match.readiness
                  ?.percentage ||
                0
              }%`,
          }}
        />
      </div>

      <div className={styles.readinessSteps}>
        {match.readiness
          ?.items?.map(
            (item) => (
              <div
                key={item.key}
                className={
                  item.complete
                    ? styles.stepComplete
                    : ""
                }
              >
                <span>
                  {item.complete
                    ? "✓"
                    : "•"}
                </span>

                <small>
                  {item.label}
                </small>
              </div>
            )
          )}
      </div>

      <div className={styles.operationsGrid}>
        <article className={styles.operationCard}>
          <header>
            <span className={styles.operationIcon}>
              📲
            </span>

            <div>
              <small>
                PLAYER AVAILABILITY
              </small>
              <h3>
                Who is playing?
              </h3>
            </div>

            <StatusBadge
              ready={
                Boolean(
                  match
                    .availability
                    ?.pollId
                )
              }
            />
          </header>

          <div className={styles.availabilityGrid}>
            <div>
              <strong>
                {match
                  .availability
                  ?.yes ||
                  0}
              </strong>
              <small>Available</small>
            </div>

            <div>
              <strong>
                {match
                  .availability
                  ?.maybe ||
                  0}
              </strong>
              <small>Maybe</small>
            </div>

            <div>
              <strong>
                {match
                  .availability
                  ?.no ||
                  0}
              </strong>
              <small>Unavailable</small>
            </div>

            <div>
              <strong>
                {match
                  .availability
                  ?.responses ||
                  0}
              </strong>
              <small>Responses</small>
            </div>
          </div>

          <div className={styles.cardActions}>
            {match
              .availability
              ?.token ? (
              <Link
                href={`/team-poll/${match.availability.token}`}
              >
                Open poll
              </Link>
            ) : (
              <Link
                href={
                  teamBuilderHref
                }
              >
                Create poll
              </Link>
            )}

            <Link
              href={
                teamBuilderHref
              }
              className={styles.secondaryAction}
            >
              Manage
            </Link>
          </div>
        </article>

        <article className={styles.operationCard}>
          <header>
            <span className={styles.operationIcon}>
              ⚖️
            </span>

            <div>
              <small>
                TEAM PREPARATION
              </small>
              <h3>
                Balanced teams
              </h3>
            </div>

            <StatusBadge
              ready={
                Boolean(
                  match.teamAId &&
                  match.teamBId
                )
              }
            />
          </header>

          <div className={styles.teamVersus}>
            <div>
              <span>
                {match.teamAName
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
              <strong>
                {match.teamAName}
              </strong>
            </div>

            <b>VS</b>

            <div>
              <span>
                {match.teamBName
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
              <strong>
                {match.teamBName}
              </strong>
            </div>
          </div>

          <div className={styles.cardActions}>
            <Link
              href={
                teamBuilderHref
              }
            >
              Open AI Team Builder
            </Link>
          </div>
        </article>

        <article className={styles.operationCard}>
          <header>
            <span className={styles.operationIcon}>
              🎒
            </span>

            <div>
              <small>
                KIT RESPONSIBILITY
              </small>
              <h3>
                Equipment ready
              </h3>
            </div>

            <StatusBadge
              ready={
                match.kit
                  ?.pending ===
                0
              }
            />
          </header>

          <div className={styles.kitList}>
            {match.kit
              ?.assignments
              ?.length ? (
              match.kit.assignments.map(
                (
                  assignment
                ) => (
                  <div
                    key={
                      assignment.id
                    }
                  >
                    <span>
                      {assignment.teamName}
                    </span>

                    <strong>
                      {assignment.actualName ||
                        assignment.assignedName ||
                        "Not assigned"}
                    </strong>

                    <small>
                      {statusLabel(
                        assignment.pickupStatus ||
                          assignment.status
                      )}
                    </small>
                  </div>
                )
              )
            ) : (
              <p>
                No kit assignment is required or recorded for this match.
              </p>
            )}
          </div>

          <div className={styles.cardActions}>
            <Link
              href={
                kitHref
              }
            >
              Open kit workflow
            </Link>
          </div>
        </article>

        <article className={styles.operationCard}>
          <header>
            <span className={styles.operationIcon}>
              🏏
            </span>

            <div>
              <small>
                LIVE SCORING
              </small>
              <h3>
                Score and share
              </h3>
            </div>

            <StatusBadge
              ready={
                match.score
                  ?.length >
                0
              }
            />
          </header>

          <div className={styles.scoreboardMini}>
            <div>
              <span>
                {match.teamAName}
              </span>
              <ScoreLine
                innings={
                  match.score?.[0]
                }
              />
            </div>

            <div>
              <span>
                {match.teamBName}
              </span>
              <ScoreLine
                innings={
                  match.score?.[1]
                }
              />
            </div>
          </div>

          <div className={styles.cardActions}>
            {permissions
              ?.canScoreMatch ? (
              <Link
                href={
                  scoringHref
                }
              >
                {matchIsLive(
                  match
                )
                  ? "Continue scoring"
                  : "Open scoring"}
              </Link>
            ) : (
              <Link
                href={
                  spectatorHref
                }
              >
                View score
              </Link>
            )}

            <Link
              href={
                spectatorHref
              }
              className={styles.secondaryAction}
            >
              Spectator
            </Link>
          </div>
        </article>
      </div>

      <section className={styles.quickActions}>
        <div>
          <span>
            NEXT BEST ACTION
          </span>

          <h3>
            {action.icon}
            {" "}
            {action.label}
          </h3>

          <p>
            Cric4All uses match status and readiness to surface the most useful next step.
          </p>
        </div>

        <div>
          <Link
            href={
              action.href
            }
            className={styles.nextAction}
          >
            Continue
            <span>→</span>
          </Link>

          <Link
            href={
              resourcesHref
            }
            className={styles.resourcesAction}
          >
            📚 League Resources
          </Link>
        </div>
      </section>
    </section>
  );
}

function StatusBadge({
  ready,
}) {
  return (
    <span
      className={
        ready
          ? styles.readyBadge
          : styles.attentionBadge
      }
    >
      {ready
        ? "Ready"
        : "Action needed"}
    </span>
  );
}
