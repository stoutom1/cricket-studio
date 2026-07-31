"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available";
  }

  return date.toLocaleString(
    [],
    {
      month:
        "short",
      day:
        "numeric",
      year:
        "numeric",
      hour:
        "numeric",
      minute:
        "2-digit",
    }
  );
}

function eventLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

export default function LeagueKitDashboard({
  leagueId,
}) {
    const numericLeagueId =
    Number(leagueId);

  const hasValidLeagueId =
    Number.isInteger(
      numericLeagueId
    ) &&
    numericLeagueId > 0;

  const [
    data,
    setData,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const loadDashboard =
  useCallback(async () => {
    if (!hasValidLeagueId) {
      setData(null);
      setError("");
      return;
    }

      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            `/api/leagues/${numericLeagueId}/kit-dashboard`,
            {
              method:
                "GET",

              cache:
                "no-store",
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result?.error ||
              "Unable to load league-kit dashboard."
          );
        }

        setData(result);
      } catch (requestError) {
        setError(
          requestError?.message ||
            "Unable to load league-kit dashboard."
        );
      } finally {
        setLoading(false);
      }
    }, [
  hasValidLeagueId,
  numericLeagueId,
]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

if (!hasValidLeagueId) {
  return null;
}

  if (
    loading &&
    !data
  ) {
    return (
      <section className="league-kit-dashboard">
        <div className="league-kit-dashboard-message">
          Loading league kit...
        </div>
      </section>
    );
  }

  if (
    error &&
    !data
  ) {
    return (
      <section className="league-kit-dashboard">
        <div className="league-kit-dashboard-error">
          {error}
        </div>
      </section>
    );
  }

  if (!data) {
    return null;
  }

  const holder =
    data.leagueKit
      ?.currentHolderRotationMember;

  const previousHolder =
    data.leagueKit
      ?.previousHolderRotationMember;

  const assignment =
    data.nextMatch
      ?.assignment;

  const assignedName =
    assignment
      ?.rotationMember
      ?.displayName ||
    assignment
      ?.matchKitPlayer
      ?.displayName ||
    "Not assigned";

  const assignedTeam =
    assignment
      ?.matchKitPlayer
      ?.team
      ?.name ||
    assignment
      ?.team
      ?.name ||
    "Playing team";

  return (
    <section className="league-kit-dashboard">
      <div className="league-kit-dashboard-header">
        <div>
          <span className="league-kit-dashboard-kicker">
            Shared league equipment
          </span>

          <h2>
            🏏 League Kit Dashboard
          </h2>

          <p>
            One source of truth for custody, the next match, rotation fairness, and recent activity.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline"
          onClick={
            loadDashboard
          }
          disabled={
            loading
          }
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      <div
        className={`league-kit-readiness readiness-${String(
          data.readiness
            ?.level ||
            "unknown"
        ).toLowerCase()}`}
      >
        <strong>
          {
            data.readiness
              ?.label
          }
        </strong>

        <span>
          {
            data.readiness
              ?.message
          }
        </span>
      </div>

      <div className="league-kit-dashboard-grid">
        <article className="league-kit-dashboard-card">
          <span>
            Current holder
          </span>

          <strong>
            {holder
              ?.displayName ||
              "Not recorded"}
          </strong>

          <small>
            Last pickup:{" "}
            {formatDate(
              holder
                ?.lastCompletedAt
            )}
          </small>
        </article>

        <article className="league-kit-dashboard-card">
          <span>
            Previous holder
          </span>

          <strong>
            {previousHolder
              ?.displayName ||
              "Not available"}
          </strong>

          <small>
            Historical custody reference
          </small>
        </article>

        <article className="league-kit-dashboard-card">
          <span>
            Assigned for next match
          </span>

          <strong>
            {assignedName}
          </strong>

          <small>
            {assignedTeam}
          </small>
        </article>

        <article className="league-kit-dashboard-card">
          <span>
            Rotation fairness
          </span>

          <strong>
            {data.analytics
              ?.fairnessStatus ===
            "BALANCED"
              ? "Balanced"
              : "Needs attention"}
          </strong>

          <small>
            Spread:{" "}
            {Number(
              data.analytics
                ?.completionSpread ||
                0
            )}
          </small>
        </article>
      </div>

      {data.nextMatch && (
        <article className="league-kit-next-match">
          <div>
            <span>
              Next match
            </span>

            <strong>
              {data.nextMatch
                .teamA
                ?.name ||
                "Team A"}{" "}
              vs{" "}
              {data.nextMatch
                .teamB
                ?.name ||
                "Team B"}
            </strong>
          </div>

          <time>
            {formatDate(
              data.nextMatch
                .scheduledAt
            )}
          </time>
        </article>
      )}

      <div className="league-kit-dashboard-columns">
        <section className="league-kit-dashboard-section">
          <div className="league-kit-section-heading">
            <strong>
              Rotation standings
            </strong>

            <span>
              Fewest completed turns appear first.
            </span>
          </div>

          <div className="league-kit-rotation-list">
            {data.analytics
              ?.rotationMembers
              ?.map(
                (
                  member,
                  index
                ) => (
                  <div
                    key={
                      member.id
                    }
                    className="league-kit-rotation-row"
                  >
                    <b>
                      {index +
                        1}
                    </b>

                    <strong>
                      {
                        member.displayName
                      }
                    </strong>

                    <span>
                      {Number(
                        member.completedCount ||
                          0
                      )}{" "}
                      turn
                      {Number(
                        member.completedCount ||
                          0
                      ) ===
                      1
                        ? ""
                        : "s"}
                    </span>
                  </div>
                )
              )}
          </div>
        </section>

        <section className="league-kit-dashboard-section">
          <div className="league-kit-section-heading">
            <strong>
              Recent kit activity
            </strong>

            <span>
              Latest custody and operational events.
            </span>
          </div>

          <div className="league-kit-event-list">
            {data.recentEvents
              ?.length ? (
              data.recentEvents.map(
                (event) => (
                  <article
                    key={
                      event.id
                    }
                    className="league-kit-event-row"
                  >
                    <div>
                      <strong>
                        {eventLabel(
                          event.eventType
                        )}
                      </strong>

                      <time>
                        {formatDate(
                          event.occurredAt
                        )}
                      </time>
                    </div>

                    {event.description && (
                      <p>
                        {
                          event.description
                        }
                      </p>
                    )}

                    {(event.fromHolderName ||
                      event.toHolderName) && (
                      <small>
                        {event.fromHolderName ||
                          "Not recorded"}{" "}
                        →{" "}
                        {event.toHolderName ||
                          "Not recorded"}
                      </small>
                    )}
                  </article>
                )
              )
            ) : (
              <div className="league-kit-dashboard-message">
                No kit history recorded yet.
              </div>
            )}
          </div>
        </section>
      </div>

      <style jsx>{`
        .league-kit-dashboard {
          display: grid;
          gap: 16px;
          margin: 18px 0;
        }

        .league-kit-dashboard-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .league-kit-dashboard-header h2,
        .league-kit-dashboard-header p {
          margin: 0;
        }

        .league-kit-dashboard-header p {
          margin-top: 6px;
          opacity: 0.72;
        }

        .league-kit-dashboard-kicker {
          display: inline-block;
          margin-bottom: 4px;
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          opacity: 0.68;
        }

        .league-kit-readiness {
          display: grid;
          gap: 4px;
          padding: 14px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.35);
        }

        .readiness-ready {
          background: rgba(22, 163, 74, 0.1);
        }

        .readiness-coordinated {
          background: rgba(37, 99, 235, 0.08);
        }

        .readiness-urgent,
        .readiness-holder_missing {
          background: rgba(220, 38, 38, 0.09);
        }

        .readiness-pending,
        .readiness-no_assignment,
        .readiness-not_configured {
          background: rgba(245, 158, 11, 0.1);
        }

        .league-kit-dashboard-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .league-kit-dashboard-card {
          display: grid;
          gap: 6px;
          padding: 15px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 14px;
          background: var(--card-bg, #ffffff);
        }

        .league-kit-dashboard-card span,
        .league-kit-dashboard-card small {
          opacity: 0.7;
        }

        .league-kit-dashboard-card strong {
          font-size: 1.06rem;
        }

        .league-kit-next-match {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 15px;
          border-radius: 14px;
          background: rgba(37, 99, 235, 0.07);
        }

        .league-kit-next-match > div {
          display: grid;
          gap: 4px;
        }

        .league-kit-next-match span,
        .league-kit-next-match time {
          opacity: 0.72;
        }

        .league-kit-dashboard-columns {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
          gap: 14px;
        }

        .league-kit-dashboard-section {
          display: grid;
          gap: 12px;
          padding: 15px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 14px;
          background: var(--card-bg, #ffffff);
        }

        .league-kit-section-heading {
          display: grid;
          gap: 4px;
        }

        .league-kit-section-heading span {
          font-size: 0.84rem;
          opacity: 0.7;
        }

        .league-kit-rotation-list,
        .league-kit-event-list {
          display: grid;
          gap: 9px;
        }

        .league-kit-rotation-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          padding: 10px;
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.04);
        }

        .league-kit-rotation-row b {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(37, 99, 235, 0.1);
        }

        .league-kit-rotation-row span {
          opacity: 0.72;
        }

        .league-kit-event-row {
          display: grid;
          gap: 6px;
          padding: 11px;
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.035);
        }

        .league-kit-event-row > div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .league-kit-event-row p {
          margin: 0;
          line-height: 1.45;
        }

        .league-kit-event-row time,
        .league-kit-event-row small {
          font-size: 0.78rem;
          opacity: 0.68;
        }

        .league-kit-dashboard-message,
        .league-kit-dashboard-error {
          padding: 14px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.05);
        }

        .league-kit-dashboard-error {
          color: #b91c1c;
        }

        @media (max-width: 900px) {
          .league-kit-dashboard-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .league-kit-dashboard-columns {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .league-kit-dashboard-header,
          .league-kit-next-match,
          .league-kit-event-row > div {
            display: grid;
          }

          .league-kit-dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
