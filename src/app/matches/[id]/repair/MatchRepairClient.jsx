"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";
import styles from "./repair.module.css";

async function api(
  url,
  options = {}
) {
  const response =
    await fetch(
      url,
      {
        ...options,

        headers: {
          "Content-Type":
            "application/json",

          ...(options.headers ||
            {}),
        },
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Request failed."
    );
  }

  return data;
}

export default function MatchRepairClient({
  matchId,
}) {
  const router =
    useRouter();

  const [
    data,
    setData,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    applying,
    setApplying,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const loadPreview =
    useCallback(
      async () => {
        if (
          !Number.isInteger(
            matchId
          ) ||
          matchId <= 0
        ) {
          setError(
            "Invalid match id."
          );
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setError("");

          const result =
            await api(
              `/api/matches/${matchId}/repair`
            );

          setData(
            result
          );
        } catch (
          requestError
        ) {
          setError(
            requestError
              .message
          );
        } finally {
          setLoading(false);
        }
      },
      [matchId]
    );

  useEffect(
    () => {
      loadPreview();
    },
    [loadPreview]
  );

  async function applyRepair() {
    const count =
      data?.analysis
        ?.counts
        ?.safeChanges ||
      0;

    if (!count) {
      return;
    }

    const confirmed =
      window.confirm(
        `Apply ${count} high-confidence repair(s) to match ${matchId}?\n\nThis also clears only this match's cached AI Review so it can regenerate from corrected data.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setApplying(true);
      setError("");
      setSuccess("");

      const result =
        await api(
          `/api/matches/${matchId}/repair`,
          {
            method:
              "POST",

            body:
              JSON.stringify({
                action:
                  "APPLY_SAFE_REPAIR",

                confirmMatchId:
                  matchId,
              }),
          }
        );

      setSuccess(
        result.message
      );

      await loadPreview();
    } catch (
      requestError
    ) {
      setError(
        requestError
          .message
      );
    } finally {
      setApplying(false);
    }
  }

  const safeChanges =
    data?.analysis
      ?.safeChanges ||
    [];

  const warnings =
    data?.analysis
      ?.warnings ||
    [];

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.back}
            onClick={() =>
              router.back()
            }
          >
            ← Back
          </button>

          <div className={styles.titleBlock}>
            <span>
              MATCH DATA SAFETY
            </span>

            <h1>
              🛠 Match Repair Center
            </h1>

            <p>
              Preview and apply only high-confidence delivery repairs. No other match is changed.
            </p>
          </div>

          <div className={styles.matchBadge}>
            Match #{matchId}
          </div>
        </header>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {success && (
          <div className={styles.success}>
            {success}
          </div>
        )}

        {loading ? (
          <div className={styles.loading}>
            <span>🔎</span>
            Inspecting delivery history…
          </div>
        ) : data ? (
          <>
            <section className={styles.matchSummary}>
              <div>
                <small>
                  Match
                </small>

                <strong>
                  {data.match.teamA}{" "}
                  <span>vs</span>{" "}
                  {data.match.teamB}
                </strong>
              </div>

              <div>
                <small>
                  League
                </small>

                <strong>
                  {data.match.leagueName}
                </strong>
              </div>

              <div>
                <small>
                  Deliveries
                </small>

                <strong>
                  {data.match.ballCount}
                </strong>
              </div>

              <div>
                <small>
                  Status
                </small>

                <strong>
                  {data.match.status}
                </strong>
              </div>
            </section>

            <section className={styles.statusGrid}>
              <article className={styles.safeCard}>
                <span>✅</span>

                <div>
                  <strong>
                    {
                      data.analysis
                        .counts
                        .safeChanges
                    }
                  </strong>

                  <small>
                    High-confidence repairs
                  </small>
                </div>
              </article>

              <article className={styles.warningCard}>
                <span>⚠️</span>

                <div>
                  <strong>
                    {
                      data.analysis
                        .counts
                        .warnings
                    }
                  </strong>

                  <small>
                    Manual-review warnings
                  </small>
                </div>
              </article>

              <article className={styles.scopeCard}>
                <span>🔒</span>

                <div>
                  <strong>
                    1
                  </strong>

                  <small>
                    Match in scope
                  </small>
                </div>
              </article>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <span>
                    SAFE REPAIR PLAN
                  </span>

                  <h2>
                    Proposed changes
                  </h2>
                </div>

                <button
                  type="button"
                  className={styles.refresh}
                  disabled={
                    loading ||
                    applying
                  }
                  onClick={
                    loadPreview
                  }
                >
                  ↻ Re-scan
                </button>
              </div>

              {!safeChanges.length ? (
                <div className={styles.empty}>
                  No high-confidence database changes are required.
                </div>
              ) : (
                <div className={styles.changeList}>
                  {safeChanges.map(
                    (change) => (
                      <article
                        key={
                          change.id
                        }
                      >
                        <div className={styles.changeMeta}>
                          <span>
                            Innings{" "}
                            {change.inningsNo}
                          </span>

                          <strong>
                            {change.overLabel}
                          </strong>

                          <small>
                            Sequence{" "}
                            {change.sequence}
                          </small>
                        </div>

                        <div className={styles.changeBody}>
                          {change.issues.map(
                            (
                              issue
                            ) => (
                              <div
                                key={
                                  issue.code
                                }
                              >
                                <strong>
                                  {
                                    issue.message
                                  }
                                </strong>

                                <code>
                                  {JSON.stringify(
                                    issue.before
                                  )}
                                  {" → "}
                                  {JSON.stringify(
                                    issue.after
                                  )}
                                </code>
                              </div>
                            )
                          )}
                        </div>

                        <span className={styles.confidence}>
                          HIGH
                        </span>
                      </article>
                    )
                  )}
                </div>
              )}
            </section>

            {!!warnings.length && (
              <section className={styles.panel}>
                <div className={styles.panelHeading}>
                  <div>
                    <span>
                      NOT AUTO-CHANGED
                    </span>

                    <h2>
                      Manual review
                    </h2>
                  </div>
                </div>

                <div className={styles.warningList}>
                  {warnings.map(
                    (
                      warning,
                      index
                    ) => (
                      <article
                        key={`${warning.id}-${index}`}
                      >
                        <strong>
                          Innings{" "}
                          {warning.inningsNo},{" "}
                          {warning.overLabel}
                        </strong>

                        <p>
                          {warning.message}
                        </p>
                      </article>
                    )
                  )}
                </div>
              </section>
            )}

            <footer className={styles.footer}>
              <div>
                <strong>
                  What happens when applied?
                </strong>

                <p>
                  Only the listed Ball rows are updated. The cached AI Review for this match is cleared. Other matches and league data are untouched.
                </p>
              </div>

              <button
                type="button"
                className={styles.apply}
                disabled={
                  applying ||
                  !safeChanges.length
                }
                onClick={
                  applyRepair
                }
              >
                {applying
                  ? "Applying…"
                  : `Apply ${safeChanges.length} safe repair${safeChanges.length === 1 ? "" : "s"}`}
              </button>
            </footer>
          </>
        ) : null}
      </section>
    </main>
  );
}
