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
    if (
      !pickupAssignment
        ?.teamId ||
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
      ].includes(
        pickupStatus
      )
    ) {
      setPickupError(
        "Select what happened to the kit after the match."
      );
      return;
    }

    if (
      pickupStatus ===
        "TOOK_KIT" &&
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
      const response =
        await fetch(
          `/api/matches/${matchId}/kit-assignments/${pickupAssignment.teamId}/pickup`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              pickupStatus,
              actualMatchKitPlayerId:
                pickupStatus ===
                  "TOOK_KIT" &&
                actualCarrierMatchPlayerId
                  ? Number(
                      actualCarrierMatchPlayerId
                    )
                  : null,
              actualDisplayName:
                pickupStatus ===
                "TOOK_KIT"
                  ? actualCarrierName.trim()
                  : null,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to record kit pickup."
        );
      }

      onMessageRef.current?.(
        data?.message ||
          "Kit custody recorded successfully."
      );

      closePickupDialog();
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
          <span className="kit-assignment-mode">
            {sharedKit
              ? "Shared league custody"
              : match
                    .kitRotationMode ===
                  "LEAGUE_PLAYER"
                ? "Person-level history"
                : "Team-level history"}
          </span>
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
                      {updatingKitStatus ===
                      "COORDINATED"
                        ? "Saving..."
                        : "Coordination Confirmed"}
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
                      {updatingKitStatus ===
                      "HANDED_OVER"
                        ? "Saving..."
                        : "Kit Handed Over"}
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
                      {updatingKitStatus ===
                      "AT_VENUE"
                        ? "Saving..."
                        : "✓ Kit Is at the Venue"}
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
                      {updatingKitStatus ===
                      "RESET_COORDINATION"
                        ? "Resetting..."
                        : "Reset Status"}
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

                    <button
                      type="button"
                      className="btn kit-record-pickup-btn"
                      onClick={() =>
                        openPickupDialog(
                          assignment
                        )
                      }
                    >
                      {assignment.pickupStatus ===
                      "PENDING"
                        ? "Record Kit Pickup"
                        : "Edit Kit Pickup"}
                    </button>
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

      <style jsx>{`
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
      `}</style>
    </section>
  );
}
