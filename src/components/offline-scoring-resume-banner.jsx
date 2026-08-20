"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  buildOfflineScoringResumeUrl,
  getOfflineScoringSession,
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

  const refresh =
    useCallback(
      () => {
        setSession(
          getOfflineScoringSession()
        );

        setOnline(
          getOnlineState()
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
              "cric4all.offlineScoringSession.v1"
          ) {
            refresh();
          }
        };

      const handleSession =
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

  return (
    <aside
      className={`offline-resume-banner ${
        online
          ? "is-online"
          : "is-offline"
      }`}
      aria-live="polite"
    >
      <div className="offline-resume-copy">
        <span
          className="offline-resume-icon"
          aria-hidden="true"
        >
          {online
            ? "🏏"
            : "📴"}
        </span>

        <span className="offline-resume-text">
          <strong>
            {online
              ? "Scoring match available"
              : "Offline scoring is ready"}
          </strong>

          <small>
            {scoreSummary(
              session
            )}
          </small>
        </span>
      </div>

      <a
        href={
          resumeUrl
        }
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
