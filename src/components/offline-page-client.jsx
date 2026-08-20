"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  buildOfflineScoringResumeUrl,
  getOfflineScoringSession,
} from "@/lib/offline-scoring-resume";
import "@/app/offline/offline.css";

export default function OfflinePageClient() {
  const [
    session,
    setSession,
  ] =
    useState(null);

  const [
    online,
    setOnline,
  ] =
    useState(
      false
    );

  useEffect(
    () => {
      const refresh =
        () => {
          setSession(
            getOfflineScoringSession()
          );

          setOnline(
            navigator.onLine !==
              false
          );
        };

      refresh();

      window.addEventListener(
        "online",
        refresh
      );

      window.addEventListener(
        "offline",
        refresh
      );

      window.addEventListener(
        "cric4all:offline-scoring-session",
        refresh
      );

      return () => {
        window.removeEventListener(
          "online",
          refresh
        );

        window.removeEventListener(
          "offline",
          refresh
        );

        window.removeEventListener(
          "cric4all:offline-scoring-session",
          refresh
        );
      };
    },
    []
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

  return (
    <main className="offline-page">
      <section className="offline-card">
        <div className="offline-status">
          <span aria-hidden="true">
            {online
              ? "🟢"
              : "📴"}
          </span>

          <strong>
            {online
              ? "Connection restored"
              : "You're offline"}
          </strong>
        </div>

        <h1>
          Cric4All is still ready for your match.
        </h1>

        {session ? (
          <>
            <div className="offline-match-card">
              <span>
                Active scoring match
              </span>

              <strong>
                {[
                  session
                    .teamAName,
                  session
                    .teamBName,
                ]
                  .filter(
                    Boolean
                  )
                  .join(
                    " vs "
                  ) ||
                  `Match #${session.matchId}`}
              </strong>

              {session.scoreText ? (
                <small>
                  {session.scoreText}
                </small>
              ) : null}
            </div>

            <a
              className="offline-primary"
              href={
                resumeUrl
              }
            >
              🏏 Resume Offline Scoring
              <span aria-hidden="true">
                →
              </span>
            </a>

            <p>
              Your locally saved scoring snapshot and queued deliveries remain on this device.
            </p>
          </>
        ) : (
          <>
            <p>
              No active offline-scoring match is saved on this device yet.
            </p>

            <button
              type="button"
              className="offline-primary"
              onClick={
                () =>
                  window.location
                    .reload()
              }
            >
              Try again
            </button>
          </>
        )}
      </section>
    </main>
  );
}
