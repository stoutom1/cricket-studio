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
  setOfflineScoringSessionOwner,
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

export default function OfflineScoringResumeBanner({
  ownerKey = "",
}) {
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

  const normalizedOwnerKey =
    String(
      ownerKey ||
      ""
    )
      .trim();

  const refresh =
    useCallback(
      () => {
        const savedSession =
          getOfflineScoringSession();

        /*
         * Extra stale-session protection:
         * completed/locked/abandoned matches must never keep showing a
         * Resume Match action.
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
        } else if (
          !savedSession ||
          !normalizedOwnerKey
        ) {
          setSession(
            null
          );
        } else {
          const savedOwnerKey =
            String(
              savedSession.ownerKey ||
              ""
            )
              .trim();

          /*
           * Security/UX rule:
           * - ownerless legacy sessions are not automatically adopted at login;
           * - another user's session remains saved but invisible;
           * - only a session owned by this confirmed signed-in user is shown.
           */
          setSession(
            savedOwnerKey &&
            savedOwnerKey ===
              normalizedOwnerKey
              ? savedSession
              : null
          );
        }

        setOnline(
          getOnlineState()
        );

        /*
         * On Dashboard, do NOT trust localStorage/query-string league state.
         * DashboardClient publishes the authoritative accessible league.
         */
        if (
          typeof window !==
            "undefined" &&
          window.location.pathname ===
            "/dashboard"
        ) {
          return;
        }

        setActiveLeagueId(
          getDashboardActiveLeagueId()
        );
      },
      [
        normalizedOwnerKey,
      ]
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
        (event) => {
          /*
           * A same-tab fresh save event means the current authenticated user is
           * actively producing this scoring state. This is the only time an
           * ownerless or previously-owned same-match session may be claimed.
           *
           * Merely logging in never claims a legacy session.
           */
          const eventMatchId =
            Number(
              event?.detail
                ?.matchId
            );

          if (
            normalizedOwnerKey &&
            Number.isInteger(
              eventMatchId
            ) &&
            eventMatchId > 0
          ) {
            setOfflineScoringSessionOwner(
              normalizedOwnerKey,
              eventMatchId,
              {
                force:
                  true,
              }
            );
          }

          refresh();
        };

      const handleOwnerUpdate =
        () => refresh();

      const handleActiveLeague =
        (event) => {
          const nextLeagueId =
            Number(
              event?.detail
                ?.leagueId
            );

          setActiveLeagueId(
            Number.isInteger(
              nextLeagueId
            ) &&
            nextLeagueId > 0
              ? nextLeagueId
              : null
          );
        };

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
        "cric4all:offline-scoring-session-owner",
        handleOwnerUpdate
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
          "cric4all:offline-scoring-session-owner",
          handleOwnerUpdate
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
   * The Dashboard is intentionally league-scoped. Resume Match is shown
   * only when BOTH sides have a valid league id and they are the same.
   *
   * This intentionally hides a stale browser-saved resume session when:
   * - the signed-in user is not a member of any league,
   * - the Dashboard has no active league yet,
   * - the saved session has no league id, or
   * - the saved match belongs to another league.
   *
   * Outside /dashboard, keep the existing global offline-recovery behavior
   * unchanged.
   */
  if (
    typeof window !==
      "undefined" &&
    window.location.pathname ===
      "/dashboard"
  ) {
    const dashboardLeagueId =
      Number(activeLeagueId);

    const savedLeagueId =
      Number(session.leagueId);

    const hasDashboardLeague =
      Number.isInteger(
        dashboardLeagueId
      ) &&
      dashboardLeagueId > 0;

    const hasSavedLeague =
      Number.isInteger(
        savedLeagueId
      ) &&
      savedLeagueId > 0;

    if (
      !hasDashboardLeague ||
      !hasSavedLeague ||
      dashboardLeagueId !==
        savedLeagueId
    ) {
      return null;
    }
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
