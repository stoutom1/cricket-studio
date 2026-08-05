"use client";

import Link from "next/link";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
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

function kitReadyText(match) {
  const kitComplete =
    Array.isArray(
      match.readiness?.items
    ) &&
    match.readiness.items.some(
      (item) =>
        item.key === "KIT" &&
        item.complete === true
    );

  return kitComplete
    ? "Kit ready"
    : "Kit needs attention";
}

function nextAction(match) {
  const readinessItems =
    Array.isArray(
      match.readiness?.items
    )
      ? match.readiness.items
      : [];

  const readinessComplete = (
    key
  ) =>
    readinessItems.some(
      (item) =>
        item.key === key &&
        item.complete === true
    );

  const availabilityReady =
    match.availability
      ?.manuallyCompleted ===
      true ||
    readinessComplete(
      "AVAILABILITY"
    );

  const teamsReady =
    readinessComplete(
      "TEAMS"
    );

  const kitReady =
    readinessComplete(
      "KIT"
    );

  if (
    !availabilityReady
  ) {
    return {
      label:
        match.availability
          ?.pollId
          ? "Review availability"
          : "Create availability poll",

      href:
        `/ai-team-splitter?leagueId=${match.leagueId || ""}&matchId=${match.id}`,

      icon:
        "📲",
    };
  }

  if (!teamsReady) {
    return {
      label:
        "Prepare balanced teams",

      href:
        `/ai-team-splitter?leagueId=${match.leagueId || ""}&matchId=${match.id}`,

      icon:
        "⚖️",
    };
  }

  if (!kitReady) {
    return {
      label:
        "Review kit responsibility",

      href:
        `/dashboard?tab=matches&matchesSubTab=KIT&leagueId=${match.leagueId || ""}&matchId=${match.id}`,

      icon:
        "🎒",
    };
  }

  if (
    matchIsLive(match)
  ) {
    return {
      label:
        "Continue scoring",

      href:
        `/dashboard?tab=scoring&matchId=${match.id}`,

      icon:
        "🏏",
    };
  }

  return {
    label:
      "Open scoring",

    href:
      `/dashboard?tab=scoring&matchId=${match.id}`,

    icon:
      "🏏",
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
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedMatchId =
    Number(
      searchParams.get("matchId")
    );

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
    availabilitySavingId,
    setAvailabilitySavingId,
  ] = useState(null);

  const [
    selectedMatchId,
    setSelectedMatchId,
  ] = useState(null);

  const [
    queueFilter,
    setQueueFilter,
  ] = useState("ALL");

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

              const requested =
                Number.isInteger(
                  requestedMatchId
                )
                  ? result.matches
                      ?.find(
                        (match) =>
                          match.id ===
                          requestedMatchId
                      )
                  : null;

              const live =
                result.matches
                  ?.find(
                    matchIsLive
                  );

              return (
                requested?.id ||
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
      [
        leagueId,
        requestedMatchId,
      ]
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

  const filteredMatches =
    useMemo(
      () => {
        const matches =
          data?.matches || [];

        if (
          queueFilter ===
          "IN_PROGRESS"
        ) {
          return matches.filter(
            (match) =>
              matchIsLive(
                match
              )
          );
        }

        if (
          queueFilter ===
          "SCHEDULED"
        ) {
          return matches.filter(
            (match) =>
              !matchIsLive(
                match
              )
          );
        }

        return matches;
      },
      [
        data,
        queueFilter,
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
                  Scheduled and in-progress only
                </small>
              </div>

              <div
                className={styles.queueFilters}
                role="group"
                aria-label="Filter match queue"
              >
                <button
                  type="button"
                  className={
                    queueFilter ===
                    "ALL"
                      ? styles.queueFilterActive
                      : ""
                  }
                  onClick={() =>
                    setQueueFilter(
                      "ALL"
                    )
                  }
                >
                  All
                  <b>
                    {data.matches.length}
                  </b>
                </button>

                <button
                  type="button"
                  className={
                    queueFilter ===
                    "IN_PROGRESS"
                      ? styles.queueFilterActive
                      : ""
                  }
                  onClick={() =>
                    setQueueFilter(
                      "IN_PROGRESS"
                    )
                  }
                >
                  In progress
                  <b>
                    {summary.live}
                  </b>
                </button>

                <button
                  type="button"
                  className={
                    queueFilter ===
                    "SCHEDULED"
                      ? styles.queueFilterActive
                      : ""
                  }
                  onClick={() =>
                    setQueueFilter(
                      "SCHEDULED"
                    )
                  }
                >
                  Scheduled
                  <b>
                    {summary.upcoming}
                  </b>
                </button>
              </div>

              <div className={styles.matchRail}>
                {filteredMatches.map(
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
                      onClick={() => {
                        setSelectedMatchId(
                          match.id
                        );

                        router.replace(
                          `/leagues/${leagueId}/match-day?matchId=${match.id}`,
                          {
                            scroll: false,
                          }
                        );
                      }}
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

                {!filteredMatches.length && (
                  <div className={styles.queueEmpty}>
                    No matches in this filter.
                  </div>
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

                availabilitySavingId={
                  availabilitySavingId
                }

                onSetAvailabilityComplete={
                  async (
                    match,
                    complete
                  ) => {
                    let note =
                      null;

                    if (complete) {
                      note =
                        window.prompt(
                          "Optional note about how availability was confirmed:",
                          match.availability
                            ?.manualNote ||
                            "Confirmed outside Cric4All"
                        );

                      if (
                        note ===
                        null
                      ) {
                        return;
                      }
                    }

                    setAvailabilitySavingId(
                      match.id
                    );

                    setError("");

                    const controller =
                      new AbortController();

                    const timeoutId =
                      window.setTimeout(
                        () =>
                          controller.abort(),
                        15000
                      );

                    try {
                      const response =
                        await fetch(
                          `/api/leagues/${leagueId}/matches/${match.id}/availability-status`,
                          {
                            method:
                              "PATCH",

                            headers: {
                              "Content-Type":
                                "application/json",
                            },

                            body:
                              JSON.stringify({
                                availabilityComplete:
                                  complete,

                                availabilityNote:
                                  note,
                              }),

                            signal:
                              controller.signal,
                          }
                        );

                      const rawText =
                        await response.text();

                      let result =
                        null;

                      try {
                        result =
                          rawText
                            ? JSON.parse(
                                rawText
                              )
                            : null;
                      } catch {
                        result = {
                          error:
                            rawText ||
                            "The server returned an invalid response.",
                        };
                      }

                      if (!response.ok) {
                        throw new Error(
                          result?.error ||
                          "Unable to update availability readiness."
                        );
                      }

                      /*
                       * Update Match Day immediately instead of waiting
                       * for a second API request before changing the UI.
                       */
                      setData(
                        (current) => {
                          if (
                            !current
                              ?.matches
                          ) {
                            return current;
                          }

                          return {
                            ...current,

                            matches:
                              current.matches.map(
                                (
                                  currentMatch
                                ) => {
                                  if (
                                    currentMatch.id !==
                                    match.id
                                  ) {
                                    return currentMatch;
                                  }

                                  const readinessItems =
                                    (
                                      currentMatch
                                        .readiness
                                        ?.items ||
                                      []
                                    ).map(
                                      (
                                        item
                                      ) =>
                                        item.key ===
                                        "AVAILABILITY"
                                          ? {
                                              ...item,
                                              complete,
                                            }
                                          : item
                                    );

                                  const completed =
                                    readinessItems.filter(
                                      (
                                        item
                                      ) =>
                                        item.complete
                                    ).length;

                                  const total =
                                    readinessItems.length ||
                                    currentMatch
                                      .readiness
                                      ?.total ||
                                    5;

                                  return {
                                    ...currentMatch,

                                    availability: {
                                      ...currentMatch
                                        .availability,

                                      manuallyCompleted:
                                        complete,

                                      manualNote:
                                        complete
                                          ? result
                                              ?.status
                                              ?.availabilityNote ||
                                            note ||
                                            "Confirmed outside Cric4All"
                                          : null,

                                      manualUpdatedAt:
                                        result
                                          ?.status
                                          ?.updatedAt ||
                                        new Date()
                                          .toISOString(),
                                    },

                                    readiness: {
                                      ...currentMatch
                                        .readiness,

                                      completed,
                                      total,

                                      percentage:
                                        Math.round(
                                          (
                                            completed /
                                            Math.max(
                                              total,
                                              1
                                            )
                                          ) *
                                            100
                                        ),

                                      items:
                                        readinessItems,

                                      availabilitySource:
                                        complete
                                          ? "MANUAL"
                                          : currentMatch
                                              .availability
                                              ?.pollId
                                            ? "POLL"
                                            : "NONE",
                                    },
                                  };
                                }
                              ),
                          };
                        }
                      );

                      /*
                       * Refresh in the background for authoritative
                       * server values, but do not leave the button stuck.
                       */
                      loadCommandCenter({
                        background:
                          true,
                      }).catch(
                        () => {}
                      );
                    } catch (failure) {
                      setError(
                        failure?.name ===
                        "AbortError"
                          ? "Saving availability took too long. Please try again."
                          : failure instanceof Error
                            ? failure.message
                            : "Unable to update availability readiness."
                      );
                    } finally {
                      window.clearTimeout(
                        timeoutId
                      );

                      setAvailabilitySavingId(
                        null
                      );
                    }
                  }
                }
              />
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}

function LockedAction({
  label,
  reason,
  className = "",
}) {
  return (
    <button
      type="button"
      className={`${styles.lockedAction} ${className}`}
      disabled
      title={reason}
      aria-label={`${label}. ${reason}`}
    >
      <span aria-hidden="true">🔒</span>
      <span>{label}</span>
    </button>
  );
}

function MatchWorkspace({
  leagueId,
  match,
  permissions,
  availabilitySavingId,
  onSetAvailabilityComplete,
}) {
  const [
    mobileOpenSection,
    setMobileOpenSection,
  ] = useState("PLAYERS");

  useEffect(() => {
    setMobileOpenSection(
      "PLAYERS"
    );
  }, [match.id]);

  function toggleMobileSection(
    section
  ) {
    setMobileOpenSection(
      (current) =>
        current === section
          ? null
          : section
    );
  }

  const returnTo =
    `/leagues/${leagueId}/match-day?matchId=${match.id}`;

  function withReturnTo(
    href
  ) {
    const separator =
      href.includes("?")
        ? "&"
        : "?";

    return `${href}${separator}returnTo=${encodeURIComponent(
      returnTo
    )}`;
  }

  const action =
    nextAction({
      ...match,
      leagueId,
    });

  const teamBuilderHref =
    withReturnTo(
      `/ai-team-splitter?leagueId=${leagueId}&matchId=${match.id}`
    );

  const scoringHref =
    withReturnTo(
      `/dashboard?tab=scoring&matchId=${match.id}`
    );

  const kitHref =
    withReturnTo(
      `/dashboard?tab=matches&matchesSubTab=KIT&leagueId=${leagueId}&matchId=${match.id}`
    );

  const resourcesHref =
    withReturnTo(
      `/leagues/${leagueId}/resources`
    );

  const spectatorHref =
    match.shareCode
      ? withReturnTo(
          `/live/${match.shareCode}`
        )
      : scoringHref;

  return (
    <section className={styles.workspace}>
      <div className={styles.permissionStrip}>
        <div>
          <span aria-hidden="true">🛡️</span>

          <p>
            <strong>
              {permissions?.role || "MEMBER"}
            </strong>

            <small>
              {permissions?.canScoreMatch &&
              (
                permissions?.canManageAvailability ||
                permissions?.canManageTeams ||
                permissions?.canManageKit
              )
                ? "Match operations and scoring access"
                : permissions?.canScoreMatch
                  ? "Scoring access with read-only match operations"
                  : permissions?.canManageAvailability ||
                      permissions?.canManageTeams ||
                      permissions?.canManageKit
                    ? "Match operations access"
                    : "Read-only Match Day access"}
            </small>
          </p>
        </div>

        {!permissions?.canScoreMatch && (
          <span className={styles.readOnlyBadge}>
            Scoring read-only
          </span>
        )}
      </div>

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
            Ready
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

      <div className={styles.mobileGlanceBar}>
        <div>
          <span>
            📲
          </span>

          <strong>
            {match.availability
              ?.responses ||
              0}
          </strong>

          <small>
            Responses
          </small>
        </div>

        <div>
          <span>
            🎒
          </span>

          <strong>
            {match.kit
              ?.assignments
              ?.length ||
              0}
          </strong>

          <small>
            Kit rows
          </small>
        </div>

        <div>
          <span>
            🏏
          </span>

          <strong>
            {match.score
              ?.length ||
              0}
          </strong>

          <small>
            Innings
          </small>
        </div>

        <Link
          href={
            permissions
              ?.canScoreMatch
              ? scoringHref
              : spectatorHref
          }
          className={styles.mobilePrimaryGlanceAction}
        >
          {permissions
            ?.canScoreMatch
            ? matchIsLive(
                match
              )
              ? "Continue scoring"
              : "Open scoring"
            : "Spectator"}
          <span>→</span>
        </Link>
      </div>

      <div className={styles.operationsGrid}>
        <section
          className={`${styles.mobileAccordion} ${
            mobileOpenSection ===
            "PLAYERS"
              ? styles.mobileAccordionOpen
              : ""
          }`}
        >
          <button
            type="button"
            className={styles.mobileAccordionSummary}
            aria-expanded={
              mobileOpenSection ===
              "PLAYERS"
            }
            onClick={() =>
              toggleMobileSection(
                "PLAYERS"
              )
            }
          >
            <span className={styles.mobileAccordionIcon}>
              👥
            </span>

            <span className={styles.mobileAccordionCopy}>
              <small>
                PLAYERS & TEAMS
              </small>

              <strong>
                Availability and team preparation
              </strong>

              <em>
                {match.availability
                  ?.responses ||
                  0}{" "}
                responses ·{" "}
                {match.teamAName} vs{" "}
                {match.teamBName}
              </em>
            </span>

            <span className={styles.mobileAccordionState}>
              {
                match.readiness
                  ?.items?.filter(
                    (item) =>
                      [
                        "AVAILABILITY",
                        "TEAMS",
                      ].includes(
                        item.key
                      ) &&
                      item.complete
                  ).length ||
                0
              }
              /2
            </span>

            <span className={styles.mobileAccordionChevron}>
              ⌄
            </span>
          </button>

          <div className={styles.mobileAccordionContent}>
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
                match.readiness
                  ?.items?.find(
                    (item) =>
                      item.key ===
                      "AVAILABILITY"
                  )?.complete ===
                true
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

          {match.availability
            ?.manuallyCompleted && (
            <div className={styles.manualAvailabilityNote}>
              <span aria-hidden="true">✓</span>

              <div>
                <strong>
                  Confirmed outside Cric4All
                </strong>

                <small>
                  {match.availability
                    ?.manualNote ||
                    "Availability was collected offline, by WhatsApp, or another method."}
                </small>
              </div>
            </div>
          )}

          <div className={styles.cardActions}>
            {permissions
              ?.canManageAvailability ? (
              <>
                {match
                  .availability
                  ?.token ? (
                  <Link
                    href={withReturnTo(
                      `/team-poll/${match.availability.token}`
                    )}
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

                <button
                  type="button"
                  className={styles.manualCompleteButton}
                  disabled={
                    availabilitySavingId ===
                    match.id
                  }
                  onClick={() =>
                    onSetAvailabilityComplete(
                      match,
                      !match
                        .availability
                        ?.manuallyCompleted
                    )
                  }
                >
                  {availabilitySavingId ===
                  match.id
                    ? "Saving…"
                    : match
                        .availability
                        ?.manuallyCompleted
                      ? "Use poll status"
                      : "Mark complete"}
                </button>
              </>
            ) : (
              <LockedAction
                label="Availability management"
                reason="Owner, Admin, Captain, or a member with match-management permission is required."
              />
            )}
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
            {permissions
              ?.canManageTeams ? (
              <Link
                href={
                  teamBuilderHref
                }
              >
                Open AI Team Builder
              </Link>
            ) : (
              <LockedAction
                label="AI Team Builder"
                reason="Owner, Admin, Captain, or a member with match-management permission is required."
              />
            )}
          </div>
        </article>

          </div>
        </section>

        <section
          className={`${styles.mobileAccordion} ${
            mobileOpenSection ===
            "OPERATIONS"
              ? styles.mobileAccordionOpen
              : ""
          }`}
        >
          <button
            type="button"
            className={styles.mobileAccordionSummary}
            aria-expanded={
              mobileOpenSection ===
              "OPERATIONS"
            }
            onClick={() =>
              toggleMobileSection(
                "OPERATIONS"
              )
            }
          >
            <span className={styles.mobileAccordionIcon}>
              🎒
            </span>

            <span className={styles.mobileAccordionCopy}>
              <small>
                MATCH OPERATIONS
              </small>

              <strong>
                Kit responsibility
              </strong>

              <em>
                {match.kit
                  ?.assignments
                  ?.length ||
                  0}{" "}
                kit row(s) ·{" "}
                {kitReadyText(match)}
              </em>
            </span>

            <span className={styles.mobileAccordionState}>
              {
                match.readiness
                  ?.items?.filter(
                    (item) =>
                      item.key ===
                        "KIT" &&
                      item.complete
                  ).length ||
                0
              }
              /1
            </span>

            <span className={styles.mobileAccordionChevron}>
              ⌄
            </span>
          </button>

          <div className={styles.mobileAccordionContent}>
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
                  ?.hasCarrier ===
                  true &&
                match.kit
                  ?.pending ===
                  0
              }
            />
          </header>

          <div className={styles.kitTableWrap}>
            {match.kit
              ?.assignments
              ?.length ? (
              <table className={styles.kitTable}>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Current holder</th>
                    <th>Suggested kit carrier</th>
                  </tr>
                </thead>

                <tbody>
                  {match.kit.assignments.map(
                    (
                      assignment
                    ) => (
                      <tr
                        key={
                          assignment.id
                        }
                      >
                        <td
                          data-label="Team"
                        >
                          {assignment.teamName}
                        </td>

                        <td
                          data-label="Current holder"
                        >
                          {assignment.currentHolderName ||
                            assignment.actualName ||
                            "Not recorded"}
                        </td>

                        <td
                          data-label="Suggested kit carrier"
                        >
                          {assignment.suggestedHolderName ||
                            assignment.assignedName ||
                            "Not suggested"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            ) : (
              <p className={styles.kitEmptyMessage}>
                No kit carrier is assigned or suggested for this match yet.
              </p>
            )}
          </div>

          <div className={styles.cardActions}>
            {permissions
              ?.canManageKit ? (
              <Link
                href={
                  kitHref
                }
              >
                Open kit workflow
              </Link>
            ) : (
              <LockedAction
                label="Kit workflow"
                reason="Owner, Admin, Captain, or a member with kit-management permission is required."
              />
            )}
          </div>
        </article>

        <article
          className={`${styles.operationCard} ${styles.mobileSecondaryScoringCard}`}
        >
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
              <LockedAction
                label="Scoring"
                reason="The canScoreMatch permission is required."
              />
            )}

            {permissions
              ?.canViewSpectator ? (
              <Link
                href={
                  spectatorHref
                }
                className={styles.secondaryAction}
              >
                Spectator
              </Link>
            ) : null}
          </div>
        </article>
          </div>
        </section>
      </div>

      <section
        className={`${styles.mobileAccordion} ${styles.mobileNextAccordion} ${
          mobileOpenSection ===
          "NEXT"
            ? styles.mobileAccordionOpen
            : ""
        }`}
      >
        <button
          type="button"
          className={styles.mobileAccordionSummary}
          aria-expanded={
            mobileOpenSection ===
            "NEXT"
          }
          onClick={() =>
            toggleMobileSection(
              "NEXT"
            )
          }
        >
          <span className={styles.mobileAccordionIcon}>
            ⚡
          </span>

          <span className={styles.mobileAccordionCopy}>
            <small>
              NEXT BEST ACTION
            </small>

            <strong>
              {action.label}
            </strong>

            <em>
              Recommended from match readiness
            </em>
          </span>

          <span className={styles.mobileAccordionChevron}>
            ⌄
          </span>
        </button>

        <div className={styles.mobileAccordionContent}>
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
          {(
            action.href.includes(
              "scoring"
            )
              ? permissions
                  ?.canScoreMatch
              : action.href.includes(
                    "ai-team-splitter"
                  )
                ? permissions
                    ?.canManageTeams
                : true
          ) ? (
            <Link
              href={
                withReturnTo(
                  action.href
                )
              }
              className={styles.nextAction}
            >
              Continue
              <span>→</span>
            </Link>
          ) : (
            <LockedAction
              label="Next action locked"
              reason="Your league permissions do not allow this operational action."
              className={styles.nextActionLocked}
            />
          )}

          {permissions
            ?.canViewResources ? (
            <Link
              href={
                resourcesHref
              }
              className={styles.resourcesAction}
            >
              📚 League Resources
            </Link>
          ) : null}
        </div>
      </section>
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
