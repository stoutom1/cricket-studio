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
  return String(status || "NOT ASSIGNED").replaceAll(
    "_",
    " "
  );
}

function assignmentPersonName(assignment) {
  return (
    assignment?.rotationMember?.displayName ||
    assignment?.matchKitPlayer?.displayName ||
    "Unknown player"
  );
}

function pickupLabel(status) {
  switch (status) {
    case "TOOK_KIT":
      return "Took the kit";
    case "DID_NOT_TAKE_KIT":
      return "Nobody took the kit";
    default:
      return "Pickup pending";
  }
}

export default function KitAssignmentPanel({
  matchId,
  refreshKey = 0,
  onMessage,
  onError,
}) {
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const [assignments, setAssignments] = useState([]);
  const [match, setMatch] = useState(null);
  const [savedPlayerCount, setSavedPlayerCount] =
    useState(0);
  const [savedPlayerCounts, setSavedPlayerCounts] =
    useState({ total: 0, teamA: 0, teamB: 0 });
  const [eligiblePlayers, setEligiblePlayers] =
    useState([]);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const [pickupAssignment, setPickupAssignment] =
    useState(null);
  const [pickupStatus, setPickupStatus] =
    useState("PENDING");
  const [actualCarrierMatchPlayerId, setActualCarrierMatchPlayerId] =
    useState("");
  const [actualCarrierName, setActualCarrierName] =
    useState("");
  const [isSavingPickup, setIsSavingPickup] =
    useState(false);
  const [pickupError, setPickupError] = useState("");

  const loadAssignments = useCallback(async () => {
  if (!matchId) {
  setAssignments([]);
  setMatch(null);
  setSavedPlayerCount(0);
  setSavedPlayerCounts({
    total: 0,
    teamA: 0,
    teamB: 0,
  });
  setEligiblePlayers([]);
  return;
}

/*
 * IMPORTANT:
 * Clear previous match data before
 * loading the newly selected match.
 */
setAssignments([]);
setEligiblePlayers([]);
setMatch(null);

setSavedPlayerCount(0);
setSavedPlayerCounts({
  total: 0,
  teamA: 0,
  teamB: 0,
});

setLoading(true);

    try {
      const response = await fetch(
        `/api/matches/${matchId}/kit-assignments`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load kit assignments."
        );
      }

      setAssignments(
        Array.isArray(data.assignments)
          ? data.assignments
          : []
      );
      setMatch(data.match || null);
      setSavedPlayerCount(
        Number(data.savedPlayerCount || 0)
      );
      setSavedPlayerCounts({
        total: Number(
          data?.savedPlayerCounts?.total || 0
        ),
        teamA: Number(
          data?.savedPlayerCounts?.teamA || 0
        ),
        teamB: Number(
          data?.savedPlayerCounts?.teamB || 0
        ),
      });
      setEligiblePlayers(
        Array.isArray(data.eligiblePlayers)
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

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments, refreshKey]);

  async function generateSuggestions({
    suggestNext = false,
  } = {}) {
    if (!matchId || !match) {
      return;
    }

    const targetTeamIds = [];

    if (
      savedPlayerCounts.teamA > 0 &&
      match?.teamA?.id
    ) {
      targetTeamIds.push(match.teamA.id);
    }

    if (
      savedPlayerCounts.teamB > 0 &&
      match?.teamB?.id
    ) {
      targetTeamIds.push(match.teamB.id);
    }

    if (targetTeamIds.length === 0) {
      onErrorRef.current?.(
        "Save at least one team roster before generating a kit assignment."
      );
      return;
    }

    setSuggesting(true);
    onErrorRef.current?.("");
    onMessageRef.current?.("");

    try {
      const messages = [];

      for (const teamId of targetTeamIds) {
        const response = await fetch(
          `/api/matches/${matchId}/kit-assignments/suggest`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              suggestNext,
              teamId,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to generate kit suggestions."
          );
        }

        if (data?.message) {
          messages.push(data.message);
        }
      }

      onMessageRef.current?.(
        messages[0] ||
          "Kit suggestions generated."
      );

      await loadAssignments();
    } catch (error) {
      onErrorRef.current?.(
        error?.message ||
          "Unable to generate kit suggestions."
      );
    } finally {
      setSuggesting(false);
    }
  }

  function availablePlayersForAssignment(assignment) {
    if (!assignment) {
      return [];
    }

    if (match?.kitRotationMode === "LEAGUE_PLAYER") {
      return eligiblePlayers;
    }

    return eligiblePlayers.filter(
      (player) =>
        Number(player.teamId) ===
        Number(assignment.teamId)
    );
  }

  function openPickupDialog(assignment) {
    setPickupAssignment(assignment);
    setPickupStatus(
      assignment?.pickupStatus || "PENDING"
    );
    setActualCarrierMatchPlayerId(
      assignment?.actualMatchKitPlayerId
        ? String(
            assignment.actualMatchKitPlayerId
          )
        : ""
    );
    setActualCarrierName(
      assignment?.actualDisplayName || ""
    );
    setPickupError("");
  }

  function closePickupDialog() {
    if (isSavingPickup) {
      return;
    }

    setPickupAssignment(null);
    setPickupStatus("PENDING");
    setActualCarrierMatchPlayerId("");
    setActualCarrierName("");
    setPickupError("");
  }

  function chooseAssignedPlayer() {
    if (!pickupAssignment) {
      return;
    }

    const assignedName = assignmentPersonName(
      pickupAssignment
    );

    const possiblePlayers =
      availablePlayersForAssignment(
        pickupAssignment
      );

    const matchingPlayer = possiblePlayers.find(
      (player) =>
        Number(player.id) ===
          Number(
            pickupAssignment.matchKitPlayerId
          ) ||
        (player.normalizedName &&
          player.normalizedName ===
            pickupAssignment.rotationMember
              ?.normalizedName)
    );

    setPickupStatus("TOOK_KIT");
    setActualCarrierMatchPlayerId(
      matchingPlayer?.id
        ? String(matchingPlayer.id)
        : ""
    );
    setActualCarrierName(assignedName);
    setPickupError("");
  }

  function handlePlayerSelection(event) {
    const selectedId = event.target.value;
    setActualCarrierMatchPlayerId(selectedId);

    const player = eligiblePlayers.find(
      (item) =>
        String(item.id) === String(selectedId)
    );

    if (player) {
      setPickupStatus("TOOK_KIT");
      setActualCarrierName(
        player.displayName || ""
      );
    }

    setPickupError("");
  }

  async function saveKitPickup() {
    if (!pickupAssignment?.teamId || !matchId) {
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
        `/api/matches/${matchId}/kit-assignments/${pickupAssignment.teamId}/pickup`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pickupStatus,
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to record kit pickup."
        );
      }

      onMessageRef.current?.(
        data?.message ||
          "Kit pickup recorded successfully."
      );

      closePickupDialog();
      await loadAssignments();
    } catch (error) {
      setPickupError(
        error?.message ||
          "Unable to record kit pickup."
      );
    } finally {
      setIsSavingPickup(false);
    }
  }

  const hasAssignments = assignments.length > 0;
  const canSuggest =
    savedPlayerCount > 0 &&
    !loading &&
    !suggesting;

  return (
    <section className="kit-assignment-panel">
      <div className="kit-assignment-panel-heading">
        <div>
          <span className="kit-section-kicker">
            Fair rotation
          </span>

          <h3>🎒 Suggested Kit Carriers</h3>

          <p>
            Cric4All tracks the person who was
            assigned and the person who actually
            took the kit after the match.
          </p>
        </div>

        {match?.kitRotationMode && (
          <span className="kit-assignment-mode">
            {match.kitRotationMode ===
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
          {savedPlayerCount === 0 && (
            <div className="kit-info-message">
              Save at least one confirmed team roster
              before generating a suggestion.
            </div>
          )}

          <div className="kit-assignment-toolbar">
            <div>
              <strong>
                {savedPlayerCount} eligible player
                {savedPlayerCount === 1 ? "" : "s"}{" "}
                saved
              </strong>

              <small>
                Suggestions are generated only for teams
                whose player roster has been saved.
              </small>
            </div>

            <div className="kit-assignment-toolbar-actions">
              <button
                type="button"
                className="btn kit-generate-assignment-btn"
                disabled={!canSuggest}
                onClick={() =>
                  generateSuggestions({
                    suggestNext: false,
                  })
                }
              >
                {suggesting
                  ? "Generating..."
                  : hasAssignments
                    ? "↻ Recalculate"
                    : "✨ Suggest Kit Carriers"}
              </button>

              {hasAssignments && (
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={!canSuggest}
                  onClick={() =>
                    generateSuggestions({
                      suggestNext: true,
                    })
                  }
                >
                  ⇥ Suggest Next
                </button>
              )}
            </div>
          </div>

          {!hasAssignments ? (
            <div className="kit-empty-assignments">
              <span>🎒</span>
              <strong>
                No kit carriers suggested yet
              </strong>
              <p>
                Save a team roster, then click Suggest
                Kit Carriers.
              </p>
            </div>
          ) : (
            <div className="kit-assignment-grid">
              {assignments.map((assignment) => {
                const completedCount = Number(
                  assignment?.rotationMember
                    ?.completedCount || 0
                );

                return (
                  <article
                    key={assignment.id}
                    className="kit-assignment-card"
                  >
                    <div className="kit-assignment-card-header">
                      <div>
                        <span>Playing team</span>
                        <h4>
                          {assignment.team?.name ||
                            `Team ${assignment.teamId}`}
                        </h4>
                      </div>

                      <span
                        className={`kit-assignment-status status-${String(
                          assignment.status || ""
                        ).toLowerCase()}`}
                      >
                        {statusLabel(assignment.status)}
                      </span>
                    </div>

                    <div className="kit-assigned-person">
                      <span className="kit-person-avatar">
                        👤
                      </span>
                      <div>
                        <small>Originally assigned</small>
                        <strong>
                          {assignmentPersonName(
                            assignment
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="kit-assignment-stats">
                      <div>
                        <span>Previous kit pickups</span>
                        <strong>{completedCount}</strong>
                      </div>
                      <div>
                        <span>Last kit pickup</span>
                        <strong>
                          {formatDate(
                            assignment?.rotationMember
                              ?.lastCompletedAt
                          )}
                        </strong>
                      </div>
                    </div>

                    {assignment.assignmentReason && (
                      <div className="kit-assignment-reason">
                        <strong>Why selected</strong>
                        <p>
                          {assignment.assignmentReason}
                        </p>
                      </div>
                    )}

                    <div className="kit-pickup-summary">
                      <div>
                        <span>Pickup status</span>
                        <strong>
                          {pickupLabel(
                            assignment.pickupStatus
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Actually took the kit</span>
                        <strong>
                          {assignment.pickupStatus ===
                          "TOOK_KIT"
                            ? assignment.actualDisplayName ||
                              assignment
                                .actualRotationMember
                                ?.displayName ||
                              "Name not recorded"
                            : assignment.pickupStatus ===
                                "DID_NOT_TAKE_KIT"
                              ? "Nobody"
                              : "Not recorded yet"}
                        </strong>
                      </div>

                      {assignment.pickupRecordedAt && (
                        <div>
                          <span>Recorded</span>
                          <strong>
                            {formatDate(
                              assignment.pickupRecordedAt
                            )}
                          </strong>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn kit-record-pickup-btn"
                      onClick={() =>
                        openPickupDialog(assignment)
                      }
                    >
                      {assignment.pickupStatus ===
                      "PENDING"
                        ? "Record Kit Pickup"
                        : "Edit Kit Pickup"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {pickupAssignment && (
        <div
          className="kit-pickup-overlay"
          onClick={closePickupDialog}
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
                  Record Kit Pickup
                </h3>
                <p>
                  Record who actually took the kit after
                  the match. The name can be edited.
                </p>
              </div>

              <button
                type="button"
                className="kit-close-btn"
                onClick={closePickupDialog}
                disabled={isSavingPickup}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="kit-pickup-assigned">
              <span>Originally assigned</span>
              <strong>
                {assignmentPersonName(
                  pickupAssignment
                )}
              </strong>
            </div>

            <div className="kit-pickup-choice-grid">
              <button
                type="button"
                className="kit-pickup-choice"
                onClick={chooseAssignedPlayer}
              >
                <strong>
                  Assigned player took the kit
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
                  pickupStatus === "TOOK_KIT"
                    ? "kit-pickup-choice active"
                    : "kit-pickup-choice"
                }
                onClick={() => {
                  setPickupStatus("TOOK_KIT");
                  setPickupError("");
                }}
              >
                <strong>
                  Someone else took the kit
                </strong>
                <span>
                  Select a player or type the correct
                  name.
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
                  setActualCarrierMatchPlayerId("");
                  setActualCarrierName("");
                  setPickupError("");
                }}
              >
                <strong>Nobody took the kit</strong>
                <span>
                  Record that the kit was not collected.
                </span>
              </button>
            </div>

            {pickupStatus === "TOOK_KIT" && (
              <div className="kit-actual-carrier-fields">
                <label>
                  <span>Select eligible player</span>
                  <select
                    value={
                      actualCarrierMatchPlayerId
                    }
                    onChange={handlePlayerSelection}
                  >
                    <option value="">
                      Select a player or type below
                    </option>
                    {availablePlayersForAssignment(
                      pickupAssignment
                    ).map((player) => (
                      <option
                        key={player.id}
                        value={player.id}
                      >
                        {player.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>
                    Person who actually took the kit
                  </span>
                  <input
                    type="text"
                    value={actualCarrierName}
                    placeholder="Enter or correct the name"
                    onChange={(event) => {
                      setActualCarrierName(
                        event.target.value
                      );
                      setPickupStatus("TOOK_KIT");
                      setPickupError("");
                    }}
                  />
                  <small>
                    This editable name is the person who
                    receives rotation credit.
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
                onClick={closePickupDialog}
                disabled={isSavingPickup}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn kit-record-pickup-btn"
                onClick={saveKitPickup}
                disabled={isSavingPickup}
              >
                {isSavingPickup
                  ? "Saving..."
                  : "Save Kit Pickup"}
              </button>
            </div>
          </section>
        </div>
      )}

      <style jsx>{`
        .kit-pickup-summary {
          display: grid;
          gap: 8px;
          margin: 14px 0;
          padding: 12px;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.04);
        }

        .kit-pickup-summary > div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .kit-pickup-summary span {
          opacity: 0.72;
        }

        .kit-record-pickup-btn {
          width: 100%;
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

        @media (max-width: 640px) {
          .kit-pickup-dialog {
            padding: 16px;
          }

          .kit-pickup-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .kit-pickup-summary > div {
            display: grid;
            gap: 2px;
          }
        }
      `}</style>
    </section>
  );
}
