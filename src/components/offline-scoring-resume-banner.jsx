"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  buildOfflineScoringResumeUrl,
  clearOfflineScoringSession,
  getOfflineScoringSession,
  isCompletedMatchStatus,
  shouldUseOfflineServiceWorker,
} from "@/lib/offline-scoring-resume";
import "@/app/offline-resume.css";

function getOnlineState() {
  return (
    typeof navigator ===
      "undefined" ||
    navigator.onLine !==
      false
  );
}

function getDashboardActiveLeagueId() {
  if (
    typeof window ===
      "undefined"
  ) {
    return null;
  }

  try {
    const current =
      new URL(
        window.location.href
      );

    const queryLeagueId =
      Number(
        current.searchParams.get(
          "leagueId"
        )
      );

    if (
      Number.isInteger(
        queryLeagueId
      ) &&
      queryLeagueId > 0
    ) {
      return queryLeagueId;
    }

    const storedLeagueId =
      Number(
        window.localStorage.getItem(
          "activeLeagueId"
        )
      );

    return (
      Number.isInteger(
        storedLeagueId
      ) &&
      storedLeagueId > 0
    )
      ? storedLeagueId
      : null;
  } catch {
    return null;
  }
}

function scoreSummary(
  session
) {
  if (
    session
      ?.scoreText
  ) {
    return session.scoreText;
  }

  const teams =
    [
      session
        ?.teamAName,
      session
        ?.teamBName,
    ]
      .filter(
        Boolean
      )
      .join(
        " vs "
      );

  return (
    teams ||
    "Match in progress"
  );
}

export default function OfflineScoringResumeBanner() {
  const [
    session,
    setSession,
  ] =
    useState(
      null
    );

  const [
    online,
    setOnline,
  ] =
    useState(
      true
    );

  const [
    activeLeagueId,
    setActiveLeagueId,
  ] =
    useState(
      null
    );

  const refresh =
    useCallback(
      () => {
        const savedSession =
          getOfflineScoringSession();

        /*
         * Extra stale-session protection:
         * completed/locked/abandoned matches must never keep showing a
         * Resume Match action.
         *
         * DashboardClient already clears this when it observes a terminal
         * match status. This check is only a defensive UI safeguard.
         */
        if (
          savedSession &&
          isCompletedMatchStatus(
            savedSession.matchStatus
          )
        ) {
          clearOfflineScoringSession(
            savedSession.matchId
          );

          setSession(
            null
          );
        } else {
          setSession(
            savedSession
          );
        }

        setOnline(
          getOnlineState()
        );

        setActiveLeagueId(
          getDashboardActiveLeagueId()
        );
      },
      []
    );

  useEffect(
    () => {
      refresh();

      const handleOnline =
        () => refresh();

      const handleOffline =
        () => refresh();

      const handleStorage =
        (
          event
        ) => {
          if (
            !event.key ||
            event.key ===
              "cric4all.offlineScoringSession.v1" ||
            event.key ===
              "activeLeagueId"
          ) {
            refresh();
          }
        };

      const handleSession =
        () => refresh();

      const handleActiveLeague =
        () => refresh();

      window.addEventListener(
        "online",
        handleOnline
      );

      window.addEventListener(
        "offline",
        handleOffline
      );

      window.addEventListener(
        "storage",
        handleStorage
      );

      window.addEventListener(
        "cric4all:offline-scoring-session",
        handleSession
      );

      window.addEventListener(
        "cric4all:active-league-changed",
        handleActiveLeague
      );

      if (
        "serviceWorker" in
        navigator
      ) {
        if (
          shouldUseOfflineServiceWorker()
        ) {
          navigator.serviceWorker
            .register(
              "/sw.js",
              {
                scope:
                  "/",
              }
            )
            .catch(
              (
                error
              ) => {
                console.warn(
                  "[OFFLINE_SW_REGISTER_FAILED]",
                  error
                );
              }
            );
        } else {
          /*
           * Local development safety:
           * remove any previously installed Cric4All worker. A service worker
           * controlling `next dev` can interfere with Turbopack HMR and cause
           * "Router action dispatched before initialization".
           */
          navigator.serviceWorker
            .getRegistrations()
            .then(
              (
                registrations
              ) =>
                Promise.allSettled(
                  registrations.map(
                    (
                      registration
                    ) =>
                      registration.unregister()
                  )
                )
            )
            .catch(
              () => {}
            );

          if (
            "caches" in
            window
          ) {
            caches
              .keys()
              .then(
                (
                  keys
                ) =>
                  Promise.allSettled(
                    keys
                      .filter(
                        (
                          key
                        ) =>
                          key.startsWith(
                            "cric4all-"
                          )
                      )
                      .map(
                        (
                          key
                        ) =>
                          caches.delete(
                            key
                          )
                      )
                  )
              )
              .catch(
                () => {}
              );
          }
        }
      }

      return () => {
        window.removeEventListener(
          "online",
          handleOnline
        );

        window.removeEventListener(
          "offline",
          handleOffline
        );

        window.removeEventListener(
          "storage",
          handleStorage
        );

        window.removeEventListener(
          "cric4all:offline-scoring-session",
          handleSession
        );

        window.removeEventListener(
          "cric4all:active-league-changed",
          handleActiveLeague
        );
      };
    },
    [
      refresh,
    ]
  );

  const resumeUrl =
    useMemo(
      () =>
        session
          ? buildOfflineScoringResumeUrl(
              session
            )
          : "",
      [
        session,
      ]
    );

  if (!session) {
    return null;
  }

  /*
   * League-aware Resume Match visibility:
   *
   * The Dashboard is intentionally league-scoped. A resumable match from
   * another league must not look like it belongs to the league currently
   * selected in League Management. Outside /dashboard, keep the existing
   * global recovery behavior unchanged.
   */
  if (
    typeof window !==
      "undefined" &&
    window.location.pathname ===
      "/dashboard" &&
    Number.isInteger(
      Number(activeLeagueId)
    ) &&
    Number(activeLeagueId) > 0 &&
    Number.isInteger(
      Number(session.leagueId)
    ) &&
    Number(session.leagueId) > 0 &&
    Number(activeLeagueId) !==
      Number(session.leagueId)
  ) {
    return null;
  }

  /*
   * Hide the global banner while the scorer is already on the exact scoring
   * route. The Dashboard has its own offline status UI.
   */
  if (
    typeof window !==
      "undefined"
  ) {
    const current =
      new URL(
        window.location.href
      );

    if (
      current.pathname ===
        "/dashboard" &&
      current.searchParams
        .get(
          "tab"
        ) ===
        "scoring" &&
      Number(
        current.searchParams
          .get(
            "matchId"
          )
      ) ===
        Number(
          session.matchId
        )
    ) {
      return null;
    }
  }

  /*
   * ONLINE UX
   * ---------
   * Recovery remains available, but it should not visually dominate every
   * Cric4All screen. Render a compact navigation pill only.
   */
  if (online) {
    return (
      <a
        href={resumeUrl}
        className="offline-resume-online-pill"
        title={`Resume ${scoreSummary(session)}`}
        aria-label={`Resume scoring. ${scoreSummary(session)}`}
      >
        <span
          className="offline-resume-online-icon"
          aria-hidden="true"
        >
          🏏
        </span>

        <span className="offline-resume-online-label">
          Resume Match
        </span>
      </a>
    );
  }

  /*
   * OFFLINE UX
   * ----------
   * Offline recovery is important enough to remain prominent because the user
   * may otherwise believe the active match is inaccessible.
   */
  return (
    <aside
      className="offline-resume-banner is-offline"
      aria-live="polite"
    >
      <div className="offline-resume-copy">
        <span
          className="offline-resume-icon"
          aria-hidden="true"
        >
          📴
        </span>

        <span className="offline-resume-text">
          <strong>
            Offline scoring is ready
          </strong>

          <small>
            {scoreSummary(
              session
            )}
          </small>
        </span>
      </div>

      <a
        href={resumeUrl}
        className="offline-resume-action"
      >
        Resume scoring
        <span aria-hidden="true">
          →
        </span>
      </a>
    </aside>
  );
}
