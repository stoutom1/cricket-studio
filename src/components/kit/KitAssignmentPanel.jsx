"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

function formatDate(value) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Never";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(status) {
  return String(
    status || "NOT ASSIGNED"
  ).replaceAll("_", " ");
}

function assignmentPersonName(
  assignment
) {
  return (
    assignment?.rotationMember
      ?.displayName ||
    assignment?.matchKitPlayer
      ?.displayName ||
    "Unknown player"
  );
}

function assignmentTeamName(
  assignment
) {
  return (
    assignment?.matchKitPlayer
      ?.team?.name ||
    assignment?.team?.name ||
    "Playing team"
  );
}

function pickupLabel(status) {
  switch (status) {
    case "TOOK_KIT":
      return "Kit holder recorded";
    case "DID_NOT_TAKE_KIT":
      return "Nobody took the kit";
    default:
      return "Not recorded yet";
  }
}

function teamHolderName(holder) {
  return (
    holder?.holderName ||
    holder?.actualDisplayName ||
    holder?.actualRotationMember?.displayName ||
    holder?.actualMatchKitPlayer?.displayName ||
    "Not recorded yet"
  );
}

const COMPLETED_MATCH_STATUSES = new Set([
  "COMPLETED",
  "COMPLETED_LOCKED",
  "COMPLETED_CORRECTED",
]);

function normalizeMatchStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function canRecordKitPickup(match) {
  return COMPLETED_MATCH_STATUSES.has(
    normalizeMatchStatus(match?.status)
  );
}

function previousMatchLabel(holder) {
  if (holder?.previousMatchName) {
    return holder.previousMatchName;
  }

  const teamAName =
    holder?.previousMatch?.teamA?.name;

  const teamBName =
    holder?.previousMatch?.teamB?.name;

  if (teamAName && teamBName) {
    return `${teamAName} vs ${teamBName}`;
  }

  return "";
}

function kitStatusLabel(status) {
  switch (
    String(status || "")
      .trim()
      .toUpperCase()
  ) {
    case "AWAITING_COORDINATION":
      return "Awaiting coordination";
    case "HANDOVER_CONFIRMED":
      return "Handover confirmed";
    case "AT_VENUE":
      return "Kit confirmed at venue";
    case "WITH_HOLDER":
      return "With current holder";
    case "UNASSIGNED":
      return "Holder not recorded";
    default:
      return statusLabel(status);
  }
}

function handoverStatusLabel(status) {
  switch (
    String(status || "")
      .trim()
      .toUpperCase()
  ) {
    case "NOT_REQUIRED":
      return "Not required";
    case "PENDING":
      return "Pending";
    case "COORDINATED":
      return "Coordinated";
    case "HANDED_OVER":
      return "Handed over";
    default:
      return statusLabel(status);
  }
}


function kitEventLabel(eventType) {
  switch (
    String(eventType || "")
      .trim()
      .toUpperCase()
  ) {
    case "COORDINATION_CONFIRMED":
      return "Coordination confirmed";
    case "HANDOVER_CONFIRMED":
      return "Kit handed over";
    case "VENUE_CONFIRMED":
      return "Kit arrived at venue";
    case "STATUS_RESET":
      return "Status reset";
    case "CUSTODY_TRANSFERRED":
      return "Custody transferred";
    case "CUSTODY_NOT_TRANSFERRED":
      return "Custody not transferred";
    case "ASSIGNMENT_CREATED":
      return "Carrier assigned";
    case "ASSIGNMENT_CHANGED":
      return "Carrier changed";
    default:
      return statusLabel(
        eventType
      );
  }
}

function kitEventIcon(eventType) {
  switch (
    String(eventType || "")
      .trim()
      .toUpperCase()
  ) {
    case "VENUE_CONFIRMED":
      return "📍";
    case "CUSTODY_TRANSFERRED":
      return "🔄";
    case "CUSTODY_NOT_TRANSFERRED":
      return "⚠️";
    case "HANDOVER_CONFIRMED":
      return "🤝";
    case "COORDINATION_CONFIRMED":
      return "📞";
    case "STATUS_RESET":
      return "↩️";
    default:
      return "🏏";
  }
}

function MobileKitSection({
  icon,
  eyebrow,
  title,
  summary,
  badge = "",
  defaultOpen = false,
  children,
}) {
  const [isMobile, setIsMobile] =
    useState(false);

  useEffect(() => {
    const mediaQuery =
      window.matchMedia(
        "(max-width: 700px)"
      );

    const updateMobileState =
      () =>
        setIsMobile(
          mediaQuery.matches
        );

    updateMobileState();

    mediaQuery.addEventListener?.(
      "change",
      updateMobileState
    );

    return () =>
      mediaQuery.removeEventListener?.(
        "change",
        updateMobileState
      );
  }, []);

  if (!isMobile) {
    return children;
  }

  return (
    <details
      className="mobile-kit-section"
      open={defaultOpen}
    >
      <summary className="mobile-kit-section-summary">
        <span
          className="mobile-kit-section-icon"
          aria-hidden="true"
        >
          {icon}
        </span>

        <span className="mobile-kit-section-copy">
          {eyebrow && (
            <small>
              {eyebrow}
            </small>
          )}

          <strong>
            {title}
          </strong>

          {summary && (
            <span>
              {summary}
            </span>
          )}
        </span>

        <span className="mobile-kit-section-side">
          {badge && (
            <b>
              {badge}
            </b>
          )}

          <i
            aria-hidden="true"
          />
        </span>
      </summary>

      <div className="mobile-kit-section-body">
        {children}
      </div>
    </details>
  );
}

export default function KitAssignmentPanel({
  matchId,
  refreshKey = 0,
  forceSharedKit = false,
  onMessage,
  onError,
}) {
  const onMessageRef =
    useRef(onMessage);

  const onErrorRef =
    useRef(onError);

  useEffect(() => {
    onMessageRef.current =
      onMessage;
  }, [onMessage]);

  useEffect(() => {
    onErrorRef.current =
      onError;
  }, [onError]);

  const [
    assignments,
    setAssignments,
  ] = useState([]);

  const [
    match,
    setMatch,
  ] = useState(null);

  const [
    leagueKit,
    setLeagueKit,
  ] = useState(null);

  const [
    currentHolder,
    setCurrentHolder,
  ] = useState(null);

  const [
    previousHolder,
    setPreviousHolder,
  ] = useState(null);

  const [
    teamCurrentHolders,
    setTeamCurrentHolders,
  ] = useState([]);

  const [
    savedPlayerCount,
    setSavedPlayerCount,
  ] = useState(0);

  const [
    savedPlayerCounts,
    setSavedPlayerCounts,
  ] = useState({
    total: 0,
    teamA: 0,
    teamB: 0,
  });

  const [
    eligiblePlayers,
    setEligiblePlayers,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    suggesting,
    setSuggesting,
  ] = useState(false);

  const [
    pickupAssignment,
    setPickupAssignment,
  ] = useState(null);

  const [
    pickupStatus,
    setPickupStatus,
  ] = useState("PENDING");

  const [
    actualCarrierMatchPlayerId,
    setActualCarrierMatchPlayerId,
  ] = useState("");

  const [
    actualCarrierName,
    setActualCarrierName,
  ] = useState("");

  const [
    isSavingPickup,
    setIsSavingPickup,
  ] = useState(false);

  const [
    pickupError,
    setPickupError,
  ] = useState("");

  const [
    updatingKitStatus,
    setUpdatingKitStatus,
  ] = useState("");

  const [
    kitStatusError,
    setKitStatusError,
  ] = useState("");

  const [
    kitHistory,
    setKitHistory,
  ] = useState([]);

  const [
    historyLoading,
    setHistoryLoading,
  ] = useState(false);

  const [
    historyError,
    setHistoryError,
  ] = useState("");

  const [
    kitAnalytics,
    setKitAnalytics,
  ] = useState(null);

  const loadAssignments =
    useCallback(async () => {
      if (!matchId) {
        setAssignments([]);
        setMatch(null);
        setLeagueKit(null);
        setCurrentHolder(null);
        setPreviousHolder(null);
        setTeamCurrentHolders([]);
        setSavedPlayerCount(0);
        setSavedPlayerCounts({
          total: 0,
          teamA: 0,
          teamB: 0,
        });
        setEligiblePlayers([]);
        setKitHistory([]);
        setKitAnalytics(null);
        setHistoryError("");
        return;
      }

      setAssignments([]);
      setEligiblePlayers([]);
      setMatch(null);
      setLeagueKit(null);
      setCurrentHolder(null);
      setPreviousHolder(null);
      setTeamCurrentHolders([]);
      setSavedPlayerCount(0);
      setSavedPlayerCounts({
        total: 0,
        teamA: 0,
        teamB: 0,
      });
      setKitHistory([]);
      setKitAnalytics(null);
      setHistoryError("");

      setLoading(true);

      try {
        const response =
          await fetch(
            `/api/matches/${matchId}/kit-assignments`,
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to load kit assignments."
          );
        }

        setAssignments(
          Array.isArray(
            data.assignments
          )
            ? data.assignments
            : []
        );

        setMatch(
          data.match || null
        );

        setLeagueKit(
          data.leagueKit || null
        );

        setCurrentHolder(
          data.currentHolder ||
            null
        );

        setPreviousHolder(
          data.previousHolder ||
            null
        );

        setTeamCurrentHolders(
          Array.isArray(
            data.teamCurrentHolders
          )
            ? data.teamCurrentHolders
            : []
        );

        setSavedPlayerCount(
          Number(
            data.savedPlayerCount ||
              0
          )
        );

        setSavedPlayerCounts({
          total: Number(
            data?.savedPlayerCounts
              ?.total || 0
          ),
          teamA: Number(
            data?.savedPlayerCounts
              ?.teamA || 0
          ),
          teamB: Number(
            data?.savedPlayerCounts
              ?.teamB || 0
          ),
        });

        setEligiblePlayers(
          Array.isArray(
            data.eligiblePlayers
          )
            ? data.eligiblePlayers
            : []
        );
      } catch (error) {
        onErrorRef.current?.(
          error?.message ||
            "Unable to load kit assignments."
        );
      } finally {
        setLoading(false);
      }
    }, [matchId]);

  const loadKitHistory =
    useCallback(async () => {
      if (!matchId) {
        setKitHistory([]);
        return;
      }

      setHistoryLoading(true);
      setHistoryError("");

      try {
        const response =
          await fetch(
            `/api/matches/${matchId}/league-kit/history?limit=30`,
            {
              method:
                "GET",

              cache:
                "no-store",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to load league-kit history."
          );
        }

        setKitHistory(
          Array.isArray(
            data.history
          )
            ? data.history
            : []
        );

        setKitAnalytics(
          data.analytics ||
            null
        );
      } catch (error) {
        setHistoryError(
          error?.message ||
            "Unable to load league-kit history."
        );
      } finally {
        setHistoryLoading(false);
      }
    }, [matchId]);

  useEffect(() => {
    loadAssignments();
    loadKitHistory();
  }, [
    loadAssignments,
    refreshKey,
    loadKitHistory,
  ]);

  async function generateSuggestions({
    suggestNext = false,
  } = {}) {
    if (!matchId || !match) {
      return;
    }

    const sharedKit =
      forceSharedKit === true ||
      match.sharedKit === true ||
      match.kitRotationMode ===
        "LEAGUE_PLAYER";

    const targetTeamIds = [];

    if (!sharedKit) {
      if (
        savedPlayerCounts
          .teamA > 0 &&
        match?.teamA?.id
      ) {
        targetTeamIds.push(
          match.teamA.id
        );
      }

      if (
        savedPlayerCounts
          .teamB > 0 &&
        match?.teamB?.id
      ) {
        targetTeamIds.push(
          match.teamB.id
        );
      }
    }

    if (
      sharedKit &&
      savedPlayerCount === 0
    ) {
      onErrorRef.current?.(
        "Save at least one eligible player across the two teams before generating the league-kit assignment."
      );
      return;
    }

    if (
      !sharedKit &&
      targetTeamIds.length === 0
    ) {
      onErrorRef.current?.(
        "Save at least one team roster before generating a kit assignment."
      );
      return;
    }

    setSuggesting(true);
    onErrorRef.current?.("");
    onMessageRef.current?.("");

    try {
      const requests =
        sharedKit
          ? [
              {
                suggestNext,
                sharedKit:
                  true,
              },
            ]
          : targetTeamIds.map(
              (teamId) => ({
                suggestNext,
                teamId,
              })
            );

      const messages = [];

      for (
        const requestBody
        of requests
      ) {
        const response =
          await fetch(
            `/api/matches/${matchId}/kit-assignments/suggest`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify(
                  requestBody
                ),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to generate kit suggestions."
          );
        }

        if (data?.message) {
          messages.push(
            data.message
          );
        }
      }

      onMessageRef.current?.(
        messages[0] ||
          (sharedKit
            ? "League-kit carrier suggested."
            : "Kit suggestions generated.")
      );

      await loadAssignments();
      await loadKitHistory();
    } catch (error) {
      onErrorRef.current?.(
        error?.message ||
          "Unable to generate kit suggestions."
      );
    } finally {
      setSuggesting(false);
    }
  }

  function availablePlayersForAssignment(
    assignment
  ) {
    if (!assignment) {
      return [];
    }

    if (
      forceSharedKit ===
        true ||
      match?.sharedKit ===
        true ||
      match?.kitRotationMode ===
        "LEAGUE_PLAYER"
    ) {
      return eligiblePlayers;
    }

    return eligiblePlayers.filter(
      (player) =>
        Number(player.teamId) ===
        Number(
          assignment.teamId
        )
    );
  }

  function openPickupDialog(
    assignment
  ) {
    if (!pickupRecordingAllowed) {
      const message =
        "Complete the match before recording kit custody.";

      setPickupError(message);
      onErrorRef.current?.(message);
      return;
    }

    setPickupAssignment(
      assignment
    );

    setPickupStatus(
      assignment?.pickupStatus ||
        "PENDING"
    );

    setActualCarrierMatchPlayerId(
      assignment
        ?.actualMatchKitPlayerId
        ? String(
            assignment
              .actualMatchKitPlayerId
          )
        : ""
    );

    setActualCarrierName(
      assignment
        ?.actualDisplayName ||
        ""
    );

    setPickupError("");
  }

  function closePickupDialog() {
    if (isSavingPickup) {
      return;
    }

    setPickupAssignment(null);
    setPickupStatus(
      "PENDING"
    );
    setActualCarrierMatchPlayerId(
      ""
    );
    setActualCarrierName(
      ""
    );
    setPickupError("");
  }

  function chooseAssignedPlayer() {
    if (!pickupAssignment) {
      return;
    }

    const assignedName =
      assignmentPersonName(
        pickupAssignment
      );

    const possiblePlayers =
      availablePlayersForAssignment(
        pickupAssignment
      );

    const matchingPlayer =
      possiblePlayers.find(
        (player) =>
          Number(player.id) ===
            Number(
              pickupAssignment
                .matchKitPlayerId
            ) ||
          (player.normalizedName &&
            player.normalizedName ===
              pickupAssignment
                .rotationMember
                ?.normalizedName)
      );

    setPickupStatus(
      "TOOK_KIT"
    );

    setActualCarrierMatchPlayerId(
      matchingPlayer?.id
        ? String(
            matchingPlayer.id
          )
        : ""
    );

    setActualCarrierName(
      assignedName
    );

    setPickupError("");
  }

  function handlePlayerSelection(
    event
  ) {
    const selectedId =
      event.target.value;

    setActualCarrierMatchPlayerId(
      selectedId
    );

    const player =
      eligiblePlayers.find(
        (item) =>
          String(item.id) ===
          String(selectedId)
      );

    if (player) {
      setPickupStatus(
        "TOOK_KIT"
      );

      setActualCarrierName(
        player.displayName ||
          ""
      );
    }

    setPickupError("");
  }

  async function saveKitPickup() {
    if (!pickupRecordingAllowed) {
      setPickupError(
        "Kit pickup can only be recorded after the match is completed."
      );
      return;
    }

    if (
      !pickupAssignment?.id ||
      !matchId
    ) {
      setPickupError(
        "No kit assignment was selected."
      );
      return;
    }

    if (
    ![
      "TOOK_KIT",
      "DID_NOT_TAKE_KIT",
    ].includes(pickupStatus)
  ) {
    setPickupError(
      "Select what happened to the kit after the match."
    );
    return;
  }

  if (
    pickupStatus === "TOOK_KIT" &&
    !actualCarrierName.trim()
  ) {
    setPickupError(
      "Enter the name of the person who actually took the kit."
    );
    return;
  }

  setIsSavingPickup(true);
  setPickupError("");
  onErrorRef.current?.("");
  onMessageRef.current?.("");

  try {
    const response = await fetch(
      `/api/kit-assignments/${pickupAssignment.id}/pickup`,
      {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          pickupStatus,

          actualRotationMemberId:
            pickupStatus === "TOOK_KIT" &&
            pickupAssignment
              ?.rotationMember?.id
              ? Number(
                  pickupAssignment
                    .rotationMember.id
                )
              : null,

          actualMatchKitPlayerId:
            pickupStatus === "TOOK_KIT" &&
            actualCarrierMatchPlayerId
              ? Number(
                  actualCarrierMatchPlayerId
                )
              : null,

          actualDisplayName:
            pickupStatus === "TOOK_KIT"
              ? actualCarrierName.trim()
              : null,
        }),
      }
    );

    const responseText =
      await response.text();

    let data = {};

    try {
      data = responseText
        ? JSON.parse(responseText)
        : {};
    } catch {
      throw new Error(
        response.ok
          ? "The server returned an invalid response."
          : `Unable to save kit custody. Server returned HTTP ${response.status}.`
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
          `Unable to record kit pickup. HTTP ${response.status}.`
      );
    }

    onMessageRef.current?.(
      data?.message ||
        "Kit custody recorded successfully."
    );

    setPickupAssignment(null);
    setPickupStatus("PENDING");
    setActualCarrierMatchPlayerId("");
    setActualCarrierName("");
    setPickupError("");

    await loadAssignments();
    await loadKitHistory();
  } catch (error) {
    setPickupError(
      error?.message ||
        "Unable to record kit pickup."
    );
  } finally {
    setIsSavingPickup(false);
  }
}

  async function updateLeagueKitStatus(
    action
  ) {
    if (
      !matchId ||
      !sharedKit ||
      !leagueKit
    ) {
      return;
    }

    setUpdatingKitStatus(
      action
    );
    setKitStatusError("");
    onErrorRef.current?.("");
    onMessageRef.current?.("");

    try {
      const response =
        await fetch(
          `/api/matches/${matchId}/league-kit/status`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to update the league-kit status."
        );
      }

      onMessageRef.current?.(
        data?.message ||
          "League-kit status updated."
      );

      await loadAssignments();
      await loadKitHistory();
    } catch (error) {
      const message =
        error?.message ||
        "Unable to update the league-kit status.";

      setKitStatusError(
        message
      );

      onErrorRef.current?.(
        message
      );
    } finally {
      setUpdatingKitStatus(
        ""
      );
    }
  }

  const hasAssignments =
    assignments.length > 0;

  const canSuggest =
    savedPlayerCount > 0 &&
    !loading &&
    !suggesting;

  const sharedKit =
    forceSharedKit === true ||
    match?.sharedKit === true ||
    match?.kitRotationMode ===
      "LEAGUE_PLAYER";

  const pickupRecordingAllowed =
    canRecordKitPickup(match);

  const sharedAssignment =
    sharedKit
      ? assignments[0] ||
        null
      : null;

      
  return (
    <section className="kit-assignment-panel">
      <div className="kit-assignment-panel-heading">
        <div>
          <span className="kit-section-kicker">
            {sharedKit
              ? "One shared league kit"
              : "Fair rotation"}
          </span>

          <h3>
            {sharedKit
              ? "🏏 League Kit Management"
              : "🎒 Suggested Kit Carriers"}
          </h3>

          <p>
            {sharedKit
              ? "Both playing teams use the same physical kit. Cric4All separately tracks the current holder, the person responsible for this match, and the person who actually takes the kit home afterward."
              : "Cric4All tracks the person who was assigned and the person who actually took the kit after the match."}
          </p>
        </div>

        {match?.kitRotationMode && (
          <p className="kit-assignment-context-text">
            {sharedKit
              ? "One shared-kit custody record"
              : match
                    .kitRotationMode ===
                  "LEAGUE_PLAYER"
                ? "Person-level rotation history"
                : "Team-level rotation history"}
          </p>
        )}
      </div>

      {!matchId ? (
        <div className="kit-info-message">
          Select a match to view kit assignments.
        </div>
      ) : loading ? (
        <div className="kit-info-message">
          Loading kit assignments...
        </div>
      ) : (
        <>
          {!sharedKit &&
            teamCurrentHolders.length > 0 && (
              <section className="kit-current-custody-card">
                <div className="kit-current-custody-heading">
                  <span className="kit-section-kicker">
                    Current physical custody
                  </span>

                  <h4>
                    🎒 Who currently has each team kit
                  </h4>

                  <p>
                    These holders were recorded after the
                    latest previous match. Confirm today&apos;s
                    playing rosters before generating the next
                    kit responsibilities.
                  </p>
                </div>

                <div className="kit-current-custody-grid">
                  {teamCurrentHolders.map(
                    (holder) => {
                      const matchLabel =
                        previousMatchLabel(
                          holder
                        );

                      return (
                        <article
                          key={
                            holder.teamId
                          }
                          className="kit-current-custody-item"
                        >
                          <div className="kit-current-custody-team">
                            <span>
                              Team kit
                            </span>

                            <strong>
                              {holder.teamName ||
                                holder.team
                                  ?.name ||
                                `Team ${holder.teamId}`}
                            </strong>
                          </div>

                          <div className="kit-current-custody-holder">
                            <span
                              className="kit-person-avatar"
                              aria-hidden="true"
                            >
                              👤
                            </span>

                            <div>
                              <small>
                                Currently held by
                              </small>

                              <strong>
                                {teamHolderName(
                                  holder
                                )}
                              </strong>
                            </div>
                          </div>

                          {matchLabel && (
                            <small className="kit-current-custody-source">
                              Recorded after{" "}
                              {matchLabel}
                            </small>
                          )}

                          {holder.recordedAt && (
                            <small className="kit-current-custody-date">
                              {formatDate(
                                holder.recordedAt
                              )}
                            </small>
                          )}
                        </article>
                      );
                    }
                  )}
                </div>
              </section>
            )}

          {savedPlayerCount ===
            0 && (
            <div className="kit-info-message">
              Save at least one confirmed player before generating a suggestion.
            </div>
          )}

          <div className="kit-assignment-toolbar">
            <div>
              <strong>
                {savedPlayerCount} eligible player
                {savedPlayerCount ===
                1
                  ? ""
                  : "s"}{" "}
                saved
              </strong>

              <small>
                {sharedKit
                  ? `${savedPlayerCounts.teamA} from ${match?.teamA?.name || "Team A"} and ${savedPlayerCounts.teamB} from ${match?.teamB?.name || "Team B"} are considered together for one shared-kit assignment.`
                  : "Suggestions are generated only for teams whose player roster has been saved."}
              </small>
            </div>

            <div className="kit-assignment-toolbar-actions">
              <button
                type="button"
                className="btn kit-generate-assignment-btn"
                disabled={!canSuggest}
                onClick={() =>
                  generateSuggestions({
                    suggestNext:
                      false,
                  })
                }
              >
                {suggesting
                  ? "Generating..."
                  : hasAssignments
                    ? "↻ Recalculate"
                    : sharedKit
                      ? "✨ Suggest League Kit Carrier"
                      : "✨ Suggest Kit Carriers"}
              </button>

              {hasAssignments && (
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={!canSuggest}
                  onClick={() =>
                    generateSuggestions({
                      suggestNext:
                        true,
                    })
                  }
                >
                  ⇥ Suggest Next
                </button>
              )}
            </div>
          </div>

          {sharedKit ? (
            !sharedAssignment ? (
              <div className="kit-empty-assignments">
                <span>🏏</span>
                <strong>
                  No league-kit carrier suggested yet
                </strong>
                <p>
                  Save the confirmed player lists for the match, then suggest one responsible carrier across both teams.
                </p>
              </div>
            ) : (
              <article className="league-kit-card">
                <div className="league-kit-card-header">
                  <div>
                    <span>
                      Shared by both teams
                    </span>
                    <h4>
                      {match?.teamA?.name ||
                        "Team A"}{" "}
                      vs{" "}
                      {match?.teamB?.name ||
                        "Team B"}
                    </h4>
                  </div>

                  <span
                    className={`kit-assignment-status status-${String(
                      sharedAssignment.status ||
                        ""
                    ).toLowerCase()}`}
                  >
                    {statusLabel(
                      sharedAssignment.status
                    )}
                  </span>
                </div>

                <MobileKitSection
                  icon="🎒"
                  eyebrow="KIT RESPONSIBILITY"
                  title="Holder and match carrier"
                  summary="See who has the kit now and who must bring it."
                  badge={
                    currentHolder?.displayName
                      ? "Holder recorded"
                      : "Holder needed"
                  }
                  defaultOpen
                >
                <div className="league-kit-flow">
                  <div className="league-kit-person-block">
                    <small>
                      Current kit holder
                    </small>
                    <strong>
                      {currentHolder
                        ?.displayName ||
                        "Not recorded yet"}
                    </strong>
                    <span>
                      This is the person currently recorded as physically holding the league kit.
                    </span>
                  </div>

                  <div className="league-kit-arrow">
                    →
                  </div>

                  <div className="league-kit-person-block assigned">
                    <small>
                      Responsible for this match
                    </small>
                    <strong>
                      {assignmentPersonName(
                        sharedAssignment
                      )}
                    </strong>
                    <span>
                      {assignmentTeamName(
                        sharedAssignment
                      )}
                    </span>
                  </div>
                </div>

                <div className="league-kit-details">
                  <div>
                    <span>
                      Previous holder
                    </span>
                    <strong>
                      {previousHolder
                        ?.displayName ||
                        "Not available"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Kit status
                    </span>
                    <strong>
                      {kitStatusLabel(
                        leagueKit
                          ?.status
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Handover status
                    </span>
                    <strong>
                      {handoverStatusLabel(
                        leagueKit
                          ?.handoverStatus
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Previous kit pickups
                    </span>
                    <strong>
                      {Number(
                        sharedAssignment
                          ?.rotationMember
                          ?.completedCount ||
                          0
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Last kit pickup
                    </span>
                    <strong>
                      {formatDate(
                        sharedAssignment
                          ?.rotationMember
                          ?.lastCompletedAt
                      )}
                    </strong>
                  </div>
                </div>

                </MobileKitSection>

                <MobileKitSection
                  icon="✅"
                  eyebrow="MATCH-DAY CONTROL"
                  title="Coordination and handover"
                  summary="Update only when the kit moves through the match-day process."
                  badge={
                    kitStatusLabel(
                      leagueKit?.status
                    )
                  }
                >
                <div className="league-kit-status-actions">
                  <div className="league-kit-status-actions-heading">
                    <div>
                      <strong>
                        Match-day kit status
                      </strong>
                      <span>
                        Update coordination and venue arrival so reminders stop when no longer needed.
                      </span>
                    </div>
                  </div>

                  <div className="league-kit-status-action-grid">
                    <button
                      type="button"
                      className={
                        String(
                          leagueKit?.handoverStatus || ""
                        ).toUpperCase() ===
                        "COORDINATED"
                          ? "btn btn-outline active"
                          : "btn btn-outline"
                      }
                      disabled={
                        Boolean(
                          updatingKitStatus
                        )
                      }
                      onClick={() =>
                        updateLeagueKitStatus(
                          "COORDINATED"
                        )
                      }
                    >
                      <span
                        className="kit-status-action-icon"
                        aria-hidden="true"
                      >
                        ☎
                      </span>
                      <span className="kit-status-action-label">
                        {updatingKitStatus ===
                        "COORDINATED"
                          ? "Saving..."
                          : "Mark Coordination Confirmed"}
                      </span>
                    </button>

                    <button
                      type="button"
                      className={
                        String(
                          leagueKit?.handoverStatus || ""
                        ).toUpperCase() ===
                        "HANDED_OVER"
                          ? "btn btn-outline active"
                          : "btn btn-outline"
                      }
                      disabled={
                        Boolean(
                          updatingKitStatus
                        )
                      }
                      onClick={() =>
                        updateLeagueKitStatus(
                          "HANDED_OVER"
                        )
                      }
                    >
                      <span
                        className="kit-status-action-icon"
                        aria-hidden="true"
                      >
                        🤝
                      </span>
                      <span className="kit-status-action-label">
                        {updatingKitStatus ===
                        "HANDED_OVER"
                          ? "Saving..."
                          : "Mark Kit Handed Over"}
                      </span>
                    </button>

                    <button
                      type="button"
                      className={
                        String(
                          leagueKit?.status || ""
                        ).toUpperCase() ===
                        "AT_VENUE"
                          ? "btn kit-at-venue-btn active"
                          : "btn kit-at-venue-btn"
                      }
                      disabled={
                        Boolean(
                          updatingKitStatus
                        )
                      }
                      onClick={() =>
                        updateLeagueKitStatus(
                          "AT_VENUE"
                        )
                      }
                    >
                      <span
                        className="kit-status-action-icon"
                        aria-hidden="true"
                      >
                        📍
                      </span>
                      <span className="kit-status-action-label">
                        {updatingKitStatus ===
                        "AT_VENUE"
                          ? "Saving..."
                          : "Confirm Kit Is at the Venue"}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={
                        Boolean(
                          updatingKitStatus
                        )
                      }
                      onClick={() =>
                        updateLeagueKitStatus(
                          "RESET_COORDINATION"
                        )
                      }
                    >
                      <span
                        className="kit-status-action-icon"
                        aria-hidden="true"
                      >
                        ↺
                      </span>
                      <span className="kit-status-action-label">
                        {updatingKitStatus ===
                        "RESET_COORDINATION"
                          ? "Resetting..."
                          : "Reset Match-Day Status"}
                      </span>
                    </button>
                  </div>

                  {kitStatusError && (
                    <p className="kit-form-error">
                      {kitStatusError}
                    </p>
                  )}

                  {leagueKit?.venueConfirmedAt && (
                    <small className="kit-venue-confirmed-at">
                      Venue arrival confirmed{" "}
                      {formatDate(
                        leagueKit.venueConfirmedAt
                      )}
                    </small>
                  )}
                </div>

                <div className="league-kit-responsibility">
                  <strong>
                    Assigned-carrier responsibility
                  </strong>
                  <p>
                    Coordinate with the current holder and ensure the kit reaches the match venue before play begins. If the current holder is not playing, arrange collection and bring the kit. After the match, ensure the person taking the kit home is recorded.
                  </p>
                </div>

                {sharedAssignment.assignmentReason && (
                  <div className="kit-assignment-reason">
                    <strong>
                      Why selected
                    </strong>
                    <p>
                      {
                        sharedAssignment.assignmentReason
                      }
                    </p>
                  </div>
                )}

                </MobileKitSection>

                <MobileKitSection
                  icon="🏠"
                  eyebrow="AFTER THE MATCH"
                  title="Record final custody"
                  summary="Record who actually took the kit home after the match."
                  badge={
                    pickupLabel(
                      sharedAssignment.pickupStatus
                    )
                  }
                >
                <div className="kit-pickup-summary">
                  <div>
                    <span>
                      After-match custody
                    </span>
                    <strong>
                      {pickupLabel(
                        sharedAssignment.pickupStatus
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Actually took the kit home
                    </span>
                    <strong>
                      {sharedAssignment.pickupStatus ===
                      "TOOK_KIT"
                        ? sharedAssignment.actualDisplayName ||
                          sharedAssignment
                            .actualRotationMember
                            ?.displayName ||
                          "Name not recorded"
                        : sharedAssignment.pickupStatus ===
                            "DID_NOT_TAKE_KIT"
                          ? "Nobody"
                          : "Not recorded yet"}
                    </strong>
                  </div>

                  {sharedAssignment.pickupRecordedAt && (
                    <div>
                      <span>
                        Recorded
                      </span>
                      <strong>
                        {formatDate(
                          sharedAssignment.pickupRecordedAt
                        )}
                      </strong>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btn kit-record-pickup-btn"
                  onClick={() =>
                    openPickupDialog(
                      sharedAssignment
                    )
                  }
                >
                  {sharedAssignment.pickupStatus ===
                  "PENDING"
                    ? "Record Who Took the Kit Home"
                    : "Edit Kit Custody"}
                </button>

                </MobileKitSection>

                <MobileKitSection
                  icon="📊"
                  eyebrow="FAIR ROTATION"
                  title="Rotation fairness"
                  summary="Review assignments, completed turns, and balance."
                  badge={
                    kitAnalytics?.fairnessStatus ===
                    "BALANCED"
                      ? "Balanced"
                      : kitAnalytics?.fairnessStatus ===
                          "NEEDS_ATTENTION"
                        ? "Review"
                        : "No history"
                  }
                >
                <section className="league-kit-analytics">
                  <div className="league-kit-analytics-heading">
                    <div>
                      <strong>
                        Rotation fairness
                      </strong>
                      <span>
                        League-wide kit responsibility across players from both teams.
                      </span>
                    </div>

                    <span
                      className={`league-kit-fairness-status fairness-${String(
                        kitAnalytics?.fairnessStatus ||
                          "UNKNOWN"
                      ).toLowerCase()}`}
                    >
                      {kitAnalytics?.fairnessStatus ===
                      "BALANCED"
                        ? "Balanced"
                        : kitAnalytics?.fairnessStatus ===
                            "NEEDS_ATTENTION"
                          ? "Needs attention"
                          : "No history yet"}
                    </span>
                  </div>

                  <div className="league-kit-analytics-summary">
                    <div>
                      <span>
                        Custody transfers
                      </span>
                      <strong>
                        {Number(
                          kitAnalytics?.totalCustodyTransfers ||
                            0
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Assignments
                      </span>
                      <strong>
                        {Number(
                          kitAnalytics?.totalAssignments ||
                            0
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Rotation spread
                      </span>
                      <strong>
                        {Number(
                          kitAnalytics?.completionSpread ||
                            0
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        No custody transfer
                      </span>
                      <strong>
                        {Number(
                          kitAnalytics?.custodyNotTransferred ||
                            0
                        )}
                      </strong>
                    </div>
                  </div>

                  {Array.isArray(
                    kitAnalytics?.carriers
                  ) &&
                  kitAnalytics.carriers.length >
                    0 && (
                    <div className="league-kit-carrier-table">
                      <div className="league-kit-carrier-row header">
                        <span>
                          Player
                        </span>
                        <span>
                          Assigned
                        </span>
                        <span>
                          Took kit
                        </span>
                        <span>
                          Last pickup
                        </span>
                      </div>

                      {kitAnalytics.carriers.map(
                        (carrier) => (
                          <div
                            key={
                              carrier.rotationMemberId
                            }
                            className="league-kit-carrier-row"
                          >
                            <strong>
                              {
                                carrier.displayName
                              }
                            </strong>

                            <span>
                              {Number(
                                carrier.assignedCount ||
                                  0
                              )}
                            </span>

                            <span>
                              {Number(
                                carrier.completedCount ||
                                  0
                              )}
                            </span>

                            <span>
                              {formatDate(
                                carrier.lastCompletedAt
                              )}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </section>

                </MobileKitSection>

                <MobileKitSection
                  icon="🕘"
                  eyebrow="AUDIT TRAIL"
                  title="Kit custody history"
                  summary="See status updates and custody transfers."
                  badge={`${kitHistory.length} event${
                    kitHistory.length === 1
                      ? ""
                      : "s"
                  }`}
                >
                <section className="league-kit-history">
                  <div className="league-kit-history-heading">
                    <div>
                      <strong>
                        Kit custody timeline
                      </strong>
                      <span>
                        Coordination, handover, venue arrival, and after-match custody changes.
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={
                        loadKitHistory
                      }
                      disabled={
                        historyLoading
                      }
                    >
                      {historyLoading
                        ? "Refreshing..."
                        : "Refresh History"}
                    </button>
                  </div>

                  {historyError && (
                    <p className="kit-form-error">
                      {historyError}
                    </p>
                  )}

                  {!historyLoading &&
                  kitHistory.length === 0 ? (
                    <div className="league-kit-history-empty">
                      No kit history has been recorded yet. New status and custody changes will appear here.
                    </div>
                  ) : (
                    <div className="league-kit-timeline">
                      {kitHistory.map(
                        (event) => (
                          <article
                            key={
                              event.id
                            }
                            className="league-kit-timeline-item"
                          >
                            <span className="league-kit-timeline-icon">
                              {kitEventIcon(
                                event.eventType
                              )}
                            </span>

                            <div className="league-kit-timeline-body">
                              <div className="league-kit-timeline-title">
                                <strong>
                                  {kitEventLabel(
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
                                <div className="league-kit-timeline-transfer">
                                  <span>
                                    {event.fromHolderName ||
                                      "Not recorded"}
                                  </span>
                                  <b>→</b>
                                  <span>
                                    {event.toHolderName ||
                                      "Not recorded"}
                                  </span>
                                </div>
                              )}

                              {event.match && (
                                <small>
                                  {event.match.teamA?.name ||
                                    "Team A"}{" "}
                                  vs{" "}
                                  {event.match.teamB?.name ||
                                    "Team B"}
                                  {event.match.scheduledAt
                                    ? ` — ${formatDate(
                                        event.match.scheduledAt
                                      )}`
                                    : ""}
                                </small>
                              )}
                            </div>
                          </article>
                        )
                      )}
                    </div>
                  )}
                </section>
                </MobileKitSection>
              </article>
            )
          ) : !hasAssignments ? (
            <div className="kit-empty-assignments">
              <span>🎒</span>
              <strong>
                No kit carriers suggested yet
              </strong>
              <p>
                Save a team roster, then click Suggest Kit Carriers.
              </p>
            </div>
          ) : (
            <div className="kit-assignment-grid">
              {assignments.map(
                (assignment) => (
                  <article
                    key={
                      assignment.id
                    }
                    className="kit-assignment-card"
                  >
                    <div className="kit-assignment-card-header">
                      <div>
                        <span>
                          Playing team
                        </span>
                        <h4>
                          {assignment
                            .team
                            ?.name ||
                            `Team ${assignment.teamId}`}
                        </h4>
                      </div>

                      <span
                        className={`kit-assignment-status status-${String(
                          assignment.status ||
                            ""
                        ).toLowerCase()}`}
                      >
                        {statusLabel(
                          assignment.status
                        )}
                      </span>
                    </div>

                    <div className="kit-assigned-person">
                      <span className="kit-person-avatar">
                        👤
                      </span>
                      <div>
                        <small>
                          Assigned for this match
                        </small>
                        <strong>
                          {assignmentPersonName(
                            assignment
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="kit-pickup-summary">
                      <div>
                        <span>
                          After-match custody
                        </span>
                        <strong>
                          {pickupLabel(
                            assignment.pickupStatus
                          )}
                        </strong>
                      </div>
                    </div>

<div className="kit-pickup-action">
  <button
    type="button"
    className="btn kit-record-pickup-btn"
    onClick={() =>
      openPickupDialog(assignment)
    }
    disabled={!pickupRecordingAllowed}
    title={
      pickupRecordingAllowed
        ? assignment.pickupStatus === "PENDING"
          ? "Record who took the kit after the completed match"
          : "Edit the recorded kit pickup"
        : "Complete the match before recording kit custody"
    }
  >
    {!pickupRecordingAllowed
      ? "🔒 Complete Match First"
      : assignment.pickupStatus === "PENDING"
        ? "Record Kit Pickup"
        : "Edit Kit Pickup"}
  </button>

  {!pickupRecordingAllowed && (
    <small className="kit-pickup-disabled-note">
      Kit custody can only be recorded after the
      match is completed.
    </small>
  )}
</div>
                  </article>
                )
              )}
            </div>
          )}
        </>
      )}

      {pickupAssignment && (
        <div
          className="kit-pickup-overlay"
          onClick={
            closePickupDialog
          }
          role="presentation"
        >
          <section
            className="kit-pickup-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kit-pickup-title"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="kit-pickup-header">
              <div>
                <h3 id="kit-pickup-title">
                  {sharedKit
                    ? "Record League Kit Custody"
                    : "Record Kit Pickup"}
                </h3>
                <p>
                  Record who actually took the kit home after the match. For a shared league kit, this person becomes the current holder shown for the next match.
                </p>
              </div>

              <button
                type="button"
                className="kit-close-btn"
                onClick={
                  closePickupDialog
                }
                disabled={
                  isSavingPickup
                }
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="kit-pickup-assigned">
              <span>
                Assigned for this match
              </span>
              <strong>
                {assignmentPersonName(
                  pickupAssignment
                )}
              </strong>
            </div>

            <div className="kit-pickup-choice-grid">
              <button
                type="button"
                className={
                  pickupStatus ===
                    "TOOK_KIT" &&
                  actualCarrierName ===
                    assignmentPersonName(
                      pickupAssignment
                    )
                    ? "kit-pickup-choice active"
                    : "kit-pickup-choice"
                }
                onClick={
                  chooseAssignedPlayer
                }
              >
                <strong>
                  Assigned player took the kit home
                </strong>
                <span>
                  {assignmentPersonName(
                    pickupAssignment
                  )}
                </span>
              </button>

              <button
                type="button"
                className={
                  pickupStatus ===
                  "TOOK_KIT"
                    ? "kit-pickup-choice active"
                    : "kit-pickup-choice"
                }
                onClick={() => {
                  setPickupStatus(
                    "TOOK_KIT"
                  );
                  setPickupError("");
                }}
              >
                <strong>
                  Someone else took the kit home
                </strong>
                <span>
                  Select a player from either team or type the correct name.
                </span>
              </button>

              <button
                type="button"
                className={
                  pickupStatus ===
                  "DID_NOT_TAKE_KIT"
                    ? "kit-pickup-choice active"
                    : "kit-pickup-choice"
                }
                onClick={() => {
                  setPickupStatus(
                    "DID_NOT_TAKE_KIT"
                  );
                  setActualCarrierMatchPlayerId(
                    ""
                  );
                  setActualCarrierName(
                    ""
                  );
                  setPickupError("");
                }}
              >
                <strong>
                  Nobody took the kit
                </strong>
                <span>
                  Record that custody was not transferred after this match.
                </span>
              </button>
            </div>

            {pickupStatus ===
              "TOOK_KIT" && (
              <div className="kit-actual-carrier-fields">
                <label>
                  <span>
                    Select eligible player
                  </span>
                  <select
                    value={
                      actualCarrierMatchPlayerId
                    }
                    onChange={
                      handlePlayerSelection
                    }
                  >
                    <option value="">
                      Select a player or type below
                    </option>
                    {availablePlayersForAssignment(
                      pickupAssignment
                    ).map(
                      (player) => (
                        <option
                          key={
                            player.id
                          }
                          value={
                            player.id
                          }
                        >
                          {
                            player.displayName
                          }
                          {player
                            ?.team
                            ?.name
                            ? ` — ${player.team.name}`
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  <span>
                    Person who actually took the kit home
                  </span>
                  <input
                    type="text"
                    value={
                      actualCarrierName
                    }
                    placeholder="Enter or correct the name"
                    onChange={(
                      event
                    ) => {
                      setActualCarrierName(
                        event.target.value
                      );
                      setPickupStatus(
                        "TOOK_KIT"
                      );
                      setPickupError(
                        ""
                      );
                    }}
                  />
                  <small>
                    This person receives rotation credit and becomes the current league-kit holder for the next match.
                  </small>
                </label>
              </div>
            )}

            {pickupError && (
              <p className="kit-form-error">
                {pickupError}
              </p>
            )}

            <div className="kit-pickup-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={
                  closePickupDialog
                }
                disabled={
                  isSavingPickup
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn kit-record-pickup-btn"
                onClick={
                  saveKitPickup
                }
                disabled={
                  isSavingPickup
                }
              >
                {isSavingPickup
                  ? "Saving..."
                  : "Save Kit Custody"}
              </button>
            </div>
          </section>
        </div>
      )}

      <style jsx global>{`
        .kit-current-custody-card {
          display: grid;
          gap: 14px;
          margin-bottom: 18px;
          padding: 18px;
          border: 1px solid rgba(56, 189, 248, 0.28);
          border-radius: 18px;
          background:
            linear-gradient(
              135deg,
              rgba(14, 165, 233, 0.09),
              rgba(15, 23, 42, 0.18)
            );
        }

        .kit-current-custody-heading h4 {
          margin: 4px 0 6px;
          font-size: 1.08rem;
        }

        .kit-current-custody-heading p {
          margin: 0;
          opacity: 0.78;
          line-height: 1.55;
        }

        .kit-current-custody-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .kit-current-custody-item {
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-width: 0;
          padding: 16px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          border-radius: 16px;
          background: var(--card-bg, rgba(15, 23, 42, 0.7));
        }

        .kit-current-custody-team {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .kit-current-custody-team span,
        .kit-current-custody-holder small,
        .kit-current-custody-source,
        .kit-current-custody-date {
          opacity: 0.72;
        }

        .kit-current-custody-team strong,
        .kit-current-custody-holder strong {
          font-size: 1.05rem;
          overflow-wrap: anywhere;
        }

        .kit-current-custody-holder {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .kit-current-custody-holder > div {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .kit-current-custody-source,
        .kit-current-custody-date {
          display: block;
          font-size: 0.78rem;
        }

        @media (max-width: 720px) {
          .kit-current-custody-grid {
            grid-template-columns: 1fr;
          }

          .kit-current-custody-card {
            padding: 14px;
          }
        }

        .league-kit-card {
          display: grid;
          gap: 16px;
          padding: 18px;
          border: 1px solid rgba(148, 163, 184, 0.45);
          border-radius: 16px;
          background: var(--card-bg, #ffffff);
        }

        .league-kit-card-header,
        .kit-assignment-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }

        .league-kit-card-header span,
        .kit-assignment-card-header span {
          font-size: 0.82rem;
          opacity: 0.72;
        }

        .league-kit-card-header h4,
        .kit-assignment-card-header h4 {
          margin: 4px 0 0;
        }

        .league-kit-flow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: stretch;
          gap: 12px;
        }

        .league-kit-person-block {
          display: grid;
          gap: 6px;
          padding: 15px;
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.05);
        }

        .league-kit-person-block.assigned {
          background: rgba(37, 99, 235, 0.08);
        }

        .league-kit-person-block small {
          opacity: 0.7;
        }

        .league-kit-person-block strong {
          font-size: 1.08rem;
        }

        .league-kit-person-block span {
          font-size: 0.86rem;
          opacity: 0.74;
        }

        .league-kit-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.4rem;
          opacity: 0.62;
        }

        .league-kit-details {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .league-kit-details > div,
        .kit-pickup-summary > div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 11px 12px;
          border-radius: 11px;
          background: rgba(15, 23, 42, 0.04);
        }

        .league-kit-details span,
        .kit-pickup-summary span {
          opacity: 0.72;
        }

        .league-kit-status-actions {
          display: grid;
          gap: 12px;
          padding: 14px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.38);
          background: rgba(15, 23, 42, 0.025);
        }

        .league-kit-status-actions-heading {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .league-kit-status-actions-heading > div {
          display: grid;
          gap: 4px;
        }

        .league-kit-status-actions-heading span {
          font-size: 0.86rem;
          opacity: 0.72;
        }

        .league-kit-status-action-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .league-kit-status-action-grid .btn {
          width: 100%;
          min-height: 44px;
        }

        .league-kit-status-action-grid .active {
          border-width: 2px;
          font-weight: 700;
        }

        .kit-at-venue-btn {
          background: rgba(22, 163, 74, 0.12);
          border: 1px solid rgba(22, 163, 74, 0.45);
        }

        .kit-venue-confirmed-at {
          opacity: 0.72;
        }

        .league-kit-responsibility,
        .kit-assignment-reason {
          padding: 13px;
          border-radius: 12px;
          background: rgba(245, 158, 11, 0.1);
        }

        .league-kit-responsibility p,
        .kit-assignment-reason p {
          margin: 6px 0 0;
          line-height: 1.55;
        }

        .kit-pickup-summary {
          display: grid;
          gap: 8px;
        }

        .kit-record-pickup-btn {
          width: 100%;
        }

        .league-kit-analytics {
          display: grid;
          gap: 14px;
          margin-top: 4px;
          padding: 15px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(37, 99, 235, 0.035);
        }

        .league-kit-analytics-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .league-kit-analytics-heading > div {
          display: grid;
          gap: 4px;
        }

        .league-kit-analytics-heading span {
          font-size: 0.86rem;
          opacity: 0.72;
        }

        .league-kit-fairness-status {
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 700;
          white-space: nowrap;
        }

        .fairness-balanced {
          background: rgba(22, 163, 74, 0.12);
          color: #166534;
        }

        .fairness-needs_attention {
          background: rgba(220, 38, 38, 0.1);
          color: #991b1b;
        }

        .fairness-unknown {
          background: rgba(100, 116, 139, 0.12);
        }

        .league-kit-analytics-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .league-kit-analytics-summary > div {
          display: grid;
          gap: 4px;
          padding: 12px;
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.6);
        }

        .league-kit-analytics-summary span {
          font-size: 0.78rem;
          opacity: 0.72;
        }

        .league-kit-analytics-summary strong {
          font-size: 1.1rem;
        }

        .league-kit-carrier-table {
          overflow-x: auto;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 12px;
        }

        .league-kit-carrier-row {
          display: grid;
          grid-template-columns:
            minmax(150px, 1.5fr)
            minmax(75px, 0.55fr)
            minmax(75px, 0.55fr)
            minmax(150px, 1fr);
          gap: 10px;
          align-items: center;
          min-width: 540px;
          padding: 10px 12px;
          border-top: 1px solid rgba(148, 163, 184, 0.24);
        }

        .league-kit-carrier-row:first-child {
          border-top: 0;
        }

        .league-kit-carrier-row.header {
          font-size: 0.78rem;
          font-weight: 700;
          background: rgba(15, 23, 42, 0.05);
        }

        .league-kit-history {
          display: grid;
          gap: 14px;
          margin-top: 4px;
          padding-top: 16px;
          border-top: 1px solid rgba(148, 163, 184, 0.35);
        }

        .league-kit-history-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .league-kit-history-heading > div {
          display: grid;
          gap: 4px;
        }

        .league-kit-history-heading span {
          font-size: 0.86rem;
          opacity: 0.72;
        }

        .league-kit-history-empty {
          padding: 14px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.04);
          opacity: 0.78;
        }

        .league-kit-timeline {
          display: grid;
          gap: 12px;
        }

        .league-kit-timeline-item {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 12px;
          padding: 13px;
          border-radius: 13px;
          border: 1px solid rgba(148, 163, 184, 0.32);
          background: rgba(15, 23, 42, 0.025);
        }

        .league-kit-timeline-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(37, 99, 235, 0.09);
          font-size: 1.05rem;
        }

        .league-kit-timeline-body {
          display: grid;
          gap: 7px;
        }

        .league-kit-timeline-title {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .league-kit-timeline-title time,
        .league-kit-timeline-body small {
          font-size: 0.78rem;
          opacity: 0.68;
        }

        .league-kit-timeline-body p {
          margin: 0;
          line-height: 1.45;
        }

        .league-kit-timeline-transfer {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          font-size: 0.9rem;
        }

        .kit-pickup-overlay {
          position: fixed;
          inset: 0;
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(0, 0, 0, 0.62);
        }

        .kit-pickup-dialog {
          width: min(100%, 620px);
          max-height: 90vh;
          overflow-y: auto;
          border-radius: 16px;
          padding: 20px;
          background: var(--card-bg, #ffffff);
          color: var(--text-color, #111827);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .kit-pickup-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }

        .kit-pickup-header h3,
        .kit-pickup-header p {
          margin: 0;
        }

        .kit-pickup-header p {
          margin-top: 6px;
          opacity: 0.72;
        }

        .kit-close-btn {
          border: 0;
          background: transparent;
          color: inherit;
          font-size: 28px;
          line-height: 1;
          cursor: pointer;
        }

        .kit-pickup-assigned {
          display: grid;
          gap: 4px;
          margin: 18px 0;
          padding: 14px;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.05);
        }

        .kit-pickup-choice-grid {
          display: grid;
          gap: 10px;
        }

        .kit-pickup-choice {
          display: grid;
          gap: 4px;
          width: 100%;
          padding: 14px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }

        .kit-pickup-choice.active {
          border-width: 2px;
          background: rgba(0, 0, 0, 0.06);
        }

        .kit-actual-carrier-fields {
          display: grid;
          gap: 14px;
          margin-top: 18px;
        }

        .kit-actual-carrier-fields label {
          display: grid;
          gap: 7px;
        }

        .kit-actual-carrier-fields input,
        .kit-actual-carrier-fields select {
          width: 100%;
          min-height: 44px;
          box-sizing: border-box;
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: var(--card-bg, #ffffff);
          color: var(--text-color, #111827);
          font: inherit;
        }

        .kit-pickup-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }

        .kit-form-error {
          margin: 14px 0 0;
          color: #b91c1c;
        }

        .kit-pickup-action {
  display: grid;
  gap: 8px;
}

.kit-record-pickup-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  filter: grayscale(0.25);
  box-shadow: none;
}

.kit-pickup-disabled-note {
  display: block;
  padding: 0 4px;
  color: #fbbf24;
  font-size: 0.78rem;
  line-height: 1.4;
  text-align: center;
}

        @media (max-width: 700px) {
          .league-kit-flow {
            grid-template-columns: 1fr;
          }

          .league-kit-arrow {
            transform: rotate(90deg);
          }

          .league-kit-details {
            grid-template-columns: 1fr;
          }

          .league-kit-status-action-grid {
            grid-template-columns: 1fr;
          }

          .league-kit-history-heading,
          .league-kit-timeline-title {
            display: grid;
          }

          .league-kit-analytics-heading {
            display: grid;
          }

          .league-kit-analytics-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .kit-pickup-dialog {
            padding: 16px;
          }

          .kit-pickup-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .league-kit-details > div,
          .kit-pickup-summary > div {
            display: grid;
            gap: 3px;
          }
        }
        /* =========================================================
           MOBILE COMPACT MODE
           Condenses shared-kit management into a focused control deck.
           ========================================================= */
        @media (max-width: 700px) {
          .kit-assignment-panel {
            display: grid;
            gap: 9px;
            margin-top: 10px;
            padding: 0 !important;
            color: #e5eefc;
          }

          .kit-assignment-panel-heading {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 8px !important;
            padding: 10px 11px !important;
            border: 1px solid rgba(125, 211, 252, 0.24);
            border-radius: 14px;
            background:
              linear-gradient(
                135deg,
                rgba(14, 165, 233, 0.12),
                rgba(99, 102, 241, 0.08)
              );
          }

          .kit-assignment-panel-heading h3 {
            margin: 2px 0 0 !important;
            font-size: 0.92rem !important;
          }

          .kit-assignment-panel-heading p {
            display: none !important;
          }

          .kit-assignment-mode {
            flex: 0 0 auto;
            max-width: 105px;
            padding: 5px 8px !important;
            font-size: 0.62rem !important;
            line-height: 1.2;
            text-align: center;
          }

          .kit-assignment-toolbar {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center !important;
            gap: 8px !important;
            padding: 10px !important;
            border-radius: 14px !important;
          }

          .kit-assignment-toolbar strong {
            font-size: 0.8rem !important;
          }

          .kit-assignment-toolbar small {
            display: none !important;
          }

          .kit-assignment-toolbar-actions {
            display: flex !important;
            gap: 6px !important;
          }

          .kit-assignment-toolbar-actions .btn {
            width: auto !important;
            min-height: 36px !important;
            padding: 7px 9px !important;
            font-size: 0.64rem !important;
            white-space: nowrap;
          }

          .league-kit-card,
          .kit-assignment-card,
          .kit-current-custody-card,
          .league-kit-analytics,
          .league-kit-timeline-item,
          .league-kit-history-empty {
            color: #e5eefc !important;
            border-color: rgba(148, 163, 184, 0.2) !important;
            background:
              linear-gradient(
                145deg,
                rgba(9, 18, 35, 0.97),
                rgba(15, 29, 52, 0.96)
              ) !important;
          }

          .league-kit-card {
            gap: 10px !important;
            padding: 11px !important;
            border-radius: 16px !important;
            box-shadow: 0 16px 36px rgba(2, 6, 23, 0.32);
          }

          .league-kit-card-header {
            align-items: center !important;
            gap: 8px !important;
          }

          .league-kit-card-header h4 {
            margin: 2px 0 0 !important;
            font-size: 0.9rem !important;
          }

          .kit-assignment-status {
            padding: 5px 7px !important;
            font-size: 0.6rem !important;
          }

          .league-kit-flow {
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) !important;
            gap: 7px !important;
            align-items: stretch !important;
          }

          .league-kit-person-block {
            min-height: 78px;
            padding: 9px !important;
            border-radius: 12px !important;
          }

          .league-kit-person-block small,
          .league-kit-person-block span {
            font-size: 0.62rem !important;
            line-height: 1.25;
          }

          .league-kit-person-block > span {
            display: none !important;
          }

          .league-kit-person-block strong {
            overflow: hidden;
            font-size: 0.82rem !important;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .league-kit-arrow {
            align-self: center;
            transform: none !important;
            font-size: 0.9rem !important;
          }

          .league-kit-details {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 6px !important;
          }

          .league-kit-details > div,
          .kit-pickup-summary > div {
            min-height: 52px;
            padding: 8px !important;
            border-radius: 10px !important;
          }

          .league-kit-details span,
          .kit-pickup-summary span {
            font-size: 0.61rem !important;
          }

          .league-kit-details strong,
          .kit-pickup-summary strong {
            overflow: hidden;
            font-size: 0.72rem !important;
            text-overflow: ellipsis;
          }

          .league-kit-status-actions {
            gap: 8px !important;
            padding: 9px !important;
            border-radius: 12px !important;
          }

          .league-kit-status-actions-heading span,
          .league-kit-responsibility p,
          .kit-assignment-reason p {
            display: none !important;
          }

          .league-kit-status-actions-heading strong,
          .league-kit-responsibility strong,
          .kit-assignment-reason strong {
            font-size: 0.72rem !important;
          }

          .league-kit-status-action-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 6px !important;
          }

          .league-kit-status-action-grid .btn {
            min-height: 34px !important;
            padding: 6px 7px !important;
            font-size: 0.62rem !important;
          }

          .league-kit-responsibility,
          .kit-assignment-reason {
            padding: 9px !important;
          }

          .kit-pickup-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 6px !important;
          }

          .kit-record-pickup-btn {
            min-height: 38px !important;
            font-size: 0.72rem !important;
          }

          .kit-pickup-disabled-note {
            font-size: 0.65rem !important;
          }

          .league-kit-analytics {
            gap: 8px !important;
            padding: 10px !important;
          }

          .league-kit-analytics-heading {
            display: flex !important;
            align-items: center !important;
          }

          .league-kit-analytics-heading span {
            display: none !important;
          }

          .league-kit-analytics-summary {
            display: flex !important;
            gap: 6px !important;
            overflow-x: auto;
            padding-bottom: 2px;
            scrollbar-width: none;
          }

          .league-kit-analytics-summary::-webkit-scrollbar {
            display: none;
          }

          .league-kit-analytics-summary > div {
            flex: 0 0 105px;
            min-height: 54px;
            padding: 8px !important;
            background: rgba(30, 41, 59, 0.78) !important;
          }

          .league-kit-analytics-summary span {
            font-size: 0.59rem !important;
          }

          .league-kit-analytics-summary strong {
            font-size: 0.78rem !important;
          }

          .league-kit-carrier-table {
            max-height: 210px;
            overflow: auto !important;
          }

          .league-kit-history {
            gap: 8px !important;
            padding-top: 10px !important;
          }

          .league-kit-history-heading {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
          }

          .league-kit-history-heading span {
            display: none !important;
          }

          .league-kit-history-heading .btn {
            min-height: 32px !important;
            padding: 5px 8px !important;
            font-size: 0.62rem !important;
          }

          .league-kit-timeline {
            gap: 7px !important;
          }

          .league-kit-timeline-item {
            grid-template-columns: 28px minmax(0, 1fr) !important;
            gap: 8px !important;
            padding: 8px !important;
          }

          .league-kit-timeline-icon {
            width: 28px !important;
            height: 28px !important;
            font-size: 0.75rem !important;
          }

          .league-kit-timeline-title {
            display: grid !important;
            gap: 2px !important;
          }

          .league-kit-timeline-body {
            gap: 3px !important;
          }

          .league-kit-timeline-body p {
            display: -webkit-box;
            overflow: hidden;
            margin: 0 !important;
            font-size: 0.67rem !important;
            line-height: 1.3 !important;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
          }

          .league-kit-timeline-title time,
          .league-kit-timeline-body small,
          .league-kit-timeline-transfer {
            font-size: 0.61rem !important;
          }

          .kit-current-custody-card {
            gap: 8px !important;
            padding: 10px !important;
          }

          .kit-current-custody-heading p {
            display: none !important;
          }

          .kit-current-custody-heading h4 {
            margin: 2px 0 0 !important;
            font-size: 0.85rem !important;
          }

          .kit-current-custody-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 7px !important;
          }

          .kit-current-custody-item {
            gap: 8px !important;
            padding: 9px !important;
          }

          .kit-current-custody-source,
          .kit-current-custody-date {
            display: none !important;
          }

          .kit-pickup-dialog {
            width: calc(100% - 12px) !important;
            max-height: 86dvh !important;
            padding: 13px !important;
            border: 1px solid rgba(125, 211, 252, 0.22);
            border-radius: 18px !important;
            background:
              linear-gradient(
                145deg,
                rgba(10, 20, 39, 0.99),
                rgba(17, 31, 57, 0.99)
              ) !important;
            color: #eef6ff !important;
          }

          .kit-pickup-header p {
            display: none !important;
          }

          .kit-pickup-assigned {
            margin: 10px 0 !important;
            padding: 9px !important;
            background: rgba(30, 41, 59, 0.72) !important;
          }

          .kit-pickup-choice {
            padding: 10px !important;
            border-color: rgba(148, 163, 184, 0.3) !important;
            background: rgba(15, 23, 42, 0.6) !important;
          }

          .kit-pickup-choice small {
            font-size: 0.65rem !important;
          }

          .kit-actual-carrier-fields {
            gap: 9px !important;
            margin-top: 10px !important;
          }

          .kit-actual-carrier-fields input,
          .kit-actual-carrier-fields select {
            min-height: 40px !important;
            border-color: rgba(148, 163, 184, 0.34) !important;
            background: rgba(15, 23, 42, 0.85) !important;
            color: #f8fafc !important;
          }

          .kit-pickup-actions {
            position: sticky;
            bottom: -1px;
            grid-template-columns: 0.7fr 1.3fr !important;
            gap: 7px !important;
            margin-top: 12px !important;
            padding-top: 9px;
            background: rgba(10, 20, 39, 0.96);
          }
        }

        /* =========================================================
           MOBILE TYPOGRAPHY + ALIGNMENT POLISH
           Compactness now comes from layout, not tiny fonts.
           ========================================================= */
        @media (max-width: 700px) {
          .kit-assignment-panel,
          .kit-assignment-panel button,
          .kit-assignment-panel input,
          .kit-assignment-panel select {
            font-size: 0.88rem !important;
          }

          .kit-assignment-panel-heading h3,
          .league-kit-card-header h4,
          .kit-current-custody-heading h4 {
            font-size: 1rem !important;
            line-height: 1.25 !important;
          }

          .kit-assignment-mode,
          .kit-assignment-status {
            font-size: 0.7rem !important;
            line-height: 1.2 !important;
          }

          .kit-assignment-toolbar {
            grid-template-columns: minmax(0, 1fr) auto !important;
          }

          .kit-assignment-toolbar strong {
            font-size: 0.86rem !important;
            line-height: 1.25 !important;
          }

          .kit-assignment-toolbar-actions .btn {
            min-height: 38px !important;
            padding: 8px 10px !important;
            font-size: 0.72rem !important;
          }

          .league-kit-person-block {
            min-height: 82px !important;
          }

          .league-kit-person-block small,
          .league-kit-person-block span,
          .league-kit-details span,
          .kit-pickup-summary span,
          .league-kit-analytics-summary span {
            font-size: 0.72rem !important;
            line-height: 1.3 !important;
          }

          .league-kit-person-block strong {
            font-size: 0.9rem !important;
            line-height: 1.25 !important;
          }

          .league-kit-details strong,
          .kit-pickup-summary strong,
          .league-kit-analytics-summary strong {
            font-size: 0.82rem !important;
            line-height: 1.28 !important;
          }

          .league-kit-details > div,
          .kit-pickup-summary > div {
            min-height: 58px !important;
            display: grid !important;
            align-content: center !important;
            gap: 3px !important;
          }

          .league-kit-status-actions-heading strong,
          .league-kit-responsibility strong,
          .kit-assignment-reason strong {
            font-size: 0.82rem !important;
            line-height: 1.3 !important;
          }

          .league-kit-status-action-grid .btn {
            min-height: 40px !important;
            font-size: 0.74rem !important;
            line-height: 1.2 !important;
          }

          .kit-record-pickup-btn {
            min-height: 42px !important;
            font-size: 0.82rem !important;
          }

          .league-kit-analytics-heading strong,
          .league-kit-history-heading strong {
            font-size: 0.95rem !important;
          }

          .league-kit-timeline-title strong {
            font-size: 0.8rem !important;
          }

          .league-kit-timeline-body p,
          .league-kit-timeline-title time,
          .league-kit-timeline-body small,
          .league-kit-timeline-transfer {
            font-size: 0.72rem !important;
            line-height: 1.35 !important;
          }

          .kit-current-custody-item strong {
            font-size: 0.86rem !important;
          }

          .kit-pickup-dialog h3 {
            font-size: 1.05rem !important;
          }

          .kit-pickup-choice strong,
          .kit-pickup-assigned strong {
            font-size: 0.86rem !important;
          }

          .kit-pickup-choice small,
          .kit-actual-carrier-fields label,
          .kit-pickup-disabled-note {
            font-size: 0.74rem !important;
            line-height: 1.35 !important;
          }

          .kit-pickup-actions .btn {
            min-height: 42px !important;
            font-size: 0.8rem !important;
          }
        }

        /* =========================================================
           MOBILE V6 FINAL OVERRIDE
           Fixes every overlap and horizontal overflow visible in the
           supplied iPhone screenshots.
           ========================================================= */
        @media (max-width: 700px) {
          /* Saved-player count first; two real action buttons beneath. */
          .kit-assignment-toolbar {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 10px !important;
            width: 100% !important;
            padding: 12px !important;
          }

          .kit-assignment-toolbar > div:first-child {
            display: grid !important;
            gap: 3px !important;
          }

          .kit-assignment-toolbar strong {
            color: #ffffff !important;
            font-size: 0.94rem !important;
            line-height: 1.3 !important;
          }

          .kit-assignment-toolbar small {
            display: block !important;
            color: #adbbd2 !important;
            font-size: 0.77rem !important;
            line-height: 1.4 !important;
          }

          .kit-assignment-toolbar-actions {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            width: 100% !important;
          }

          .kit-assignment-toolbar-actions .btn {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100% !important;
            min-height: 48px !important;
            padding: 10px 8px !important;
            overflow: visible !important;
            border: 1px solid rgba(105, 151, 244, 0.58) !important;
            border-radius: 12px !important;
            color: #ffffff !important;
            background: #1a2e55 !important;
            box-shadow: none !important;
            font-size: 0.8rem !important;
            font-weight: 900 !important;
            line-height: 1.25 !important;
            text-align: center !important;
            text-overflow: clip !important;
            white-space: normal !important;
          }

          .kit-assignment-toolbar-actions .kit-generate-assignment-btn {
            background: linear-gradient(135deg, #4f85f3, #43bce8) !important;
            border-color: transparent !important;
          }

          /* Holder → responsible person becomes a readable vertical flow. */
          .league-kit-flow {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 8px !important;
          }

          .league-kit-arrow {
            justify-self: center !important;
            transform: rotate(90deg) !important;
          }

          .league-kit-person-block {
            display: grid !important;
            gap: 4px !important;
            min-height: 0 !important;
            padding: 12px !important;
          }

          .league-kit-person-block small {
            color: #83c8ff !important;
            font-size: 0.75rem !important;
            font-weight: 900 !important;
            letter-spacing: 0.04em !important;
            line-height: 1.3 !important;
            text-transform: uppercase !important;
          }

          .league-kit-person-block strong {
            color: #ffffff !important;
            font-size: 1rem !important;
            line-height: 1.3 !important;
            white-space: normal !important;
          }

          .league-kit-person-block > span {
            display: block !important;
            color: #adbbd2 !important;
            font-size: 0.78rem !important;
            line-height: 1.4 !important;
          }

          /* No label/value overlap: every fact is one full-width row. */
          .league-kit-details,
          .kit-pickup-summary {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 8px !important;
            width: 100% !important;
          }

          .league-kit-details > div,
          .kit-pickup-summary > div {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            align-content: start !important;
            gap: 5px !important;
            width: 100% !important;
            min-height: 0 !important;
            padding: 11px 12px !important;
            overflow: hidden !important;
            border-radius: 11px !important;
            background: #101a30 !important;
          }

          .league-kit-details span,
          .kit-pickup-summary span {
            display: block !important;
            color: #adbbd2 !important;
            font-size: 0.76rem !important;
            line-height: 1.35 !important;
            white-space: normal !important;
          }

          .league-kit-details strong,
          .kit-pickup-summary strong {
            display: block !important;
            overflow: visible !important;
            color: #ffffff !important;
            font-size: 0.92rem !important;
            line-height: 1.35 !important;
            text-align: left !important;
            text-overflow: clip !important;
            white-space: normal !important;
            overflow-wrap: break-word !important;
          }

          /* Match-day actions: icon left, label right, one row each. */
          .league-kit-status-action-grid {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 9px !important;
            width: 100% !important;
          }

          .league-kit-status-action-grid .btn {
            display: grid !important;
            grid-template-columns: 36px minmax(0, 1fr) auto !important;
            align-items: center !important;
            gap: 10px !important;
            width: 100% !important;
            min-height: 54px !important;
            padding: 9px 12px !important;
            overflow: visible !important;
            border: 1px solid rgba(113, 142, 206, 0.42) !important;
            border-radius: 12px !important;
            color: #ffffff !important;
            background: #1a2948 !important;
            box-shadow: none !important;
            text-align: left !important;
            white-space: normal !important;
          }

          /* Neutralize pseudo-icons from any earlier global mobile CSS. */
          .league-kit-status-action-grid .btn::before {
            content: none !important;
            display: none !important;
          }

          .kit-status-action-icon {
            display: grid !important;
            place-items: center !important;
            width: 36px !important;
            height: 36px !important;
            border-radius: 10px !important;
            background: #22365d !important;
            font-size: 1rem !important;
            line-height: 1 !important;
          }

          .kit-status-action-label {
            display: block !important;
            color: #ffffff !important;
            font-size: 0.84rem !important;
            font-weight: 850 !important;
            line-height: 1.3 !important;
            white-space: normal !important;
          }

          .league-kit-status-action-grid .btn.active {
            border-color: rgba(94, 147, 255, 0.74) !important;
            background: #203b6d !important;
          }

          .league-kit-status-action-grid .btn.active::after {
            content: "Current";
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 5px 7px !important;
            border-radius: 999px !important;
            color: #ffffff !important;
            background: #4f85f3 !important;
            font-size: 0.66rem !important;
            font-weight: 900 !important;
            line-height: 1 !important;
          }

          /* Pickup button is a clear primary action. */
          .kit-record-pickup-btn {
            width: 100% !important;
            min-height: 52px !important;
            padding: 11px 14px !important;
            border: 0 !important;
            border-radius: 13px !important;
            color: #ffffff !important;
            background: linear-gradient(135deg, #4f85f3, #43bce8) !important;
            box-shadow: 0 10px 24px rgba(66, 126, 238, 0.28) !important;
            font-size: 0.88rem !important;
            font-weight: 900 !important;
            white-space: normal !important;
          }

          /* Rotation fairness can never cross the viewport width. */
          .league-kit-analytics {
            width: 100% !important;
            max-width: 100% !important;
            overflow: hidden !important;
          }

          .league-kit-analytics-heading {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 7px !important;
          }

          .league-kit-fairness-status {
            justify-self: start !important;
            max-width: 100% !important;
          }

          .league-kit-analytics-summary {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 8px !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
          }

          .league-kit-analytics-summary > div {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            align-items: center !important;
            gap: 10px !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 50px !important;
            padding: 10px 11px !important;
            border-radius: 11px !important;
            background: #101a30 !important;
          }

          .league-kit-analytics-summary span {
            color: #adbbd2 !important;
            font-size: 0.8rem !important;
            line-height: 1.3 !important;
            white-space: normal !important;
          }

          .league-kit-analytics-summary strong {
            color: #ffffff !important;
            font-size: 0.98rem !important;
            line-height: 1.2 !important;
          }

          .league-kit-carrier-table {
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: auto !important;
          }

          /* Timeline header and refresh button stay inside the card. */
          .league-kit-history-heading {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 9px !important;
          }

          .league-kit-history-heading .btn {
            width: 100% !important;
          }
        }

        /* =========================================================
           FINAL MOBILE WOW DESIGN — ASSIGNMENT + CUSTODY
           ========================================================= */
        @media (max-width: 700px) {
          .kit-assignment-panel {
            gap: 10px !important;
            padding: 10px !important;
            border-radius: 18px !important;
            background:
              linear-gradient(
                160deg,
                #15213d,
                #0d1629
              ) !important;
          }

          .kit-assignment-panel-heading {
            grid-template-columns: 1fr !important;
            gap: 5px !important;
            padding: 12px !important;
          }

          .kit-assignment-panel-heading h3 {
            font-size: 1.04rem !important;
          }

          .kit-assignment-context-text {
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            color: #aebbd2 !important;
            background: transparent !important;
            font-size: 0.79rem !important;
            line-height: 1.35 !important;
          }

          .kit-assignment-toolbar {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 9px !important;
            padding: 11px !important;
          }

          .kit-assignment-toolbar strong {
            font-size: 0.92rem !important;
          }

          .kit-assignment-toolbar small {
            display: block !important;
            color: #aebbd2 !important;
            font-size: 0.75rem !important;
            line-height: 1.35 !important;
          }

          .kit-assignment-toolbar-actions {
            display: grid !important;
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              ) !important;
            gap: 8px !important;
          }

          .kit-assignment-toolbar-actions .btn {
            width: 100% !important;
            min-height: 48px !important;
            padding: 10px 8px !important;
            border: 1px solid rgba(
              105,
              151,
              244,
              0.58
            ) !important;
            border-radius: 12px !important;
            color: #ffffff !important;
            background: #1a2e55 !important;
            font-size: 0.8rem !important;
            font-weight: 900 !important;
            white-space: normal !important;
          }

          .kit-generate-assignment-btn {
            border-color: transparent !important;
            background:
              linear-gradient(
                135deg,
                #4f85f3,
                #43bce8
              ) !important;
          }

          .league-kit-card {
            gap: 9px !important;
            padding: 10px !important;
            background: #101a30 !important;
          }

          .league-kit-card-header {
            padding: 2px !important;
          }

          .mobile-kit-section {
            overflow: hidden !important;
            border: 1px solid rgba(
              113,
              142,
              206,
              0.3
            ) !important;
            border-radius: 15px !important;
            background: #14203a !important;
            box-shadow:
              inset 0 1px 0 rgba(
                255,
                255,
                255,
                0.03
              ) !important;
          }

          .mobile-kit-section-summary {
            display: grid !important;
            grid-template-columns:
              42px minmax(0, 1fr) auto !important;
            align-items: center !important;
            gap: 10px !important;
            min-height: 74px !important;
            padding: 11px !important;
            cursor: pointer !important;
            list-style: none !important;
          }

          .mobile-kit-section-summary::-webkit-details-marker {
            display: none !important;
          }

          .mobile-kit-section-icon {
            display: grid !important;
            place-items: center !important;
            width: 42px !important;
            height: 42px !important;
            border-radius: 12px !important;
            background:
              linear-gradient(
                145deg,
                #233861,
                #192a4c
              ) !important;
            font-size: 1.05rem !important;
          }

          .mobile-kit-section-copy {
            display: grid !important;
            gap: 2px !important;
          }

          .mobile-kit-section-copy small {
            color: #83c8ff !important;
            font-size: 0.66rem !important;
            font-weight: 900 !important;
            letter-spacing: 0.07em !important;
            line-height: 1.2 !important;
          }

          .mobile-kit-section-copy strong {
            color: #ffffff !important;
            font-size: 0.9rem !important;
            line-height: 1.25 !important;
          }

          .mobile-kit-section-copy > span {
            display: -webkit-box !important;
            overflow: hidden !important;
            color: #aebbd2 !important;
            font-size: 0.72rem !important;
            line-height: 1.32 !important;
            -webkit-box-orient: vertical !important;
            -webkit-line-clamp: 2 !important;
          }

          .mobile-kit-section-side {
            display: grid !important;
            justify-items: end !important;
            gap: 7px !important;
          }

          .mobile-kit-section-side b {
            max-width: 88px !important;
            overflow: hidden !important;
            padding: 5px 7px !important;
            border-radius: 999px !important;
            color: #dce8ff !important;
            background: #1d2d50 !important;
            font-size: 0.62rem !important;
            line-height: 1.1 !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }

          .mobile-kit-section-side i {
            position: relative !important;
            display: block !important;
            width: 16px !important;
            height: 10px !important;
            transition:
              transform 180ms ease !important;
          }

          .mobile-kit-section-side i::before,
          .mobile-kit-section-side i::after {
            content: "" !important;
            position: absolute !important;
            top: 4px !important;
            width: 9px !important;
            height: 2px !important;
            border-radius: 999px !important;
            background: #83c8ff !important;
          }

          .mobile-kit-section-side i::before {
            left: 0 !important;
            transform: rotate(42deg) !important;
          }

          .mobile-kit-section-side i::after {
            right: 0 !important;
            transform: rotate(-42deg) !important;
          }

          .mobile-kit-section[open]
            .mobile-kit-section-side i {
            transform: rotate(180deg) !important;
          }

          .mobile-kit-section-body {
            display: grid !important;
            gap: 9px !important;
            padding: 0 10px 10px !important;
            animation:
              mobile-kit-reveal
              180ms
              ease !important;
          }

          .mobile-kit-section-body::before {
            content: "" !important;
            display: block !important;
            height: 1px !important;
            margin-bottom: 1px !important;
            background:
              linear-gradient(
                90deg,
                transparent,
                rgba(
                  117,
                  151,
                  225,
                  0.3
                ),
                transparent
              ) !important;
          }

          .league-kit-flow,
          .league-kit-details,
          .kit-pickup-summary,
          .league-kit-status-action-grid,
          .league-kit-analytics-summary {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
            width: 100% !important;
          }

          .league-kit-arrow {
            justify-self: center !important;
            transform: rotate(90deg) !important;
          }

          .league-kit-person-block,
          .league-kit-details > div,
          .kit-pickup-summary > div,
          .league-kit-analytics-summary > div {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 4px !important;
            width: 100% !important;
            min-height: 0 !important;
            padding: 11px !important;
            overflow: hidden !important;
            border-radius: 11px !important;
            background: #101a30 !important;
          }

          .league-kit-person-block strong,
          .league-kit-details strong,
          .kit-pickup-summary strong {
            color: #ffffff !important;
            font-size: 0.9rem !important;
            line-height: 1.32 !important;
            text-align: left !important;
            white-space: normal !important;
            overflow-wrap: break-word !important;
          }

          .league-kit-person-block small,
          .league-kit-details span,
          .kit-pickup-summary span {
            color: #aebbd2 !important;
            font-size: 0.75rem !important;
            line-height: 1.32 !important;
          }

          .league-kit-status-actions {
            padding: 10px !important;
          }

          .league-kit-status-action-grid .btn {
            display: grid !important;
            grid-template-columns:
              36px minmax(0, 1fr) auto !important;
            align-items: center !important;
            gap: 10px !important;
            width: 100% !important;
            min-height: 54px !important;
            padding: 9px 12px !important;
            border: 1px solid rgba(
              113,
              142,
              206,
              0.42
            ) !important;
            border-radius: 12px !important;
            color: #ffffff !important;
            background: #1a2948 !important;
            text-align: left !important;
            white-space: normal !important;
          }

          .league-kit-status-action-grid .btn::before {
            content: none !important;
            display: none !important;
          }

          .kit-status-action-icon {
            display: grid !important;
            place-items: center !important;
            width: 36px !important;
            height: 36px !important;
            border-radius: 10px !important;
            background: #22365d !important;
            font-size: 1rem !important;
          }

          .kit-status-action-label {
            color: #ffffff !important;
            font-size: 0.84rem !important;
            font-weight: 850 !important;
            line-height: 1.3 !important;
          }

          .league-kit-status-action-grid .btn.active::after {
            content: "Current";
            padding: 5px 7px !important;
            border-radius: 999px !important;
            color: #ffffff !important;
            background: #4f85f3 !important;
            font-size: 0.64rem !important;
            font-weight: 900 !important;
          }

          .kit-record-pickup-btn {
            width: 100% !important;
            min-height: 52px !important;
            border: 0 !important;
            border-radius: 13px !important;
            color: #ffffff !important;
            background:
              linear-gradient(
                135deg,
                #4f85f3,
                #43bce8
              ) !important;
            font-size: 0.88rem !important;
            font-weight: 900 !important;
          }

          .league-kit-analytics,
          .league-kit-history {
            width: 100% !important;
            max-width: 100% !important;
            overflow: hidden !important;
            padding: 10px !important;
          }

          .league-kit-analytics-summary > div {
            grid-template-columns:
              minmax(0, 1fr) auto !important;
            align-items: center !important;
          }

          .league-kit-analytics-summary span {
            font-size: 0.78rem !important;
          }

          .league-kit-analytics-summary strong {
            font-size: 0.96rem !important;
          }

          .league-kit-carrier-table {
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: auto !important;
          }

          .league-kit-history-heading {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }

          .league-kit-history-heading .btn {
            width: 100% !important;
          }

          @keyframes mobile-kit-reveal {
            from {
              opacity: 0;
              transform: translateY(-4px);
            }

            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        }

        /* =========================================================
           MOBILE FINAL POLISH — BUTTON DEPTH + READABLE TYPE
           ========================================================= */
        @media (max-width: 700px) {
          .kit-assignment-panel {
            font-size: 0.88rem !important;
          }

          .kit-assignment-panel .btn:not(:disabled) {
            border-color: rgba(105, 151, 244, 0.62) !important;
            box-shadow:
              0 8px 18px rgba(7, 20, 48, 0.24),
              inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
          }

          .kit-assignment-panel .btn:not(:disabled):active {
            transform: translateY(1px) !important;
          }

          .kit-record-pickup-btn,
          .kit-generate-assignment-btn,
          .kit-pickup-actions .btn:last-child {
            min-height: 50px !important;
            border: 0 !important;
            color: #ffffff !important;
            background:
              linear-gradient(
                135deg,
                #4f85f3,
                #43bce8
              ) !important;
            box-shadow:
              0 10px 24px rgba(66, 126, 238, 0.32),
              inset 0 1px 0 rgba(255, 255, 255, 0.18) !important;
            font-size: 0.88rem !important;
            font-weight: 900 !important;
          }

          .league-kit-status-action-grid .btn {
            border-color: rgba(113, 142, 206, 0.52) !important;
            box-shadow:
              0 7px 16px rgba(7, 20, 48, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
          }

          .league-kit-status-action-grid .btn.active {
            border-color: rgba(94, 147, 255, 0.82) !important;
            background:
              linear-gradient(
                135deg,
                #244577,
                #1b365f
              ) !important;
            box-shadow:
              0 9px 22px rgba(25, 63, 122, 0.28),
              inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
          }

          .mobile-kit-section-copy strong {
            font-size: 0.94rem !important;
          }

          .mobile-kit-section-copy > span {
            font-size: 0.75rem !important;
            line-height: 1.38 !important;
          }

          .league-kit-person-block small,
          .league-kit-details span,
          .kit-pickup-summary span {
            font-size: 0.77rem !important;
          }

          .league-kit-person-block strong,
          .league-kit-details strong,
          .kit-pickup-summary strong {
            font-size: 0.92rem !important;
          }

          .kit-status-action-label {
            font-size: 0.86rem !important;
          }
        }

      `}</style>
    </section>
  );
}
