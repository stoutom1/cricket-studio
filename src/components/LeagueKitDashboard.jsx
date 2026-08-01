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

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

function assignmentName(assignment) {
  return (
    assignment?.assignedName ||
    assignment?.rotationMember
      ?.displayName ||
    assignment?.matchKitPlayer
      ?.displayName ||
    "Not assigned"
  );
}

function assignmentTeamName(
  assignment
) {
  return (
    assignment?.team?.name ||
    assignment?.matchKitPlayer
      ?.team?.name ||
    "Playing team"
  );
}

function holderForTeam(
  teamCustody,
  teamId
) {
  return (
    teamCustody.find(
      (item) =>
        Number(item.teamId) ===
        Number(teamId)
    ) || null
  );
}

function assignmentForTeam(
  assignments,
  teamId
) {
  return (
    assignments.find(
      (assignment) =>
        Number(
          assignment.teamId
        ) === Number(teamId)
    ) || null
  );
}

function analyticsForTeam(
  teamAnalytics,
  teamId
) {
  return (
    teamAnalytics.find(
      (item) =>
        Number(item.teamId) ===
        Number(teamId)
    ) || null
  );
}

function CollapsibleDashboardSection({
  title,
  subtitle,
  eyebrow = "",
  icon = "✨",
  badge = "",
  children,
  className = "",
}) {
  return (
    <details
      className={`league-kit-collapsible ${className}`}
    >
      <summary className="league-kit-collapsible-summary">
        <span
          className="league-kit-collapsible-icon"
          aria-hidden="true"
        >
          {icon}
        </span>

        <div className="league-kit-collapsible-copy">
          {eyebrow && (
            <small>{eyebrow}</small>
          )}

          <strong>{title}</strong>

          {subtitle && (
            <span>{subtitle}</span>
          )}
        </div>

        <div className="league-kit-collapsible-actions">
          {badge && (
            <span className="league-kit-collapsible-badge">
              {badge}
            </span>
          )}

          <span
            className="league-kit-collapsible-toggle"
            aria-hidden="true"
          >
            <span className="when-closed">View</span>
            <span className="when-open">Hide</span>

            <span className="league-kit-chevron">
              <i />
              <i />
            </span>
          </span>
        </div>
      </summary>

      <div className="league-kit-collapsible-body">
        {children}
      </div>
    </details>
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
              method: "GET",
              cache: "no-store",
            }
          );

        const responseText =
          await response.text();

        let result = {};

        try {
          result =
            responseText
              ? JSON.parse(
                  responseText
                )
              : {};
        } catch {
          throw new Error(
            `The kit dashboard returned an invalid server response (HTTP ${response.status}).`
          );
        }

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

  const isTeamMode =
    data.mode === "TEAM" ||
    data.sharedKit === false;

  const holder =
    data.leagueKit
      ?.currentHolderRotationMember;

  const previousHolder =
    data.leagueKit
      ?.previousHolderRotationMember;

  const sharedAssignment =
    data.nextMatch
      ?.assignment;

  const teamCustody =
    Array.isArray(
      data.teamCustody
    )
      ? data.teamCustody
      : [];

  const nextAssignments =
    Array.isArray(
      data.nextMatch
        ?.assignments
    )
      ? data.nextMatch
          .assignments
      : [];

  const teamAnalytics =
    Array.isArray(
      data.teamAnalytics
    )
      ? data.teamAnalytics
      : [];

  const nextMatchTeams =
    data.nextMatch
      ? [
          data.nextMatch.teamA,
          data.nextMatch.teamB,
        ].filter(Boolean)
      : [];

  return (
    <section className="league-kit-dashboard">
      <div className="league-kit-dashboard-header">
        <div>
          <span className="league-kit-dashboard-kicker">
            {isTeamMode
              ? "Team equipment custody"
              : data.league?.isSurpriseCricketLeague
                ? "One shared kit across every team"
                : "Shared league equipment"}
          </span>

          <h2>
            🎒 League Kit Dashboard
          </h2>

          <p>
            {isTeamMode
              ? "One source of truth for each team kit, current physical custody, next-match responsibility, fairness, and recent activity."
              : data.league?.isSurpriseCricketLeague
                ? "Surprise Cricket League uses one physical kit for every team, so custody, responsibility, and rotation are tracked once for the entire league."
                : "One source of truth for custody, the next match, rotation fairness, and recent activity."}
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

      {error && (
        <div className="league-kit-dashboard-error">
          {error}
        </div>
      )}

      <div
        className={`league-kit-readiness readiness-${String(
          data.readiness
            ?.level ||
            "unknown"
        ).toLowerCase()}`}
      >
        <strong>
          {data.readiness
            ?.label}
        </strong>

        <span>
          {data.readiness
            ?.message}
        </span>
      </div>

      {isTeamMode ? (
        <>
          <CollapsibleDashboardSection
            eyebrow="LIVE CUSTODY SNAPSHOT"
            icon="🎒"
            title="Current physical custody"
            subtitle="See who has each kit now and who is responsible for bringing it to the next match."
            badge={`${nextMatchTeams.length || teamCustody.filter((item) => item.holderName).length} team kits`}
            className="team-kit-overview"
          >
            <div className="team-kit-card-grid">
              {nextMatchTeams.length ? (
                nextMatchTeams.map(
                  (team) => {
                    const custody =
                      holderForTeam(
                        teamCustody,
                        team.id
                      );

                    const assignment =
                      assignmentForTeam(
                        nextAssignments,
                        team.id
                      );

                    const analytics =
                      analyticsForTeam(
                        teamAnalytics,
                        team.id
                      );

                    return (
                      <article
                        key={team.id}
                        className="team-kit-card"
                      >
                        <div className="team-kit-card-heading">
                          <span>
                            Team kit
                          </span>

                          <strong>
                            {team.name ||
                              `Team ${team.id}`}
                          </strong>
                        </div>

                        <div className="team-kit-flow">
                          <div>
                            <small>
                              Currently held by
                            </small>

                            <strong>
                              {custody
                                ?.holderName ||
                                "Not recorded"}
                            </strong>

                            <span>
                              {custody
                                ?.previousMatchName
                                ? `Recorded after ${custody.previousMatchName}`
                                : "No previous custody record"}
                            </span>

                            <time>
                              {formatDate(
                                custody
                                  ?.recordedAt
                              )}
                            </time>
                          </div>

                          <span
                            className="team-kit-arrow"
                            aria-hidden="true"
                          >
                            →
                          </span>

                          <div>
                            <small>
                              Responsible for next match
                            </small>

                            <strong>
                              {assignmentName(
                                assignment
                              )}
                            </strong>

                            <span>
                              {assignment
                                ? assignmentTeamName(
                                    assignment
                                  )
                                : "Generate the next assignment"}
                            </span>
                          </div>
                        </div>

                        <div className="team-kit-fairness">
                          <span>
                            Rotation fairness
                          </span>

                          <strong>
                            {analytics
                              ?.fairnessStatus ===
                            "BALANCED"
                              ? "Balanced"
                              : analytics
                                  ?.fairnessStatus
                                ? "Needs attention"
                                : "No history yet"}
                          </strong>

                          <small>
                            Spread:{" "}
                            {Number(
                              analytics
                                ?.completionSpread ||
                                0
                            )}
                          </small>
                        </div>
                      </article>
                    );
                  }
                )
              ) : (
                <div className="league-kit-dashboard-message">
                  No upcoming match is available. Team custody history is shown below.
                </div>
              )}
            </div>
          </CollapsibleDashboardSection>

          {!nextMatchTeams.length &&
            teamCustody.length > 0 && (
              <section className="team-kit-overview">
                <div className="team-kit-card-grid">
                  {teamCustody
                    .filter(
                      (item) =>
                        item.holderName
                    )
                    .map(
                      (custody) => (
                        <article
                          key={
                            custody.teamId
                          }
                          className="team-kit-card"
                        >
                          <div className="team-kit-card-heading">
                            <span>
                              Team kit
                            </span>

                            <strong>
                              {custody.teamName}
                            </strong>
                          </div>

                          <div className="team-kit-holder-only">
                            <small>
                              Currently held by
                            </small>

                            <strong>
                              {custody.holderName}
                            </strong>

                            <span>
                              {custody.previousMatchName
                                ? `Recorded after ${custody.previousMatchName}`
                                : "Previous match unavailable"}
                            </span>

                            <time>
                              {formatDate(
                                custody.recordedAt
                              )}
                            </time>
                          </div>
                        </article>
                      )
                    )}
                </div>
              </section>
            )}
        </>
      ) : (
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
              {assignmentName(
                sharedAssignment
              )}
            </strong>

            <small>
              {assignmentTeamName(
                sharedAssignment
              )}
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
      )}

      {data.nextMatch && (
        <CollapsibleDashboardSection
          eyebrow="UPCOMING FIXTURE"
          icon="🏏"
          title="Next match"
          subtitle={`${data.nextMatch.teamA?.name || "Team A"} vs ${data.nextMatch.teamB?.name || "Team B"}`}
          badge={formatDate(data.nextMatch.scheduledAt)}
          className="league-kit-next-match-collapsible"
        >
          <article className="league-kit-next-match">
            <div>
              <span>
                Match
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
        </CollapsibleDashboardSection>
      )}

      <div className="league-kit-dashboard-columns league-kit-dashboard-columns-wow">
        <CollapsibleDashboardSection
          eyebrow="FAIR ROTATION"
          icon="📊"
          title={isTeamMode ? "Team rotation standings" : "Rotation standings"}
          badge={`${Number(data.analytics?.activeRotationMembers || 0)} players`}
          className="league-kit-standings-collapsible"
        >
          {isTeamMode ? (
            <div className="team-rotation-groups">
              {teamAnalytics.length ? (
                teamAnalytics.map(
                  (team) => (
                    <section
                      key={team.teamId}
                      className="team-rotation-group"
                    >
                      <div className="team-rotation-group-heading">
                        <strong>
                          {team.teamName}
                        </strong>

                        <span>
                          {team.fairnessStatus ===
                          "BALANCED"
                            ? "Balanced"
                            : "Needs attention"}
                        </span>
                      </div>

                      <div className="league-kit-rotation-list">
                        {team.rotationMembers
                          ?.length ? (
                          team.rotationMembers.map(
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
                          )
                        ) : (
                          <div className="league-kit-dashboard-message">
                            No rotation members saved.
                          </div>
                        )}
                      </div>
                    </section>
                  )
                )
              ) : (
                <div className="league-kit-dashboard-message">
                  No rotation standings available.
                </div>
              )}
            </div>
          ) : (
            <div className="league-kit-rotation-list">
              {data.analytics
                ?.rotationMembers
                ?.length ? (
                data.analytics
                  .rotationMembers
                  .map(
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
                          {index + 1}
                        </b>

                        <strong>
                          {member.displayName}
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
                  )
              ) : (
                <div className="league-kit-dashboard-message">
                  No rotation standings available.
                </div>
              )}
            </div>
          )}

        </CollapsibleDashboardSection>

        <CollapsibleDashboardSection
          eyebrow="AUDIT TRAIL"
          icon="🕘"
          badge={`${Number(data.recentEvents?.length || 0)} events`}
          className="league-kit-activity-collapsible"
        >

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
                        {event.team
                          ?.name
                          ? `${event.team.name}: ${eventLabel(event.eventType)}`
                          : eventLabel(
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
                          "Previous holder not recorded"}{" "}
                        →{" "}
                        {event.toHolderName ||
                          "No new holder"}
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

        </CollapsibleDashboardSection>
      </div>

      <style jsx global>{`
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
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .league-kit-dashboard-card,
        .team-kit-card {
          display: grid;
          gap: 12px;
          padding: 15px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 14px;
          background: var(--card-bg, #ffffff);
        }

        .league-kit-dashboard-card span,
        .league-kit-dashboard-card small,
        .team-kit-card span,
        .team-kit-card small,
        .team-kit-card time {
          opacity: 0.7;
        }

        .league-kit-dashboard-card strong {
          font-size: 1.06rem;
        }

        .league-kit-collapsible {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(96, 165, 250, 0.28);
          border-radius: 22px;
          background:
            radial-gradient(circle at 94% 8%, rgba(56, 189, 248, 0.16), transparent 34%),
            linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(17, 35, 67, 0.94));
          box-shadow:
            0 18px 48px rgba(2, 8, 23, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          transition:
            transform 180ms ease,
            border-color 180ms ease,
            box-shadow 180ms ease;
        }

        .league-kit-collapsible::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 4px;
          background: linear-gradient(180deg, #38bdf8, #7c3aed 60%, transparent);
        }

        .league-kit-collapsible:hover {
          transform: translateY(-2px);
          border-color: rgba(125, 211, 252, 0.55);
          box-shadow:
            0 24px 60px rgba(2, 8, 23, 0.32),
            0 0 0 1px rgba(56, 189, 248, 0.08);
        }

        .league-kit-collapsible[open] {
          border-color: rgba(96, 165, 250, 0.55);
          box-shadow:
            0 28px 70px rgba(2, 8, 23, 0.34),
            0 0 0 1px rgba(59, 130, 246, 0.08);
        }

        .league-kit-collapsible-summary {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 14px;
          min-height: 88px;
          padding: 16px 18px 16px 20px;
          cursor: pointer;
          list-style: none;
          user-select: none;
        }

        .league-kit-collapsible-summary::-webkit-details-marker {
          display: none;
        }

        .league-kit-collapsible-icon {
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          border: 1px solid rgba(125, 211, 252, 0.28);
          border-radius: 15px;
          background: linear-gradient(145deg, rgba(14, 165, 233, 0.22), rgba(124, 58, 237, 0.2));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 10px 24px rgba(2, 8, 23, 0.2);
          font-size: 1.35rem;
        }

        .league-kit-collapsible-copy {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .league-kit-collapsible-copy small {
          color: #7dd3fc;
          font-size: 0.69rem;
          font-weight: 900;
          letter-spacing: 0.11em;
          text-transform: uppercase;
        }

        .league-kit-collapsible-copy > strong {
          color: #f8fafc;
          font-size: 1.04rem;
          line-height: 1.25;
        }

        .league-kit-collapsible-copy > span {
          overflow: hidden;
          color: #a8b4c8;
          font-size: 0.82rem;
          line-height: 1.42;
          text-overflow: ellipsis;
        }

        .league-kit-collapsible-actions {
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }

        .league-kit-collapsible-badge {
          max-width: 210px;
          overflow: hidden;
          padding: 7px 10px;
          border: 1px solid rgba(125, 211, 252, 0.22);
          border-radius: 999px;
          color: #dbeafe;
          background: rgba(30, 64, 175, 0.18);
          font-size: 0.72rem;
          font-weight: 800;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .league-kit-collapsible-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-width: 76px;
          padding: 9px 12px;
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 999px;
          color: #f8fafc;
          background: linear-gradient(145deg, rgba(30, 41, 59, 0.88), rgba(15, 23, 42, 0.9));
          font-size: 0.75rem;
          font-weight: 900;
        }

        .league-kit-chevron {
          position: relative;
          display: block;
          width: 14px;
          height: 10px;
          transition: transform 180ms ease;
        }

        .league-kit-chevron i {
          position: absolute;
          top: 4px;
          width: 8px;
          height: 2px;
          border-radius: 999px;
          background: #7dd3fc;
        }

        .league-kit-chevron i:first-child {
          left: 0;
          transform: rotate(42deg);
          transform-origin: right center;
        }

        .league-kit-chevron i:last-child {
          right: 0;
          transform: rotate(-42deg);
          transform-origin: left center;
        }

        .league-kit-collapsible .when-open {
          display: none;
        }

        .league-kit-collapsible[open] .when-closed {
          display: none;
        }

        .league-kit-collapsible[open] .when-open {
          display: inline;
        }

        .league-kit-collapsible[open] .league-kit-chevron {
          transform: rotate(180deg);
        }

        .league-kit-collapsible-body {
          padding: 0 16px 16px;
          animation: league-kit-reveal 180ms ease;
        }

        .league-kit-collapsible-body::before {
          content: "";
          display: block;
          height: 1px;
          margin-bottom: 15px;
          background: linear-gradient(90deg, transparent, rgba(125, 211, 252, 0.26), transparent);
        }

        .team-kit-overview {
          background:
            radial-gradient(circle at 96% 0%, rgba(34, 197, 94, 0.13), transparent 36%),
            linear-gradient(145deg, rgba(8, 32, 48, 0.98), rgba(10, 25, 45, 0.96));
        }

        .team-kit-overview::before {
          background: linear-gradient(180deg, #34d399, #22d3ee 58%, transparent);
        }

        .league-kit-next-match-collapsible {
          background:
            radial-gradient(circle at 94% 8%, rgba(59, 130, 246, 0.17), transparent 35%),
            linear-gradient(145deg, rgba(13, 34, 75, 0.98), rgba(10, 25, 52, 0.96));
        }

        .league-kit-standings-collapsible {
          background:
            radial-gradient(circle at 94% 8%, rgba(168, 85, 247, 0.15), transparent 35%),
            linear-gradient(145deg, rgba(34, 17, 62, 0.98), rgba(19, 23, 48, 0.96));
        }

        .league-kit-standings-collapsible::before {
          background: linear-gradient(180deg, #c084fc, #60a5fa 58%, transparent);
        }

        .league-kit-activity-collapsible {
          background:
            radial-gradient(circle at 94% 8%, rgba(245, 158, 11, 0.13), transparent 35%),
            linear-gradient(145deg, rgba(48, 29, 12, 0.98), rgba(28, 25, 30, 0.96));
        }

        .league-kit-activity-collapsible::before {
          background: linear-gradient(180deg, #f59e0b, #fb7185 58%, transparent);
        }

        @keyframes league-kit-reveal {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .team-kit-card-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .team-kit-card-heading,
        .team-kit-holder-only {
          display: grid;
          gap: 4px;
        }

        .team-kit-card-heading strong {
          font-size: 1.1rem;
        }

        .team-kit-flow {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            auto
            minmax(0, 1fr);
          gap: 12px;
          align-items: center;
        }

        .team-kit-flow > div {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .team-kit-flow strong,
        .team-kit-holder-only strong {
          font-size: 1.08rem;
          overflow-wrap: anywhere;
        }

        .team-kit-flow time,
        .team-kit-holder-only time {
          font-size: 0.78rem;
        }

        .team-kit-arrow {
          font-size: 1.35rem;
          opacity: 0.65;
        }

        .team-kit-fairness {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            auto;
          gap: 4px 10px;
          align-items: center;
          padding-top: 11px;
          border-top: 1px solid rgba(148, 163, 184, 0.2);
        }

        .team-kit-fairness small {
          grid-column: 1 / -1;
        }

        .league-kit-next-match {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 15px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.035);
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
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          grid-auto-rows: 1fr;
          gap: 16px;
          align-items: stretch;
        }

        .league-kit-dashboard-columns-wow
          > .league-kit-collapsible {
          height: auto;
          min-height: 0;
        }

        .league-kit-dashboard-columns-wow
          > .league-kit-collapsible:not([open])
          .league-kit-collapsible-summary {
          min-height: 88px;
        }

        .league-kit-dashboard-columns-wow
          > .league-kit-collapsible[open] {
          height: auto;
        }

        .league-kit-dashboard-columns-wow
          > .league-kit-collapsible
          .league-kit-collapsible-summary {
          grid-template-columns:
            auto minmax(0, 1fr) auto;
          align-items: center;
          padding: 14px 16px;
        }

        .league-kit-dashboard-columns-wow
          > .league-kit-collapsible
          .league-kit-collapsible-copy {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .league-kit-dashboard-columns-wow
          > .league-kit-collapsible
          .league-kit-collapsible-copy small {
          flex: 0 0 auto;
          white-space: nowrap;
        }

        .league-kit-dashboard-columns-wow
          > .league-kit-collapsible
          .league-kit-collapsible-copy > strong {
          flex: 1 1 auto;
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .league-kit-dashboard-columns-wow
          > .league-kit-collapsible
          .league-kit-collapsible-copy > span {
          display: none;
        }

        .league-kit-dashboard-columns-wow
          > .league-kit-collapsible
          .league-kit-collapsible-actions {
          flex: 0 0 auto;
          white-space: nowrap;
        }

        .league-kit-dashboard-columns-wow
          > .league-kit-collapsible
          .league-kit-collapsible-icon {
          width: 42px;
          height: 42px;
          border-radius: 13px;
          font-size: 1.15rem;
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
        .league-kit-event-list,
        .team-rotation-groups {
          display: grid;
          gap: 9px;
        }

        .team-rotation-group {
          display: grid;
          gap: 9px;
          padding: 11px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.035);
        }

        .team-rotation-group-heading {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .team-rotation-group-heading span {
          opacity: 0.72;
        }

        .league-kit-rotation-row {
          display: grid;
          grid-template-columns:
            auto minmax(0, 1fr) auto;
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

        @media (max-width: 1000px) {
          .league-kit-dashboard-grid,
          .team-kit-card-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .league-kit-dashboard-columns {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .league-kit-dashboard-columns-wow
            > .league-kit-collapsible,
          .league-kit-dashboard-columns-wow
            > .league-kit-collapsible:not([open])
            .league-kit-collapsible-summary {
            height: auto;
            min-height: 0;
          }

          .league-kit-dashboard-columns-wow
            > .league-kit-collapsible
            .league-kit-collapsible-summary {
            grid-template-columns:
              auto minmax(0, 1fr);
            align-items: center;
            padding: 13px 14px;
          }

          .league-kit-dashboard-columns-wow
            > .league-kit-collapsible
            .league-kit-collapsible-copy {
            display: grid;
            gap: 2px;
          }

          .league-kit-dashboard-columns-wow
            > .league-kit-collapsible
            .league-kit-collapsible-copy small,
          .league-kit-dashboard-columns-wow
            > .league-kit-collapsible
            .league-kit-collapsible-copy > strong {
            white-space: nowrap;
          }

          .league-kit-dashboard-columns-wow
            > .league-kit-collapsible
            .league-kit-collapsible-actions {
            grid-column: 1 / -1;
            width: 100%;
            justify-content: flex-end;
            padding-left: 56px;
            margin-top: 8px;
          }

          .league-kit-dashboard-header,
          .league-kit-next-match,
          .league-kit-event-row > div {
            display: grid;
          }

          .league-kit-collapsible-summary {
            grid-template-columns: auto minmax(0, 1fr);
            align-items: start;
            min-height: 82px;
            padding: 14px 14px 14px 17px;
          }

          .league-kit-collapsible-icon {
            width: 43px;
            height: 43px;
            border-radius: 13px;
            font-size: 1.2rem;
          }

          .league-kit-collapsible-copy > strong {
            font-size: 0.98rem;
          }

          .league-kit-collapsible-copy > span {
            display: -webkit-box;
            overflow: hidden;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }

          .league-kit-collapsible-actions {
            grid-column: 1 / -1;
            width: 100%;
            justify-content: space-between;
            padding-left: 57px;
          }

          .league-kit-collapsible-badge {
            max-width: calc(100vw - 175px);
          }

          .league-kit-collapsible-toggle {
            min-width: 72px;
            padding: 7px 10px;
          }

          .league-kit-collapsible-body {
            padding: 0 12px 12px;
          }

          .league-kit-dashboard-grid,
          .team-kit-card-grid {
            grid-template-columns: 1fr;
          }

          .team-kit-flow {
            grid-template-columns: 1fr;
          }

          .team-kit-arrow {
            transform: rotate(90deg);
            justify-self: start;
          }
        }
      `}</style>
    </section>
  );
}
