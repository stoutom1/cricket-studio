"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import KitAssignmentPanel from "./KitAssignmentPanel";

const MAX_SCREENSHOT_SIZE_BYTES = 8 * 1024 * 1024;
function normalizeDetectedPlayerName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\(wk\)/gi, "")
    .replace(/\(c\)/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findMatchingDatabasePlayer(
  detectedName,
  databasePlayers
) {
  const normalizedDetectedName =
    normalizeDetectedPlayerName(
      detectedName
    );

  if (!normalizedDetectedName) {
    return null;
  }

  return (
    databasePlayers.find(
      (databasePlayer) =>
        normalizeDetectedPlayerName(
          databasePlayer?.name
        ) === normalizedDetectedName
    ) || null
  );
}
function createTemporaryPlayer(name = "") {
  return {
    clientId:
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,

    displayName: name,
    included: true,
    playerId: "",
    whatsappNumber: "",
    whatsappOptIn: false,
    matchStatus: "UNMATCHED",
  };
}

function createDetectedPlayer({
  name,
  databasePlayers,
  isLeaguePlayerMode,
}) {
  const temporaryPlayer =
    createTemporaryPlayer(name);

  /*
   * Surprise League uses the screenshot name as the
   * person identity, because the same roster is stored
   * beneath both Surprise teams.
   */
  if (isLeaguePlayerMode) {
    return temporaryPlayer;
  }

  const matchedDatabasePlayer =
    findMatchingDatabasePlayer(
      name,
      databasePlayers
    );

  if (!matchedDatabasePlayer) {
    return temporaryPlayer;
  }

  return {
    ...temporaryPlayer,

    displayName:
      matchedDatabasePlayer.name,

    playerId:
      String(
        matchedDatabasePlayer.id
      ),

    matchStatus: "MATCHED",
  };
}

function normalizeMatchStatus(value) {
  return String(value || "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

function isAvailableMatch(match) {
  const status = normalizeMatchStatus(match?.status);

  return [
    "SCHEDULED",
    "ACTIVE",
    "LIVE",
    "IN_PROGRESS",
    "STARTED",
  ].includes(status);
}

function getMatchTeamName(match, side) {
  if (side === "A") {
    return (
      match?.teamA?.name ||
      match?.teamAName ||
      "Team A"
    );
  }

  return (
    match?.teamB?.name ||
    match?.teamBName ||
    "Team B"
  );
}

function getMatchTeamId(match, side) {
  if (side === "A") {
    return (
      match?.teamAId ||
      match?.teamA?.id ||
      ""
    );
  }

  return (
    match?.teamBId ||
    match?.teamB?.id ||
    ""
  );
}

function formatMatchDate(value) {
  if (!value) {
    return "Date not scheduled";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date not scheduled";
  }

  return parsedDate.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PlayerReviewRow({
  player,
  index,
  teamPlayers,
  isLeaguePlayerMode,
  sourceMode = "SCREENSHOT",
  onChange,
  onRemove,
}) {
  const isTeamRosterMode =
    sourceMode === "TEAM_ROSTER";

  const matchedPlayer = teamPlayers.find(
    (candidate) =>
      String(candidate.id) ===
      String(player.playerId)
  );

  return (
    <div
      className={`kit-player-review-row ${
        isLeaguePlayerMode
          ? "kit-player-review-row-league-mode"
          : ""
      } ${
        isTeamRosterMode
          ? "kit-player-review-row-roster-mode"
          : ""
      }`}
    >
      <label className="kit-player-include">
        <input
          type="checkbox"
          checked={player.included}
          onChange={(event) =>
            onChange({
              included: event.target.checked,
            })
          }
        />

        <span>
          {player.included
            ? "Included"
            : "Excluded"}
        </span>
      </label>

      <div className="kit-player-number">
        {index + 1}
      </div>

      {isTeamRosterMode ? (
        <>
          <div className="kit-roster-player-cell">
            <label className="kit-mobile-field-label">
              Player
            </label>

            <div className="kit-roster-player-identity">
              <span className="kit-roster-avatar" aria-hidden="true">
                {String(player.displayName || "P")
                  .trim()
                  .charAt(0)
                  .toUpperCase() || "P"}
              </span>

              <span>
                <strong>
                  {player.displayName || "Unnamed player"}
                </strong>
                <small>Registered Cric4All player</small>
              </span>
            </div>
          </div>

          <div className="kit-player-match-status is-registered">
            <span
              className="kit-player-match-status-dot"
              aria-hidden="true"
            />
            <span>Registered</span>
          </div>
        </>
      ) : (
        <>
          <div className="kit-player-field kit-screenshot-name-cell">
            <label className="kit-mobile-field-label">
              Screenshot name
            </label>

            <input
              type="text"
              value={player.displayName}
              placeholder="Enter player name"
              onChange={(event) =>
                onChange({
                  displayName: event.target.value,
                  playerId: "",
                  matchStatus: "UNMATCHED",
                })
              }
            />
          </div>

          {!useOneSharedCarrier && (
            <div className="kit-player-field kit-player-match-cell">
              <label className="kit-mobile-field-label">
                Cric4All player
              </label>

              <select
                value={player.playerId}
                onChange={(event) => {
                  const nextPlayerId =
                    event.target.value;

                  const selectedPlayer =
                    teamPlayers.find(
                      (candidate) =>
                        String(candidate.id) ===
                        String(nextPlayerId)
                    );

                  onChange({
                    playerId: nextPlayerId,
                    displayName:
                      selectedPlayer?.name ||
                      player.displayName,
                    matchStatus: nextPlayerId
                      ? "MATCHED"
                      : "UNMATCHED",
                  });
                }}
              >
                <option value="">
                  Continue with screenshot name
                </option>

                {teamPlayers.map((candidate) => (
                  <option
                    key={candidate.id}
                    value={candidate.id}
                  >
                    {candidate.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isLeaguePlayerMode ? (
            <div
              className={`kit-player-match-status ${
                matchedPlayer
                  ? "is-matched"
                  : "is-unmatched"
              }`}
            >
              <span
                className="kit-player-match-status-dot"
                aria-hidden="true"
              />
              <span>
                {matchedPlayer
                  ? "Matched"
                  : "Not matched"}
              </span>
            </div>
          ) : (
            <div className="kit-player-match-status is-screenshot">
              <span
                className="kit-player-match-status-dot"
                aria-hidden="true"
              />
              <span>Screenshot identity</span>
            </div>
          )}
        </>
      )}

      <button
        type="button"
        className="kit-remove-player-btn"
        onClick={onRemove}
        aria-label={`Remove ${
          player.displayName || "player"
        }`}
        title="Remove player"
      >
        ✕
      </button>
    </div>
  );
}

function TeamPlayerReview({
  title,
  teamId,
  players,
  databasePlayers,
  isLeaguePlayerMode,
  newPlayerName,
  onNewPlayerNameChange,
  onAddPlayer,
  onUpdatePlayer,
  onRemovePlayer,
  onSetAllIncluded,
  sourceMode = "SCREENSHOT",
}) {
  const isTeamRosterMode =
    sourceMode === "TEAM_ROSTER";

  const includedCount = players.filter(
    (player) => player.included
  ).length;

  return (
    <details
      className={`kit-team-review-card kit-team-review-details ${
        isTeamRosterMode
          ? "kit-team-review-card-roster"
          : ""
      }`}
    >
      <summary className="kit-team-review-summary">
        <div className="kit-team-review-summary-main">
          <span className="kit-team-review-icon">
            👥
          </span>

          <div>
            <span className="kit-team-kicker">
              {isTeamRosterMode
                ? "Registered playing roster"
                : "Detected playing team"}
            </span>

            <h4>{title}</h4>

            <small>
              {includedCount} selected of {players.length}
            </small>
          </div>
        </div>

        <div className="kit-team-review-summary-actions">
          <button
            type="button"
            className="kit-team-bulk-btn"
            disabled={players.length === 0}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSetAllIncluded?.(false);
            }}
          >
            Clear All
          </button>

          <button
            type="button"
            className="kit-team-bulk-btn"
            disabled={players.length === 0}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSetAllIncluded?.(true);
            }}
          >
            Select All
          </button>

          <span className="kit-player-count-badge">
            {includedCount}
          </span>

          <span
            className="kit-team-review-chevron"
            aria-hidden="true"
          >
            ⌄
          </span>
        </div>
      </summary>

      <div className="kit-team-review-body">
      <div className="kit-add-player-row">
        <input
          type="text"
          value={newPlayerName}
          placeholder={`Add a player to ${title}`}
          onChange={(event) =>
            onNewPlayerNameChange(
              event.target.value
            )
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAddPlayer();
            }
          }}
        />

        <button
          type="button"
          className="btn btn-outline"
          onClick={onAddPlayer}
        >
          ＋ Add Player
        </button>
      </div>

      {players.length === 0 ? (
        <div className="kit-empty-player-list">
          <span className="kit-empty-player-icon" aria-hidden="true">
            {isTeamRosterMode ? "👥" : "📋"}
          </span>
          <strong>
            {isTeamRosterMode
              ? "Load the selected team roster to continue."
              : "No player names available yet."}
          </strong>
          <p>
            {isTeamRosterMode
              ? "Registered players will appear here as a clean checklist—no screenshot matching required."
              : "Upload and read a screenshot, or manually add players using the field above."}
          </p>
        </div>
      ) : (
        <div className="kit-player-review-list">
          <div
            className={`kit-player-review-columns ${
              isLeaguePlayerMode
                ? "kit-player-review-columns-league-mode"
                : ""
            } ${
              isTeamRosterMode
                ? "kit-player-review-columns-roster-mode"
                : ""
            }`}
          >
            <span>Included</span>
            <span>#</span>

            {isTeamRosterMode ? (
              <span>Player</span>
            ) : (
              <>
                <span>Screenshot name</span>
                {!useOneSharedCarrier && (
                  <span>Cric4All player</span>
                )}
              </>
            )}

            <span>Status</span>
            <span aria-label="Remove" />
          </div>

          {players.map((player, index) => (
            <PlayerReviewRow
              key={player.clientId}
              player={player}
              index={index}
              teamPlayers={databasePlayers}
              isLeaguePlayerMode={isLeaguePlayerMode}
              sourceMode={sourceMode}
              onChange={(changes) =>
                onUpdatePlayer(
                  player.clientId,
                  changes
                )
              }
              onRemove={() =>
                onRemovePlayer(player.clientId)
              }
            />
          ))}
        </div>
      )}
      </div>
    </details>
  );
}

export default function KitResponsibilitySetup({
  matches = [],
  teams = [],
  selectedMatchId = "",
  onSelectedMatchIdChange,
  activeLeague,
  rotationMode = "TEAM",
}) {
  const fileInputRef = useRef(null);

  const [screenshotFile, setScreenshotFile] =
    useState(null);

  const [screenshotPreviewUrl, setScreenshotPreviewUrl] =
    useState("");

  const [screenshotError, setScreenshotError] =
    useState("");

  const [kitMessage, setKitMessage] =
    useState("");

  const [isReadingScreenshot, setIsReadingScreenshot] =
    useState(false);

  const [screenshotOrientation, setScreenshotOrientation] =
    useState("LEFT_TEAM_A");

  const [teamAPlayers, setTeamAPlayers] =
    useState([]);

  const [teamBPlayers, setTeamBPlayers] =
    useState([]);

  const [newTeamAPlayerName, setNewTeamAPlayerName] =
    useState("");

  const [newTeamBPlayerName, setNewTeamBPlayerName] =
    useState("");

  const [isSavingPlayerLists, setIsSavingPlayerLists] =
    useState(false);

  const [
    kitAssignmentRefreshKey,
    setKitAssignmentRefreshKey,
  ] = useState(0);

  const [kitInputMode, setKitInputMode] =
  useState("TEAM_ROSTER");

const [
  selectedRosterTeamId,
  setSelectedRosterTeamId,
] = useState("");

const [
  isLoadingTeamRoster,
  setIsLoadingTeamRoster,
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
  actualCarrierRotationMemberId,
  setActualCarrierRotationMemberId,
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
  pickupSuccess,
  setPickupSuccess,
] = useState("");

const [
  eligibleKitPlayers,
  setEligibleKitPlayers,
] = useState([]);

const isLeaguePlayerMode =
  String(rotationMode || "")
    .trim()
    .toUpperCase() ===
  "LEAGUE_PLAYER";


const normalizedActiveLeagueName =
  String(
    activeLeague?.name || ""
  )
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const isSurpriseCricketLeague =
  normalizedActiveLeagueName ===
  "surprise cricket league";

/*
 * Surprise Cricket League is the explicit one-kit exception.
 * LEAGUE_PLAYER remains supported as the scalable configuration.
 */
const useOneSharedCarrier =
  isSurpriseCricketLeague ||
  isLeaguePlayerMode;

  const availableMatches = useMemo(
    () => matches.filter(isAvailableMatch),
    [matches]
  );

  /*
   * The shared kit always follows the earliest available
   * upcoming match. Users can still change the match, but
   * the normal workflow requires no match selection.
   */
  useEffect(() => {
    if (
      selectedMatchId ||
      availableMatches.length === 0 ||
      typeof onSelectedMatchIdChange !==
        "function"
    ) {
      return;
    }

    const sortedMatches = [
      ...availableMatches,
    ].sort((left, right) => {
      const leftTime =
        new Date(
          left.scheduledAt ||
            left.matchDate ||
            left.createdAt
        ).getTime();

      const rightTime =
        new Date(
          right.scheduledAt ||
            right.matchDate ||
            right.createdAt
        ).getTime();

      const safeLeft =
        Number.isFinite(leftTime)
          ? leftTime
          : Number.MAX_SAFE_INTEGER;

      const safeRight =
        Number.isFinite(rightTime)
          ? rightTime
          : Number.MAX_SAFE_INTEGER;

      return safeLeft - safeRight;
    });

    const nextMatch =
      sortedMatches[0];

    if (nextMatch?.id) {
      onSelectedMatchIdChange(
        String(nextMatch.id)
      );
    }
  }, [
    availableMatches,
    onSelectedMatchIdChange,
    selectedMatchId,
  ]);

  const selectedMatch = useMemo(
    () =>
      matches.find(
        (match) =>
          String(match.id) ===
          String(selectedMatchId)
      ) || null,
    [matches, selectedMatchId]
  );
  const teamAName = getMatchTeamName(
    selectedMatch,
    "A"
  );

  const teamBName = getMatchTeamName(
    selectedMatch,
    "B"
  );

  const teamAId = getMatchTeamId(
    selectedMatch,
    "A"
  );

  const teamBId = getMatchTeamId(
    selectedMatch,
    "B"
  );

  const selectedMatchTeams = useMemo(() => {
  if (!selectedMatch) {
    return [];
  }

  return [
    {
      id: Number(teamAId),
      name: teamAName,
      side: "A",
      players:
        selectedMatch?.teamA?.players ||
        [],
    },
    {
      id: Number(teamBId),
      name: teamBName,
      side: "B",
      players:
        selectedMatch?.teamB?.players ||
        [],
    },
  ].filter(
    (team) =>
      Number.isInteger(team.id) &&
      team.id > 0
  );
}, [
  selectedMatch,
  teamAId,
  teamBId,
  teamAName,
  teamBName,
]);

const selectedRosterTeam =
  selectedMatchTeams.find(
    (team) =>
      String(team.id) ===
      String(selectedRosterTeamId)
  ) || null;

  const teamADatabasePlayers =
    selectedMatch?.teamA?.players || [];

  const teamBDatabasePlayers =
    selectedMatch?.teamB?.players || [];

  useEffect(() => {
    return () => {
      if (screenshotPreviewUrl) {
        URL.revokeObjectURL(
          screenshotPreviewUrl
        );
      }
    };
  }, [screenshotPreviewUrl]);

  useEffect(() => {
    clearImportedScreenshotData({
      preserveSelectedMatch: true,
    });
  }, [selectedMatchId]);

useEffect(() => {
  setSelectedRosterTeamId("");
  setTeamAPlayers([]);
  setTeamBPlayers([]);
  setScreenshotError("");
  setKitMessage("");

  setPickupAssignment(null);
  setPickupStatus("PENDING");
  setActualCarrierMatchPlayerId("");
  setActualCarrierRotationMemberId("");
  setActualCarrierName("");
  setPickupError("");
  setPickupSuccess("");
  setEligibleKitPlayers([]);
}, [selectedMatchId]);

async function saveKitPickup() {
  if (!pickupAssignment?.id) {
    setPickupError(
      "No kit assignment was selected."
    );

    return;
  }

  if (
    pickupStatus !== "TOOK_KIT" &&
    pickupStatus !==
      "DID_NOT_TAKE_KIT"
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
      "Select or enter the person who actually took the kit."
    );

    return;
  }

  setIsSavingPickup(true);
  setPickupAssignment(null);
  setPickupStatus("PENDING");
  setActualCarrierMatchPlayerId("");
  setActualCarrierName("");
  setPickupError("");
  setPickupSuccess("");

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
            actualCarrierRotationMemberId
              ? Number(
                  actualCarrierRotationMemberId
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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "Unable to save kit pickup."
      );
    }

    setPickupSuccess(
      data?.message ||
        "Kit pickup saved successfully."
    );

    /*
     * Replace this with the name of your
     * existing assignment reload function.
     */
/*
 * Refresh KitAssignmentPanel after the pickup
 * result has been saved.
 */
setKitAssignmentRefreshKey(
  (previous) => previous + 1
);

window.setTimeout(() => {
  closeKitPickupForm();
}, 700);
  } catch (error) {
    setPickupError(
      error?.message ||
        "Unable to save kit pickup."
    );
  } finally {
    setIsSavingPickup(false);
  }
}

function openKitPickupForm(assignment) {
  setPickupAssignment(assignment);

  setPickupStatus(
    assignment?.pickupStatus ||
      "PENDING"
  );

  setActualCarrierRotationMemberId(
    assignment?.actualRotationMemberId
      ? String(
          assignment.actualRotationMemberId
        )
      : ""
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
  setPickupSuccess("");
}

function closeKitPickupForm() {
  if (isSavingPickup) {
    return;
  }

  setPickupAssignment(null);
  setPickupStatus("PENDING");
  setActualCarrierRotationMemberId("");
  setActualCarrierMatchPlayerId("");
  setActualCarrierName("");
  setPickupError("");
  setPickupSuccess("");
}

function selectAssignedPersonAsCarrier() {
  if (!pickupAssignment) {
    return;
  }

  const assignedMember =
    pickupAssignment.rotationMember;

  setPickupStatus("TOOK_KIT");

  setActualCarrierRotationMemberId(
    assignedMember?.id
      ? String(assignedMember.id)
      : ""
  );

  const matchingMatchPlayer =
    eligibleKitPlayers.find(
      (player) =>
        Number(player.playerId) > 0 &&
        Number(player.playerId) ===
          Number(assignedMember?.playerId)
    );

  setActualCarrierMatchPlayerId(
    matchingMatchPlayer?.id
      ? String(matchingMatchPlayer.id)
      : ""
  );

  setActualCarrierName(
    assignedMember?.displayName || ""
  );

  setPickupError("");
}

function handleActualCarrierPlayerChange(
  event
) {
  const selectedId = event.target.value;

  setActualCarrierMatchPlayerId(
    selectedId
  );

  const selectedPlayer =
    eligibleKitPlayers.find(
      (player) =>
        String(player.id) ===
        String(selectedId)
    );

  if (!selectedPlayer) {
    setActualCarrierRotationMemberId("");
    return;
  }

  setActualCarrierName(
    selectedPlayer.displayName || ""
  );

  /*
   * Use this when your GET response also
   * returns rotationMemberId on each player.
   */
  setActualCarrierRotationMemberId(
    selectedPlayer.rotationMemberId
      ? String(
          selectedPlayer.rotationMemberId
        )
      : ""
  );

  setPickupStatus("TOOK_KIT");
  setPickupError("");
}

  function clearImportedScreenshotData({
    preserveSelectedMatch = true,
  } = {}) {
    if (screenshotPreviewUrl) {
      URL.revokeObjectURL(
        screenshotPreviewUrl
      );
    }

    setScreenshotFile(null);
    setScreenshotPreviewUrl("");
    setScreenshotError("");
    setKitMessage("");
    setIsReadingScreenshot(false);
    setScreenshotOrientation("LEFT_TEAM_A");
    setTeamAPlayers([]);
    setTeamBPlayers([]);
    setNewTeamAPlayerName("");
    setNewTeamBPlayerName("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (
      !preserveSelectedMatch &&
      typeof onSelectedMatchIdChange ===
        "function"
    ) {
      onSelectedMatchIdChange("");
    }
  }

  function handleScreenshotSelection(event) {
    const file =
      event.target.files?.[0] || null;

    setScreenshotError("");
    setKitMessage("");

    if (!file) {
      return;
    }

    if (!selectedMatch) {
      setScreenshotError(
        "Please select a match before uploading the screenshot."
      );

      event.target.value = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      setScreenshotError(
        "Please upload a PNG, JPG, JPEG, WEBP, or another valid image."
      );

      event.target.value = "";
      return;
    }

    if (
      file.size >
      MAX_SCREENSHOT_SIZE_BYTES
    ) {
      setScreenshotError(
        "The screenshot must be 8 MB or smaller."
      );

      event.target.value = "";
      return;
    }

    if (screenshotPreviewUrl) {
      URL.revokeObjectURL(
        screenshotPreviewUrl
      );
    }

    const nextPreviewUrl =
      URL.createObjectURL(file);

    setScreenshotFile(file);
    setScreenshotPreviewUrl(nextPreviewUrl);
    setTeamAPlayers([]);
    setTeamBPlayers([]);

    setKitMessage(
      "Screenshot loaded. Confirm the left/right team mapping before reading names."
    );
  }

async function handleReadPlayerNames() {
  setScreenshotError("");
  setKitMessage("");

  if (!selectedMatch) {
    setScreenshotError(
      "Please select a match."
    );
    return;
  }

  if (!screenshotFile) {
    setScreenshotError(
      "Please upload the playing-teams screenshot."
    );
    return;
  }

  setIsReadingScreenshot(true);

  try {
    const formData = new FormData();

    formData.append(
      "image",
      screenshotFile,
      screenshotFile.name
    );

    const response = await fetch(
      "/api/kit/read-screenshot",
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "Unable to read player names."
      );
    }

    const leftNames = Array.isArray(
      data?.leftTeam
    )
      ? data.leftTeam
      : [];

    const rightNames = Array.isArray(
      data?.rightTeam
    )
      ? data.rightTeam
      : [];

    if (
      leftNames.length === 0 &&
      rightNames.length === 0
    ) {
      throw new Error(
        "No player names were found in the screenshot."
      );
    }

    const leftPlayers = leftNames.map(
      (name) =>
        createDetectedPlayer({
          name,
          databasePlayers:
            screenshotOrientation ===
            "LEFT_TEAM_A"
              ? teamADatabasePlayers
              : teamBDatabasePlayers,
          isLeaguePlayerMode,
        })
    );

    const rightPlayers = rightNames.map(
      (name) =>
        createDetectedPlayer({
          name,
          databasePlayers:
            screenshotOrientation ===
            "LEFT_TEAM_A"
              ? teamBDatabasePlayers
              : teamADatabasePlayers,
          isLeaguePlayerMode,
        })
    );

    if (
      screenshotOrientation ===
      "LEFT_TEAM_A"
    ) {
      setTeamAPlayers(leftPlayers);
      setTeamBPlayers(rightPlayers);
    } else {
      setTeamAPlayers(rightPlayers);
      setTeamBPlayers(leftPlayers);
    }

    const teamACount =
      screenshotOrientation ===
      "LEFT_TEAM_A"
        ? leftPlayers.length
        : rightPlayers.length;

    const teamBCount =
      screenshotOrientation ===
      "LEFT_TEAM_A"
        ? rightPlayers.length
        : leftPlayers.length;

    const warningText =
      Array.isArray(data?.warnings) &&
      data.warnings.length > 0
        ? ` Review warning: ${data.warnings.join(
            " "
          )}`
        : "";

    setKitMessage(
      `Player names read successfully. ` +
        `${teamACount} detected for ${teamAName} and ` +
        `${teamBCount} detected for ${teamBName}. ` +
        `Confidence: ${data?.confidence || "MEDIUM"}. ` +
        `Please review every name before saving.` +
        warningText
    );
 } catch (error) {
  console.error(
    "Read kit screenshot failed:",
    error
  );

  setScreenshotError(
    error?.message ||
      "Unable to read player names from the screenshot. You can enter them manually."
  );
} finally {
  setIsReadingScreenshot(false);
}
}

  function setAllTeamPlayersIncluded(
    side,
    included
  ) {
    const setter =
      side === "A"
        ? setTeamAPlayers
        : setTeamBPlayers;

    setter((currentPlayers) =>
      currentPlayers.map(
        (player) => ({
          ...player,
          included,
        })
      )
    );

    setScreenshotError("");
    setKitMessage(
      included
        ? `Selected every player for ${
            side === "A"
              ? teamAName
              : teamBName
          }.`
        : `Cleared every player for ${
            side === "A"
              ? teamAName
              : teamBName
          }. Choose only the players participating in this match.`
    );
  }

  function updateTeamPlayer(
    side,
    clientId,
    changes
  ) {
    const setter =
      side === "A"
        ? setTeamAPlayers
        : setTeamBPlayers;

    setter((previousPlayers) =>
      previousPlayers.map((player) =>
        player.clientId === clientId
          ? {
              ...player,
              ...changes,
            }
          : player
      )
    );
  }

  function removeTeamPlayer(
    side,
    clientId
  ) {
    const setter =
      side === "A"
        ? setTeamAPlayers
        : setTeamBPlayers;

    setter((previousPlayers) =>
      previousPlayers.filter(
        (player) =>
          player.clientId !== clientId
      )
    );
  }

  function addManualPlayer(side) {
    const isTeamA = side === "A";

    const rawName = isTeamA
      ? newTeamAPlayerName
      : newTeamBPlayerName;

    const trimmedName =
      rawName.trim();

    if (!trimmedName) {
      setScreenshotError(
        `Enter a player name for ${
          isTeamA ? teamAName : teamBName
        }.`
      );

      return;
    }

    const setter = isTeamA
      ? setTeamAPlayers
      : setTeamBPlayers;

    setter((previousPlayers) => [
      ...previousPlayers,
      createTemporaryPlayer(trimmedName),
    ]);

    if (isTeamA) {
      setNewTeamAPlayerName("");
    } else {
      setNewTeamBPlayerName("");
    }

    setScreenshotError("");

    setKitMessage(
      `${trimmedName} added to ${
        isTeamA ? teamAName : teamBName
      }.`
    );
  }

  function swapTeamLists() {
    setTeamAPlayers(teamBPlayers);
    setTeamBPlayers(teamAPlayers);

    setScreenshotOrientation(
      (previous) =>
        previous === "LEFT_TEAM_A"
          ? "LEFT_TEAM_B"
          : "LEFT_TEAM_A"
    );

    setKitMessage(
      "The screenshot team sides have been swapped."
    );
  }

  async function loadBothTeamRosters() {
  setScreenshotError("");
  setKitMessage("");

  if (!selectedMatch) {
    setScreenshotError(
      "No upcoming match is available."
    );
    return;
  }

  const teamARoster =
    Array.isArray(
      selectedMatchTeams.find(
        (team) =>
          Number(team.id) ===
          Number(teamAId)
      )?.players
    )
      ? selectedMatchTeams.find(
          (team) =>
            Number(team.id) ===
            Number(teamAId)
        ).players
      : [];

  const teamBRoster =
    Array.isArray(
      selectedMatchTeams.find(
        (team) =>
          Number(team.id) ===
          Number(teamBId)
      )?.players
    )
      ? selectedMatchTeams.find(
          (team) =>
            Number(team.id) ===
            Number(teamBId)
        ).players
      : [];

  if (
    teamARoster.length === 0 &&
    teamBRoster.length === 0
  ) {
    setScreenshotError(
      "Neither playing team has registered players."
    );
    return;
  }

  setIsLoadingTeamRoster(true);

  try {
    const toReviewPlayers =
      (players) =>
        players.map(
          (player) => ({
            ...createTemporaryPlayer(
              player.name
            ),

            playerId:
              String(player.id),

            displayName:
              player.name,

            matchStatus:
              "MATCHED",
          })
        );

    const nextTeamAPlayers =
      toReviewPlayers(
        teamARoster
      );

    const nextTeamBPlayers =
      toReviewPlayers(
        teamBRoster
      );

    setTeamAPlayers(
      nextTeamAPlayers
    );

    setTeamBPlayers(
      nextTeamBPlayers
    );

    setSelectedRosterTeamId(
      ""
    );

    setKitMessage(
      `Loaded ${nextTeamAPlayers.length} players for ${teamAName} and ${nextTeamBPlayers.length} players for ${teamBName}. Uncheck anyone who is not playing, then save both teams once.`
    );
  } catch (error) {
    setScreenshotError(
      error?.message ||
        "Unable to load the two playing-team rosters."
    );
  } finally {
    setIsLoadingTeamRoster(false);
  }
}

const isTeamRosterWorkflow =
  kitInputMode === "TEAM_ROSTER";


  useEffect(() => {
    if (
      !selectedMatch ||
      !isTeamRosterWorkflow
    ) {
      return;
    }

    loadBothTeamRosters();
    // The selected match already supplies both team rosters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedMatch?.id,
    isTeamRosterWorkflow,
  ]);

  async function validateReviewData() {
  setScreenshotError("");
  setKitMessage("");

  if (!selectedMatch) {
    setScreenshotError("Please select a match.");
    return;
  }

  if (!teamAId || !teamBId) {
    setScreenshotError(
      "The selected match does not have valid team ids."
    );
    return;
  }

  const includedTeamAPlayers =
    teamAPlayers.filter(
      (player) =>
        player.included &&
        String(
          player.displayName || ""
        ).trim()
    );

  const includedTeamBPlayers =
    teamBPlayers.filter(
      (player) =>
        player.included &&
        String(
          player.displayName || ""
        ).trim()
    );

  const mapPlayerForSave = (player) => ({
    displayName: String(
      player.displayName || ""
    ).trim(),

    playerId: player.playerId
      ? Number(player.playerId)
      : null,

    included: true,
    isEligible: true,
  });

  let teamsToSave = [];

  if (isTeamRosterWorkflow) {
    if (
      includedTeamAPlayers.length === 0
    ) {
      setScreenshotError(
        `Select at least one eligible player for ${teamAName}.`
      );
      return;
    }

    if (
      includedTeamBPlayers.length === 0
    ) {
      setScreenshotError(
        `Select at least one eligible player for ${teamBName}.`
      );
      return;
    }

    teamsToSave = [
      {
        teamId:
          Number(teamAId),

        players:
          includedTeamAPlayers.map(
            mapPlayerForSave
          ),
      },
      {
        teamId:
          Number(teamBId),

        players:
          includedTeamBPlayers.map(
            mapPlayerForSave
          ),
      },
    ];
  } else {
    if (
      includedTeamAPlayers.length === 0
    ) {
      setScreenshotError(
        `Add at least one eligible player for ${teamAName}.`
      );
      return;
    }

    if (
      includedTeamBPlayers.length === 0
    ) {
      setScreenshotError(
        `Add at least one eligible player for ${teamBName}.`
      );
      return;
    }

    teamsToSave = [
      {
        teamId: Number(teamAId),

        players:
          includedTeamAPlayers.map(
            mapPlayerForSave
          ),
      },
      {
        teamId: Number(teamBId),

        players:
          includedTeamBPlayers.map(
            mapPlayerForSave
          ),
      },
    ];
  }

  const payload = {
    sourceMode: isTeamRosterWorkflow
      ? "TEAM_ROSTER"
      : "SCREENSHOT",

    teams: teamsToSave,
  };

  setIsSavingPlayerLists(true);

  try {
    const response = await fetch(
      `/api/matches/${selectedMatch.id}/kit-players`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "Unable to save the confirmed player list."
      );
    }

    const successMessage =
      `Saved ${
        includedTeamAPlayers.length
      } players for ${teamAName} and ${
        includedTeamBPlayers.length
      } players for ${teamBName}.`;

    setKitMessage(
      data?.message || successMessage
    );

    setKitAssignmentRefreshKey(
      (previous) => previous + 1
    );
  } catch (error) {
    setScreenshotError(
      error?.message ||
        "Unable to save the confirmed player list."
    );
  } finally {
    setIsSavingPlayerLists(false);
  }
}

  const hasReviewPlayers =
    teamAPlayers.length > 0 ||
    teamBPlayers.length > 0;
const handleKitAssignmentMessage =
  useCallback((nextMessage) => {
    setKitMessage(nextMessage);
    setScreenshotError("");
  }, []);

const handleKitAssignmentError =
  useCallback((nextError) => {
    setScreenshotError(nextError);
    setKitMessage("");
  }, []);
  return (
    <section className="kit-responsibility-card">
      <div className="kit-responsibility-heading">
        <div>
          <span className="kit-section-kicker">
            Guided shared-kit workflow
          </span>

          <h3>
            🧳 Kit Responsibility
          </h3>

          <p>
            Cric4All automatically selects the earliest upcoming match, loads both playing teams together, and guides you through one confirmation before suggesting the responsible carrier.
          </p>
        </div>

        <div className="kit-feature-badge">
          One shared league kit
        </div>
      </div>

      {activeLeague?.name && (
        <div className="kit-league-notice">
          <strong>
            League: {activeLeague.name}
          </strong>

          {useOneSharedCarrier && (
            <span>
              One shared-kit carrier is selected for the entire match. The same player may appear in both Surprise teams, but Cric4All treats that person as one league-wide rotation identity.
            </span>
          )}
        </div>
      )}

      <div className="kit-active-match-card">
        <div className="kit-active-match-primary">
          <span className="kit-section-kicker">
            Active kit match
          </span>

          {selectedMatch ? (
            <>
              <strong>
                {teamAName} vs {teamBName}
              </strong>

              <small>
                {formatMatchDate(
                  selectedMatch.scheduledAt ||
                    selectedMatch.matchDate ||
                    selectedMatch.createdAt
                )}
              </small>
            </>
          ) : (
            <>
              <strong>
                No upcoming match
              </strong>

              <small>
                Schedule a future match to start the kit workflow.
              </small>
            </>
          )}
        </div>

        {availableMatches.length > 1 && (
          <details className="kit-change-match">
            <summary>
              Change match
            </summary>

            <label className="kit-form-field">
              <span>
                Upcoming match
              </span>

              <select
                value={
                  selectedMatchId
                }
                onChange={(
                  event
                ) => {
                  if (
                    typeof onSelectedMatchIdChange ===
                    "function"
                  ) {
                    onSelectedMatchIdChange(
                      event.target.value
                    );
                  }
                }}
              >
                {availableMatches.map(
                  (match) => (
                    <option
                      key={
                        match.id
                      }
                      value={
                        match.id
                      }
                    >
                      {getMatchTeamName(
                        match,
                        "A"
                      )}{" "}
                      vs{" "}
                      {getMatchTeamName(
                        match,
                        "B"
                      )}{" "}
                      —{" "}
                      {formatMatchDate(
                        match.scheduledAt ||
                          match.matchDate ||
                          match.createdAt
                      )}
                    </option>
                  )
                )}
              </select>
            </label>
          </details>
        )}
      </div>

      <div className="kit-source-mode-card">
  <div className="kit-source-mode-heading">
    <div>
      <span className="kit-section-kicker">
        Player source
      </span>

      <h4>
        How do you want to choose eligible players?
      </h4>

      <p>
        Read today’s playing teams from a screenshot,
        or use an existing Cric4All team roster.
      </p>
    </div>
  </div>

  <div className="kit-source-mode-options">
    <button
      type="button"
      className={`kit-source-mode-option ${
        kitInputMode === "SCREENSHOT"
          ? "active"
          : ""
      }`}
      onClick={() => {
        setKitInputMode("SCREENSHOT");
        setSelectedRosterTeamId("");
        setScreenshotError("");
        setKitMessage("");
      }}
    >
      <span className="kit-source-mode-icon">
        📷
      </span>

      <span>
        <strong>Scan Playing-Team Screenshot</strong>
        <small>
          Read both playing teams from one screenshot.
        </small>
      </span>
    </button>

    <button
      type="button"
      className={`kit-source-mode-option ${
        kitInputMode === "TEAM_ROSTER"
          ? "active"
          : ""
      }`}
      onClick={() => {
        setKitInputMode("TEAM_ROSTER");
        setScreenshotError("");
        setKitMessage("");
      }}
    >
      <span className="kit-source-mode-icon">
        👥
      </span>

      <span>
        <strong>Use Both Team Rosters</strong>
        <small>
          Automatically load both playing teams’ saved rosters in one step.
        </small>
      </span>
    </button>
  </div>
</div>

      {!selectedMatch && (
        <div className="kit-info-message">
          Select the match before uploading its
          playing-team screenshot.
        </div>
      )}

      {kitInputMode === "SCREENSHOT" && (
        <>
          <div className="kit-upload-layout">
            <div className="kit-upload-controls">
              <label className="kit-upload-box">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={
                    handleScreenshotSelection
                  }
                />

                <span className="kit-upload-icon">
                  📷
                </span>

                <strong>
                  Upload Playing Teams Screenshot
                </strong>

                <small>
                  PNG, JPG, JPEG, or WEBP — maximum
                  8 MB
                </small>

                <span className="kit-upload-action">
                  Choose Screenshot
                </span>
              </label>

              {screenshotFile && (
                <div className="kit-file-summary">
                  <div>
                    <strong>
                      {screenshotFile.name}
                    </strong>

                    <span>
                      {(
                        screenshotFile.size /
                        1024 /
                        1024
                      ).toFixed(2)}{" "}
                      MB
                    </span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() =>
                      clearImportedScreenshotData({
                        preserveSelectedMatch: true,
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              )}

              <div className="kit-orientation-card">
                <div>
                  <strong>
                    Confirm screenshot sides
                  </strong>

                  <p>
                    Tell Cric4All which match team
                    appears on the left and right.
                  </p>
                </div>

                <label>
                  <input
                    type="radio"
                    name="kitScreenshotOrientation"
                    value="LEFT_TEAM_A"
                    checked={
                      screenshotOrientation ===
                      "LEFT_TEAM_A"
                    }
                    onChange={(event) =>
                      setScreenshotOrientation(
                        event.target.value
                      )
                    }
                  />

                  <span>
                    Left: {teamAName}
                    <br />
                    Right: {teamBName}
                  </span>
                </label>

                <label>
                  <input
                    type="radio"
                    name="kitScreenshotOrientation"
                    value="LEFT_TEAM_B"
                    checked={
                      screenshotOrientation ===
                      "LEFT_TEAM_B"
                    }
                    onChange={(event) =>
                      setScreenshotOrientation(
                        event.target.value
                      )
                    }
                  />

                  <span>
                    Left: {teamBName}
                    <br />
                    Right: {teamAName}
                  </span>
                </label>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={swapTeamLists}
                  disabled={!hasReviewPlayers}
                >
                  ⇄ Swap Current Player Lists
                </button>
              </div>

              <button
                type="button"
                className="btn kit-read-screenshot-btn"
                onClick={handleReadPlayerNames}
                disabled={
                  !screenshotFile ||
                  isReadingScreenshot
                }
              >
                {isReadingScreenshot
                  ? "Reading Screenshot..."
                  : "🔎 Read Player Names"}
              </button>
            </div>

            <div className="kit-preview-panel">
              <div className="kit-preview-heading">
                <strong>Screenshot preview</strong>

                <span>
                  {screenshotOrientation ===
                  "LEFT_TEAM_A"
                    ? `${teamAName} ← left | right → ${teamBName}`
                    : `${teamBName} ← left | right → ${teamAName}`}
                </span>
              </div>

              {screenshotPreviewUrl ? (
                <img
                  src={screenshotPreviewUrl}
                  alt="Playing teams screenshot preview"
                  className="kit-screenshot-preview"
                />
              ) : (
                <div className="kit-empty-preview">
                  <span>🖼️</span>

                  <strong>
                    No screenshot selected
                  </strong>

                  <p>
                    The uploaded playing-team image
                    will appear here.
                  </p>
                </div>
              )}
            </div>
          </div>

          {screenshotError && (
            <div className="kit-error-message">
              {screenshotError}
            </div>
          )}

          {kitMessage && (
            <div className="kit-success-message">
              {kitMessage}
            </div>
          )}
          {hasReviewPlayers ? (
            <>
              <div className="kit-team-review-grid kit-team-review-grid-screenshot">
                <TeamPlayerReview
                  sourceMode={kitInputMode}
                  title={teamAName}
                  teamId={teamAId}
                  players={teamAPlayers}
                  databasePlayers={teamADatabasePlayers}
                  isLeaguePlayerMode={isLeaguePlayerMode}
                  newPlayerName={newTeamAPlayerName}
                  onNewPlayerNameChange={setNewTeamAPlayerName}
                  onAddPlayer={() => addManualPlayer("A")}
                  onUpdatePlayer={(clientId, changes) =>
                    updateTeamPlayer("A", clientId, changes)
                  }
                  onRemovePlayer={(clientId) =>
                    removeTeamPlayer("A", clientId)
                  }
                  onSetAllIncluded={(included) =>
                    setAllTeamPlayersIncluded(
                      "A",
                      included
                    )
                  }
                />

                <TeamPlayerReview
                  sourceMode={kitInputMode}
                  title={teamBName}
                  teamId={teamBId}
                  players={teamBPlayers}
                  databasePlayers={teamBDatabasePlayers}
                  isLeaguePlayerMode={isLeaguePlayerMode}
                  newPlayerName={newTeamBPlayerName}
                  onNewPlayerNameChange={setNewTeamBPlayerName}
                  onAddPlayer={() => addManualPlayer("B")}
                  onUpdatePlayer={(clientId, changes) =>
                    updateTeamPlayer("B", clientId, changes)
                  }
                  onRemovePlayer={(clientId) =>
                    removeTeamPlayer("B", clientId)
                  }
                  onSetAllIncluded={(included) =>
                    setAllTeamPlayersIncluded(
                      "B",
                      included
                    )
                  }
                />
              </div>

              <div className="kit-review-actions kit-review-actions-premium">
                <div>
                  <strong>Both teams are ready for review</strong>
                  <p>
                    {useOneSharedCarrier
                      ? `Today’s screenshot controls eligibility, while each player’s history follows them across ${teamAName} and ${teamBName}.`
                      : `Kit responsibility rotates independently for ${teamAName} and ${teamBName}.`}
                  </p>
                </div>

                <button
                  type="button"
                  className="btn kit-confirm-review-btn"
                  onClick={validateReviewData}
                  disabled={isSavingPlayerLists}
                >
                  {isSavingPlayerLists
                    ? "Saving Player Lists..."
                    : "✓ Confirm & Save Both Teams"}
                </button>
              </div>
            </>
          ) : (
            <div className="kit-workflow-placeholder">
              <div className="kit-workflow-placeholder-icon">✨</div>
              <div>
                <strong>Your player review will appear here</strong>
                <p>
                  Upload the screenshot, confirm the left/right teams, then click <b>Read Player Names</b>.
                </p>
              </div>
            </div>
          )}

          <KitAssignmentPanel
            matchId={selectedMatch?.id}
            refreshKey={kitAssignmentRefreshKey}
            selectedTeamId=""
            sourceMode="SCREENSHOT"
            onMessage={handleKitAssignmentMessage}
            onError={handleKitAssignmentError}
          />
        </>
      )}
      {kitInputMode === "TEAM_ROSTER" && (
        <section className="kit-roster-mode-card">
          <div className="kit-roster-mode-heading">
            <div>
              <span className="kit-section-kicker">
                One-step roster setup
              </span>

              <h4>
                Confirm both playing teams
              </h4>

              <p>
                Both registered rosters are loaded automatically from the active match. Uncheck players who are not playing, then save once.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-outline"
              disabled={
                isLoadingTeamRoster ||
                !selectedMatch
              }
              onClick={
                loadBothTeamRosters
              }
            >
              {isLoadingTeamRoster
                ? "Loading Both Rosters..."
                : "↻ Reload Both Rosters"}
            </button>
          </div>

          {useOneSharedCarrier && (
            <div className="kit-shared-league-exception">
              <span>🏏</span>

              <div>
                <strong>
                  One shared-kit assignment for both teams
                </strong>

                <p>
                  This league uses a league-wide player rotation. Even when the same players appear under both teams, Cric4All combines them into one unique pool and shows one suggested kit carrier for the match.
                </p>
              </div>
            </div>
          )}

          <div className="kit-wizard-progress">
            <span className="is-complete">
              <b>1</b>
              Match selected
            </span>

            <span
              className={
                hasReviewPlayers
                  ? "is-complete"
                  : "is-active"
              }
            >
              <b>2</b>
              Confirm players
            </span>

            <span
              className={
                hasReviewPlayers
                  ? "is-active"
                  : ""
              }
            >
              <b>3</b>
              Save and assign
            </span>
          </div>

          <div className="kit-roster-team-overview">
            <article>
              <span>
                Team A
              </span>

              <strong>
                {teamAName}
              </strong>

              <small>
                {
                  teamAPlayers.filter(
                    (player) =>
                      player.included
                  ).length
                }{" "}
                selected of{" "}
                {teamAPlayers.length}
              </small>
            </article>

            <div className="kit-versus-badge">
              VS
            </div>

            <article>
              <span>
                Team B
              </span>

              <strong>
                {teamBName}
              </strong>

              <small>
                {
                  teamBPlayers.filter(
                    (player) =>
                      player.included
                  ).length
                }{" "}
                selected of{" "}
                {teamBPlayers.length}
              </small>
            </article>
          </div>

          {screenshotError && (
            <div className="kit-error-message">
              {screenshotError}
            </div>
          )}

          {kitMessage && (
            <div className="kit-success-message">
              {kitMessage}
            </div>
          )}

          {hasReviewPlayers ? (
            <>
              <div className="kit-team-review-grid">
                <TeamPlayerReview
                  sourceMode="TEAM_ROSTER"
                  title={teamAName}
                  teamId={teamAId}
                  players={teamAPlayers}
                  databasePlayers={
                    teamADatabasePlayers
                  }
                  isLeaguePlayerMode={
                    useOneSharedCarrier
                  }
                  newPlayerName={
                    newTeamAPlayerName
                  }
                  onNewPlayerNameChange={
                    setNewTeamAPlayerName
                  }
                  onAddPlayer={() =>
                    addManualPlayer("A")
                  }
                  onUpdatePlayer={(
                    clientId,
                    changes
                  ) =>
                    updateTeamPlayer(
                      "A",
                      clientId,
                      changes
                    )
                  }
                  onRemovePlayer={(
                    clientId
                  ) =>
                    removeTeamPlayer(
                      "A",
                      clientId
                    )
                  }
                  onSetAllIncluded={(
                    included
                  ) =>
                    setAllTeamPlayersIncluded(
                      "A",
                      included
                    )
                  }
                />

                <TeamPlayerReview
                  sourceMode="TEAM_ROSTER"
                  title={teamBName}
                  teamId={teamBId}
                  players={teamBPlayers}
                  databasePlayers={
                    teamBDatabasePlayers
                  }
                  isLeaguePlayerMode={
                    useOneSharedCarrier
                  }
                  newPlayerName={
                    newTeamBPlayerName
                  }
                  onNewPlayerNameChange={
                    setNewTeamBPlayerName
                  }
                  onAddPlayer={() =>
                    addManualPlayer("B")
                  }
                  onUpdatePlayer={(
                    clientId,
                    changes
                  ) =>
                    updateTeamPlayer(
                      "B",
                      clientId,
                      changes
                    )
                  }
                  onRemovePlayer={(
                    clientId
                  ) =>
                    removeTeamPlayer(
                      "B",
                      clientId
                    )
                  }
                  onSetAllIncluded={(
                    included
                  ) =>
                    setAllTeamPlayersIncluded(
                      "B",
                      included
                    )
                  }
                />
              </div>

              <div className="kit-review-actions kit-review-actions-premium">
                <div>
                  <strong>
                    Both teams are ready
                  </strong>

                  <p>
                    {useOneSharedCarrier
                      ? `Save both playing lists together. Because ${activeLeague?.name || "this league"} uses one shared kit and a league-wide player rotation, Cric4All will show only one suggested carrier box for the entire match. Duplicate players appearing under both teams are considered one person in the rotation.`
                      : "Save both confirmed player lists together. Cric4All will calculate the appropriate kit carrier assignment for each team."}
                  </p>
                </div>

                <button
                  type="button"
                  className="btn kit-confirm-review-btn"
                  onClick={
                    validateReviewData
                  }
                  disabled={
                    isSavingPlayerLists
                  }
                >
                  {isSavingPlayerLists
                    ? "Saving Both Teams..."
                    : "✓ Save Both Teams & Continue"}
                </button>
              </div>

              <KitAssignmentPanel
                matchId={
                  selectedMatch?.id
                }
                refreshKey={
                  kitAssignmentRefreshKey
                }
                selectedTeamId=""
                sourceMode="TEAM_ROSTER"
                forceSharedKit={
                  useOneSharedCarrier
                }
                onMessage={
                  handleKitAssignmentMessage
                }
                onError={
                  handleKitAssignmentError
                }
              />
            </>
          ) : (
            <div className="kit-workflow-placeholder">
              <div className="kit-workflow-placeholder-icon">
                👥
              </div>

              <div>
                <strong>
                  No registered players loaded
                </strong>

                <p>
                  Add players to the two teams or use the screenshot option for today’s playing lists.
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      <style jsx global>{`
        .kit-responsibility-card {
          --kit-glow: rgba(34, 197, 94, 0.28);
          --kit-cyan: rgba(14, 165, 233, 0.22);
        }

        .kit-team-review-details {
          padding: 0 !important;
          overflow: hidden;
        }

        .kit-team-review-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          min-height: 76px;
          padding: 14px 16px;
          cursor: pointer;
          list-style: none;
          user-select: none;
          background:
            linear-gradient(
              135deg,
              rgba(56, 189, 248, 0.08),
              rgba(99, 102, 241, 0.05)
            );
        }

        .kit-team-review-summary::-webkit-details-marker {
          display: none;
        }

        .kit-team-review-details[open]
          > .kit-team-review-summary {
          border-bottom: 1px solid
            rgba(148, 163, 184, 0.24);
        }

        .kit-team-review-summary-main {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .kit-team-review-summary-main > div {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .kit-team-review-summary-main h4 {
          margin: 0;
        }

        .kit-team-review-summary-main small {
          opacity: 0.72;
        }

        .kit-team-review-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          flex: 0 0 auto;
          border-radius: 13px;
          background: rgba(56, 189, 248, 0.12);
          border: 1px solid rgba(56, 189, 248, 0.18);
        }

        .kit-team-review-summary-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex: 0 0 auto;
        }

        .kit-team-bulk-btn {
          min-height: 34px;
          padding: 6px 10px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.18);
          color: inherit;
          font: inherit;
          font-size: 0.76rem;
          font-weight: 700;
          cursor: pointer;
        }

        .kit-team-bulk-btn:hover:not(:disabled) {
          border-color: rgba(56, 189, 248, 0.52);
          background: rgba(56, 189, 248, 0.1);
        }

        .kit-team-bulk-btn:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }

        .kit-team-review-chevron {
          display: inline-block;
          transition: transform 0.2s ease;
        }

        .kit-team-review-details[open]
          .kit-team-review-chevron {
          transform: rotate(180deg);
        }

        .kit-team-review-body {
          padding: 16px;
          animation: kitTeamReveal 0.2s ease;
        }

        @keyframes kitTeamReveal {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .kit-shared-league-exception {
          display: flex;
          gap: 12px;
          margin: 16px 0;
          padding: 14px;
          border: 1px solid rgba(34, 197, 94, 0.34);
          border-radius: 14px;
          background:
            linear-gradient(
              135deg,
              rgba(34, 197, 94, 0.09),
              rgba(56, 189, 248, 0.06)
            );
        }

        .kit-shared-league-exception > span {
          font-size: 1.25rem;
        }

        .kit-shared-league-exception strong {
          display: block;
          margin-bottom: 4px;
        }

        .kit-shared-league-exception p {
          margin: 0;
          line-height: 1.5;
          opacity: 0.8;
        }

        .kit-active-match-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin: 18px 0;
          padding: 18px;
          border: 1px solid rgba(56, 189, 248, 0.3);
          border-radius: 18px;
          background:
            radial-gradient(
              circle at 10% 20%,
              rgba(56, 189, 248, 0.12),
              transparent 34%
            ),
            rgba(15, 23, 42, 0.32);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 16px 34px rgba(2, 6, 23, 0.18);
        }

        .kit-active-match-primary {
          display: grid;
          gap: 5px;
        }

        .kit-active-match-primary strong {
          font-size: 1.15rem;
        }

        .kit-active-match-primary small {
          opacity: 0.74;
        }

        .kit-change-match {
          min-width: min(100%, 320px);
        }

        .kit-change-match summary {
          cursor: pointer;
          font-weight: 700;
          text-align: right;
        }

        .kit-change-match[open] summary {
          margin-bottom: 10px;
        }

        .kit-wizard-progress {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin: 18px 0;
        }

        .kit-wizard-progress span {
          display: flex;
          align-items: center;
          gap: 9px;
          min-height: 46px;
          padding: 10px 12px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          border-radius: 12px;
          opacity: 0.66;
        }

        .kit-wizard-progress b {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: rgba(148, 163, 184, 0.14);
        }

        .kit-wizard-progress .is-active {
          opacity: 1;
          border-color: rgba(56, 189, 248, 0.48);
          background: rgba(56, 189, 248, 0.08);
        }

        .kit-wizard-progress .is-complete {
          opacity: 1;
          border-color: rgba(34, 197, 94, 0.4);
          background: rgba(34, 197, 94, 0.08);
        }

        .kit-roster-team-overview {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
        }

        .kit-roster-team-overview article {
          display: grid;
          gap: 5px;
          padding: 15px;
          border: 1px solid rgba(148, 163, 184, 0.26);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.22);
        }

        .kit-roster-team-overview article span,
        .kit-roster-team-overview article small {
          opacity: 0.72;
        }

        .kit-versus-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          font-size: 0.78rem;
          font-weight: 800;
          background: linear-gradient(
            145deg,
            rgba(34, 197, 94, 0.2),
            rgba(56, 189, 248, 0.2)
          );
        }

        .kit-source-mode-card,
        .kit-roster-mode-card,
        .kit-team-review-card,
        .kit-workflow-placeholder {
          position: relative;
          overflow: hidden;
        }

        .kit-source-mode-card::before,
        .kit-roster-mode-card::before {
          content: "";
          position: absolute;
          inset: 0 auto auto 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #22c55e, #38bdf8, transparent);
          opacity: 0.8;
        }

        .kit-source-mode-options {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .kit-source-mode-option {
          min-height: 104px;
          transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .kit-source-mode-option:hover {
          transform: translateY(-2px);
        }

        .kit-source-mode-option.active {
          box-shadow: 0 16px 38px var(--kit-glow), inset 0 0 0 1px rgba(74, 222, 128, 0.22);
        }

        .kit-roster-steps {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin: 18px 0;
        }

        .kit-roster-steps span {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 44px;
          padding: 9px 11px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.48);
          color: #94a3b8;
          font-size: 0.78rem;
          font-weight: 700;
        }

        .kit-roster-steps b {
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          flex: 0 0 24px;
          border-radius: 999px;
          background: rgba(51, 65, 85, 0.85);
          color: #e2e8f0;
        }

        .kit-roster-steps span.is-active {
          border-color: rgba(56, 189, 248, 0.45);
          color: #e0f2fe;
          box-shadow: 0 10px 24px var(--kit-cyan);
        }

        .kit-roster-steps span.is-active b {
          background: #0284c7;
          color: white;
        }

        .kit-roster-steps span.is-complete {
          border-color: rgba(34, 197, 94, 0.38);
          color: #bbf7d0;
        }

        .kit-roster-steps span.is-complete b {
          background: #16a34a;
          color: white;
        }

        .kit-player-review-columns-roster-mode,
        .kit-player-review-row-roster-mode {
          grid-template-columns: 90px 38px minmax(230px, 1fr) 126px 42px !important;
        }

        .kit-roster-player-identity {
          display: flex;
          align-items: center;
          gap: 11px;
          min-height: 42px;
          padding: 7px 10px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 11px;
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(30, 41, 59, 0.55));
        }

        .kit-roster-player-identity > span:last-child {
          display: flex;
          min-width: 0;
          flex-direction: column;
        }

        .kit-roster-player-identity strong {
          overflow: hidden;
          color: #f8fafc;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .kit-roster-player-identity small {
          color: #7dd3fc;
          font-size: 0.7rem;
        }

        .kit-roster-avatar {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          flex: 0 0 32px;
          border-radius: 10px;
          background: linear-gradient(135deg, #16a34a, #0284c7);
          color: white;
          font-weight: 900;
          box-shadow: 0 8px 20px rgba(2, 132, 199, 0.25);
        }

        .kit-player-match-status.is-registered {
          color: #86efac;
          font-weight: 800;
        }

        .kit-player-match-status.is-registered .kit-player-match-status-dot {
          background: #22c55e;
          box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.13), 0 0 14px rgba(34, 197, 94, 0.55);
        }

        .kit-team-review-card-roster {
          border-color: rgba(34, 197, 94, 0.24);
          box-shadow: 0 18px 42px rgba(2, 6, 23, 0.22);
        }

        .kit-workflow-placeholder {
          display: flex;
          align-items: center;
          gap: 16px;
          min-height: 120px;
          margin-top: 18px;
          padding: 22px;
          border: 1px dashed rgba(56, 189, 248, 0.34);
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(34, 197, 94, 0.06));
        }

        .kit-workflow-placeholder-icon {
          display: grid;
          place-items: center;
          width: 52px;
          height: 52px;
          flex: 0 0 52px;
          border-radius: 16px;
          background: rgba(14, 165, 233, 0.13);
          font-size: 1.5rem;
          box-shadow: 0 12px 28px rgba(14, 165, 233, 0.16);
        }

        .kit-workflow-placeholder strong {
          color: #f8fafc;
          font-size: 1rem;
        }

        .kit-workflow-placeholder p {
          margin: 5px 0 0;
          color: #93c5fd;
          line-height: 1.5;
        }

        .kit-review-actions-premium {
          border-color: rgba(34, 197, 94, 0.34);
          background: linear-gradient(135deg, rgba(6, 78, 59, 0.28), rgba(8, 47, 73, 0.28));
          box-shadow: 0 16px 38px rgba(2, 6, 23, 0.2);
        }

        @media (max-width: 900px) {
          .kit-roster-steps {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .kit-source-mode-options {
            grid-template-columns: 1fr;
          }

          .kit-source-mode-option {
            min-height: 88px;
          }

          .kit-roster-steps {
            display: flex;
            overflow-x: auto;
            gap: 8px;
            padding-bottom: 4px;
            scrollbar-width: thin;
          }

          .kit-roster-steps span {
            min-width: 142px;
          }

          .kit-player-review-columns-roster-mode {
            display: none !important;
          }

          .kit-player-review-row-roster-mode {
            display: grid !important;
            grid-template-columns: 1fr auto !important;
            gap: 10px !important;
            padding: 14px !important;
            border: 1px solid rgba(148, 163, 184, 0.14);
            border-radius: 14px;
            background: rgba(15, 23, 42, 0.58);
          }

          .kit-player-review-row-roster-mode .kit-player-include {
            grid-column: 1;
            grid-row: 1;
          }

          .kit-player-review-row-roster-mode .kit-player-number {
            grid-column: 2;
            grid-row: 1;
          }

          .kit-player-review-row-roster-mode .kit-roster-player-cell {
            grid-column: 1 / -1;
            grid-row: 2;
          }

          .kit-player-review-row-roster-mode .kit-player-match-status {
            grid-column: 1;
            grid-row: 3;
            justify-self: start;
          }

          .kit-player-review-row-roster-mode .kit-remove-player-btn {
            grid-column: 2;
            grid-row: 3;
            justify-self: end;
          }

          .kit-roster-player-identity {
            min-height: 52px;
          }

          .kit-review-actions-premium,
          .kit-workflow-placeholder {
            align-items: flex-start;
            flex-direction: column;
          }

          .kit-review-actions-premium .kit-confirm-review-btn {
            width: 100%;
          }
        }

        @media (max-width: 760px) {
          .kit-team-review-summary {
            align-items: flex-start;
            padding: 12px;
          }

          .kit-team-review-summary-actions {
            display: grid;
            grid-template-columns: repeat(2, auto);
          }

          .kit-player-count-badge,
          .kit-team-review-chevron {
            display: none;
          }

          .kit-team-bulk-btn {
            min-height: 32px;
            padding: 5px 8px;
          }

          .kit-team-review-body {
            padding: 12px;
          }


          .kit-active-match-card {
            display: grid;
            padding: 14px;
          }

          .kit-change-match {
            min-width: 0;
          }

          .kit-change-match summary {
            text-align: left;
          }

          .kit-wizard-progress {
            grid-template-columns: 1fr;
          }

          .kit-roster-team-overview {
            grid-template-columns: 1fr;
          }

          .kit-versus-badge {
            margin: 0 auto;
          }

          .kit-source-mode-options,
          .kit-team-review-grid {
            grid-template-columns: 1fr;
          }
        }

      `}</style>

    </section>
  );
}