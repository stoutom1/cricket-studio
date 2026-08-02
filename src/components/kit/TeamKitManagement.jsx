"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./TeamKitManagement.module.css";

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function matchEndDate(match) {
  return match?.lockedAt || match?.endedAt || match?.scheduledAt || null;
}

function Section({ title, subtitle, icon, count, open = false, children }) {
  return (
    <details className={styles.section} open={open}>
      <summary className={styles.sectionSummary}>
        <span className={styles.sectionIcon}>{icon}</span>
        <span className={styles.sectionCopy}>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
        <span className={styles.sectionMeta}>
          {count !== undefined && <b>{count}</b>}
          <i aria-hidden="true" />
        </span>
      </summary>
      <div className={styles.sectionBody}>{children}</div>
    </details>
  );
}

export default function TeamKitManagement({
  leagueId,
  leagueName = "",
  onMessage,
  onError,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [holderPlayerId, setHolderPlayerId] = useState("");
  const [holderName, setHolderName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const [accessUserId, setAccessUserId] = useState("");
  const [accessTeamIds, setAccessTeamIds] = useState([]);
  const [savingAccess, setSavingAccess] = useState(false);
  const [eligibilityMode, setEligibilityMode] =
    useState("ROSTER");
  const [eligibleNames, setEligibleNames] =
    useState([]);
  const [screenshotFile, setScreenshotFile] =
    useState(null);
  const [readingScreenshot, setReadingScreenshot] =
    useState(false);
  const [suggesting, setSuggesting] =
    useState(false);
  const [suggestTeamId, setSuggestTeamId] =
    useState("");

  /*
   * Parent dashboard callbacks may be recreated on every render.
   * Keep their latest values in refs so they never cause the Kit API
   * loading callback or its effect to be recreated.
   */
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const activeRequestRef = useRef(null);
  const requestSequenceRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
    };
  }, []);

  const notify = useCallback(
    (message, type = "success") => {
      if (type === "error") {
        onErrorRef.current?.(message);
      } else {
        onMessageRef.current?.(message);
      }
    },
    []
  );

  const load = useCallback(
    async (quiet = false) => {
      if (!leagueId) return null;

      /*
       * Ignore duplicate requests while the same league is already loading.
       * This protects against React Strict Mode, rapid mobile rerenders,
       * repeated disclosure changes, and accidental double taps.
       */
      if (activeRequestRef.current) {
        return activeRequestRef.current;
      }

      const requestSequence =
        requestSequenceRef.current + 1;

      requestSequenceRef.current =
        requestSequence;

      if (quiet) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const requestPromise = (async () => {
        try {
          const response = await fetch(
            `/api/leagues/${leagueId}/team-kit`,
            {
              cache: "no-store",
            }
          );

          const responseText =
            await response.text();

          let payload = null;

          if (responseText) {
            try {
              payload =
                JSON.parse(responseText);
            } catch {
              payload = {
                error:
                  "The Team Kit API returned an invalid response.",
              };
            }
          }

          if (!response.ok) {
            throw new Error(
              payload?.error ||
                "Unable to load kit custody."
            );
          }

          if (
            mountedRef.current &&
            requestSequence ===
              requestSequenceRef.current
          ) {
            setData(payload);
          }

          return payload;
        } catch (error) {
          if (
            mountedRef.current &&
            requestSequence ===
              requestSequenceRef.current
          ) {
            notify(
              error?.message ||
                "Unable to load kit custody.",
              "error"
            );
          }

          return null;
        } finally {
          if (
            mountedRef.current &&
            requestSequence ===
              requestSequenceRef.current
          ) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      })();

      activeRequestRef.current =
        requestPromise;

      try {
        return await requestPromise;
      } finally {
        if (
          activeRequestRef.current ===
          requestPromise
        ) {
          activeRequestRef.current = null;
        }
      }
    },
    [leagueId, notify]
  );

  /*
   * Load only when the league itself changes.
   * Parent callback identity changes no longer retrigger this effect.
   */
  useEffect(() => {
    mountedRef.current = true;
    requestSequenceRef.current += 1;
    activeRequestRef.current = null;
    setData(null);
    setLoading(true);
    setRefreshing(false);

    void load();
  }, [leagueId, load]);

  const sharedKit = data?.league?.sharedKit === true;
  const teams = data?.teams || [];
  const states = data?.states || [];
  const pendingTasks = data?.pendingTasks || [];
  const pendingMatchTotal = Number(
    data?.pendingMatchTotal || pendingTasks.length
  );
  const history = data?.history || [];
  const upcomingMatch = data?.upcomingMatch || null;
  const latestSuggestions =
    data?.latestSuggestions || {};
  const rotationByScope =
    data?.rotationByScope || {};

  const stateByScope = useMemo(() => {
    const map = new Map();
    states.forEach((state) => map.set(state.scopeKey, state));
    return map;
  }, [states]);

  const selectedTeam = teams.find((team) => String(team.id) === String(selectedTeamId));
  const availablePlayers = sharedKit ? data?.sharedPlayers || [] : selectedTeam?.players || [];


  const pendingSuggestionScopeKey =
    pendingTasks[0]?.scopeKey || "";

  const suggestionScopeKey = sharedKit
    ? "LEAGUE"
    : upcomingMatch
      ? (
          suggestTeamId
            ? `TEAM:${suggestTeamId}`
            : teams[0]
              ? `TEAM:${teams[0].id}`
              : ""
        )
      : (
          pendingSuggestionScopeKey ||
          (
            suggestTeamId
              ? `TEAM:${suggestTeamId}`
              : teams[0]
                ? `TEAM:${teams[0].id}`
                : ""
          )
        );

  const activeSuggestion =
    pendingTasks.find(
      (task) =>
        task.scopeKey ===
          suggestionScopeKey &&
        task.suggestion
    )?.suggestion ||
    latestSuggestions[
      suggestionScopeKey
    ] ||
    null;

  const suggestionTeam = teams.find(
    (team) =>
      String(team.id) ===
      String(
        suggestTeamId || teams[0]?.id || ""
      )
  );

  const upcomingEligiblePlayers =
    upcomingMatch?.eligiblePlayers || [];

  const upcomingTeamPlayers =
    upcomingMatch?.eligiblePlayersByTeam?.[
      String(
        suggestTeamId ||
          teams[0]?.id ||
          ""
      )
    ] ||
    upcomingMatch?.eligiblePlayersByTeam?.[
      Number(
        suggestTeamId ||
          teams[0]?.id ||
          0
      )
    ] ||
    [];

  const rosterCandidates = sharedKit
    ? (
        upcomingEligiblePlayers.length
          ? upcomingEligiblePlayers
          : data?.sharedPlayers || []
      )
    : (
        upcomingTeamPlayers.length
          ? upcomingTeamPlayers
          : suggestionTeam?.players || []
      );

  useEffect(() => {
    if (!teams.length) {
      if (suggestTeamId) {
        setSuggestTeamId("");
      }
      return;
    }

    const upcomingTeamIds = [
      upcomingMatch?.teamAId,
      upcomingMatch?.teamBId,
    ]
      .map(Number)
      .filter(
        (teamId) =>
          Number.isInteger(teamId) &&
          teams.some(
            (team) =>
              team.id === teamId
          )
      );

    const preferredTeamId =
      upcomingTeamIds[0] ||
      teams[0].id;

    const selectedTeamStillValid =
      teams.some(
        (team) =>
          String(team.id) ===
          String(suggestTeamId)
      ) &&
      (
        !upcomingTeamIds.length ||
        upcomingTeamIds.includes(
          Number(suggestTeamId)
        )
      );

    if (!selectedTeamStillValid) {
      setSuggestTeamId(
        String(preferredTeamId)
      );
    }
  }, [
    suggestTeamId,
    teams,
    upcomingMatch?.id,
    upcomingMatch?.teamAId,
    upcomingMatch?.teamBId,
  ]);

  const rosterCandidateNames = useMemo(
    () =>
      rosterCandidates
        .map((player) =>
          String(player?.name || "")
            .trim()
            .replace(/\s+/g, " ")
        )
        .filter(Boolean),
    [rosterCandidates]
  );

  const rosterSeedKey = useMemo(
    () =>
      [
        suggestionScopeKey,
        ...rosterCandidateNames.map(
          normalizeName
        ),
      ].join("|"),
    [
      suggestionScopeKey,
      rosterCandidateNames,
    ]
  );

  const lastRosterSeedKeyRef =
    useRef("");

  /*
   * Eligibility selections belong to one league only.
   * Clear every league-specific selection immediately when the active
   * league changes so players from the previous league can never remain
   * visible while the new league is loading.
   */
  useEffect(() => {
    setEligibilityMode("ROSTER");
    setEligibleNames([]);
    setScreenshotFile(null);
    setReadingScreenshot(false);
    setSuggesting(false);
    setSuggestTeamId("");
    setSelectedTask(null);
    setSelectedTeamId("");
    setHolderPlayerId("");
    setHolderName("");
    setNote("");
    setRecordDialogOpen(false);
    lastRosterSeedKeyRef.current = "";
  }, [leagueId]);

  /*
   * Seed the roster only when its actual scope/content changes.
   * Quiet API refreshes no longer overwrite manual player selections.
   */
  useEffect(() => {
    if (eligibilityMode !== "ROSTER") {
      return;
    }

    if (
      lastRosterSeedKeyRef.current ===
      rosterSeedKey
    ) {
      return;
    }

    lastRosterSeedKeyRef.current =
      rosterSeedKey;

    setEligibleNames(rosterCandidateNames);
  }, [
    eligibilityMode,
    rosterSeedKey,
    rosterCandidateNames,
  ]);

  function toggleEligibleName(name) {
    const key = normalizeName(name);

    setEligibleNames((current) => {
      const exists = current.some(
        (item) => normalizeName(item) === key
      );

      return exists
        ? current.filter(
            (item) =>
              normalizeName(item) !== key
          )
        : [...current, name];
    });
  }

  async function readScreenshot() {
    if (!screenshotFile) {
      notify(
        "Choose a playing-team screenshot first.",
        "error"
      );
      return;
    }

    setReadingScreenshot(true);

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

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            "Unable to read the screenshot."
        );
      }

      const names = [
        ...(Array.isArray(payload?.leftTeam)
          ? payload.leftTeam
          : []),
        ...(Array.isArray(payload?.rightTeam)
          ? payload.rightTeam
          : []),
      ];

      const unique = [];
      const seen = new Set();

      for (const value of names) {
        const displayName = String(value || "")
          .trim()
          .replace(/\s+/g, " ");
        const key = normalizeName(displayName);

        if (!key || seen.has(key)) continue;
        seen.add(key);
        unique.push(displayName);
      }

      if (!unique.length) {
        throw new Error(
          "No player names were found in the screenshot."
        );
      }

      setEligibleNames(unique);
      notify(
        `${unique.length} unique eligible player${
          unique.length === 1 ? "" : "s"
        } read from the screenshot.`
      );
    } catch (error) {
      notify(
        error.message ||
          "Unable to read the screenshot.",
        "error"
      );
    } finally {
      setReadingScreenshot(false);
    }
  }

  async function suggestNextCarrier() {
    if (!eligibleNames.length) {
      notify(
        "Select at least one eligible player.",
        "error"
      );
      return;
    }

    setSuggesting(true);

    try {
      const response = await fetch(
        `/api/leagues/${leagueId}/team-kit/suggest`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            teamId: sharedKit
              ? null
              : Number(
                  suggestTeamId ||
                    teams[0]?.id
                ),
            matchId: upcomingMatch?.id || null,
            eligibleNames,
          }),
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            "Unable to suggest the next carrier."
        );
      }

      notify(payload.message);
      await load(true);
    } catch (error) {
      notify(
        error.message ||
          "Unable to suggest the next carrier.",
        "error"
      );
    } finally {
      setSuggesting(false);
    }
  }

  function openRecord(
    task = null,
    teamId = null,
    preset = null
  ) {
    const resolvedTeamId = sharedKit
      ? ""
      : String(
          teamId ||
            task?.teamId ||
            teams[0]?.id ||
            ""
        );

    const taskScopeKey = sharedKit
      ? "LEAGUE"
      : `TEAM:${resolvedTeamId}`;

    const taskSuggestion =
      task?.suggestion ||
      latestSuggestions[
        taskScopeKey
      ] ||
      null;

    const presetName =
      preset?.name ||
      taskSuggestion?.holderName ||
      "";

    const presetPlayerId =
      preset?.playerId ||
      taskSuggestion?.holderPlayerId ||
      "";

    setSelectedTask(task);
    setRecordDialogOpen(true);
    setSelectedTeamId(
      resolvedTeamId
    );
    setHolderPlayerId(
      presetPlayerId
        ? String(presetPlayerId)
        : ""
    );
    setHolderName(presetName);
    setNote(
      preset?.note || ""
    );
  }

  function choosePlayer(value) {
    setHolderPlayerId(value);
    const player = availablePlayers.find((item) => String(item.id) === String(value));
    if (player) setHolderName(player.name);
  }

  async function saveCustody(event) {
    event.preventDefault();
    if (!holderName.trim()) {
      notify("Select or enter who took the kit.", "error");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/leagues/${leagueId}/team-kit/custody`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: selectedTask?.id || null,
          teamId: sharedKit ? null : Number(selectedTeamId),
          matchId: selectedTask?.matchId || null,
          holderPlayerId: holderPlayerId ? Number(holderPlayerId) : null,
          holderName: holderName.trim(),
          note: note.trim(),
          suggestionName:
            selectedTask?.suggestion
              ?.holderName ||
            latestSuggestions[
              sharedKit
                ? "LEAGUE"
                : `TEAM:${selectedTeamId}`
            ]?.holderName ||
            "",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Unable to record custody.");
      setSelectedTask(null);
      setRecordDialogOpen(false);
      setSelectedTeamId("");
      setHolderPlayerId("");
      setHolderName("");
      setNote("");
      notify(payload?.message || "Kit custody recorded.");
      await load(true);
    } catch (error) {
      notify(error.message || "Unable to record custody.", "error");
    } finally {
      setSaving(false);
    }
  }

  function loadMemberAccess(userId) {
    setAccessUserId(String(userId));
    const mappings = (data?.accessMappings || []).filter(
      (item) => String(item.userId) === String(userId)
    );
    setAccessTeamIds(mappings.map((item) => String(item.teamId)));
  }

  async function saveMemberAccess(event) {
    event.preventDefault();
    setSavingAccess(true);
    try {
      const response = await fetch(`/api/leagues/${leagueId}/team-kit/access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: accessUserId,
          teamIds: accessTeamIds.map(Number),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Unable to update access.");
      notify(payload?.message || "Team-kit access updated.");
      await load(true);
    } catch (error) {
      notify(error.message || "Unable to update access.", "error");
    } finally {
      setSavingAccess(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.shell}>
        <div className={styles.loadingCard}>
          <span className={styles.spinner} />
          <strong>Loading kit custody</strong>
          <small>Preparing your authorized team view…</small>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div className={styles.heroIcon}>🎒</div>
        <div className={styles.heroCopy}>
          <span>TEAM KIT CUSTODY</span>
          <h2>{sharedKit ? "Shared League Kit" : "Kit Responsibility"}</h2>
          <p>
            {sharedKit
              ? "One shared kit, one current holder, and one clear custody history for the entire league."
              : "Your authorized team kit holders, completed-match follow-ups, and custody history in one place."}
          </p>
        </div>
        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => load(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
          {data.access?.canManageAccess && !sharedKit && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setShowAccess((value) => !value)}
            >
              🔐 Team Access
            </button>
          )}
        </div>
      </header>

      <div className={styles.quickStats}>
        <article>
          <span>Needs attention</span>
          <strong>{pendingTasks.length}</strong>
          <small>
            {pendingTasks.length === pendingMatchTotal
              ? "Kit scope follow-ups"
              : `${pendingMatchTotal} finished matches consolidated`}
          </small>
        </article>
        <article>
          <span>Current holders</span>
          <strong>{states.filter((state) => state.currentHolderName).length}</strong>
          <small>{sharedKit ? "Shared kit record" : "Visible team records"}</small>
        </article>
        <article>
          <span>Your access</span>
          <strong>{data.access?.canRecord ? "Record" : "View"}</strong>
          <small>{data.access?.isOwner ? "League-wide" : sharedKit ? "Shared league kit" : "Team scoped"}</small>
        </article>
      </div>

      {data.emptyReason && <div className={styles.emptyNotice}>{data.emptyReason}</div>}

      {showAccess && data.access?.canManageAccess && (
        <Section
          title="Team visibility"
          subtitle="Assign each league member only the teams they may view and record."
          icon="🔐"
          count={data.members?.length || 0}
          open
        >
          <form className={styles.accessForm} onSubmit={saveMemberAccess}>
            <label>
              <span>League member</span>
              <select value={accessUserId} onChange={(event) => loadMemberAccess(event.target.value)} required>
                <option value="">Select member</option>
                {(data.members || []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name || member.email} {member.role ? `• ${member.role}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.teamChecks}>
              {teams.map((team) => (
                <label key={team.id} className={styles.checkCard}>
                  <input
                    type="checkbox"
                    checked={accessTeamIds.includes(String(team.id))}
                    onChange={(event) => {
                      setAccessTeamIds((current) =>
                        event.target.checked
                          ? [...current, String(team.id)]
                          : current.filter((id) => id !== String(team.id))
                      );
                    }}
                  />
                  <span>{team.name}</span>
                </label>
              ))}
            </div>
            <button className={styles.primaryButton} disabled={!accessUserId || savingAccess}>
              {savingAccess ? "Saving access…" : "Save Team Access"}
            </button>
          </form>
        </Section>
      )}

      <Section
        title="Needs attention"
        subtitle="One latest follow-up per team kit or shared league kit."
        icon="⚠️"
        count={pendingTasks.length}
        open={pendingTasks.length > 0}
      >
        {pendingTasks.length === 0 ? (
          <div className={styles.successEmpty}>
            <span>✓</span>
            <div>
              <strong>Everything is up to date</strong>
              <small>No completed match is waiting for kit custody.</small>
            </div>
          </div>
        ) : (
          <div className={styles.taskGrid}>
            {pendingTasks.map((task) => (
              <article key={task.id} className={styles.taskCard}>
                <div className={styles.taskTopline}>
                  <span>{sharedKit ? "SHARED KIT" : task.team?.name || "TEAM KIT"}</span>
                  <b>{task.match?.status || "FINISHED"}</b>
                </div>
                <h3>{task.match?.label || "Completed match"}</h3>
                <p>
                  Latest match ended {formatDate(matchEndDate(task.match))}
                </p>
                {Number(task.pendingMatchCount || 1) > 1 && (
                  <p>
                    Includes {task.pendingMatchCount - 1} earlier unconfirmed
                    {task.pendingMatchCount - 1 === 1 ? " match" : " matches"}.
                  </p>
                )}
                {task.suggestion?.holderName && (
                  <div
                    className={
                      styles.pendingSuggestion
                    }
                  >
                    <span>
                      ✨ Suggested carrier
                    </span>

                    <strong>
                      {
                        task.suggestion
                          .holderName
                      }
                    </strong>

                    <small>
                      The current holder does not
                      change until final custody is
                      confirmed.
                    </small>
                  </div>
                )}

                {data.access?.canRecord ? (
                  <div
                    className={
                      styles.custodyChoiceGrid
                    }
                  >
                    {task.suggestion
                      ?.holderName && (
                      <button
                        type="button"
                        className={
                          styles.primaryButton
                        }
                        onClick={() =>
                          openRecord(
                            task,
                            task.teamId,
                            {
                              name:
                                task
                                  .suggestion
                                  .holderName,
                              playerId:
                                task
                                  .suggestion
                                  .holderPlayerId,
                              note:
                                "Suggested carrier took the kit home.",
                            }
                          )
                        }
                      >
                        ✓ Suggested person took it
                      </button>
                    )}

                    {(() => {
                      const taskState =
                        stateByScope.get(
                          task.scopeKey
                        );

                      return taskState
                        ?.currentHolderName ? (
                        <button
                          type="button"
                          className={
                            styles.secondaryButton
                          }
                          onClick={() =>
                            openRecord(
                              task,
                              task.teamId,
                              {
                                name:
                                  taskState
                                    .currentHolderName,
                                playerId:
                                  taskState
                                    .currentHolderPlayerId,
                                note:
                                  "The same current holder kept the kit.",
                              }
                            )
                          }
                        >
                          ↺ Same holder kept it
                        </button>
                      ) : null;
                    })()}

                    <button
                      type="button"
                      className={
                        styles.secondaryButton
                      }
                      onClick={() =>
                        openRecord(
                          task,
                          task.teamId,
                          {
                            name: "",
                            playerId: "",
                            note:
                              "A different person took the kit home.",
                          }
                        )
                      }
                    >
                      👤 Choose another person
                    </button>
                  </div>
                ) : (
                  <span
                    className={
                      styles.viewOnly
                    }
                  >
                    Waiting for an authorized scorer
                  </span>
                )}
              </article>
            ))}
          </div>
        )}
      </Section>


      <Section
        title="Next fair turn"
        subtitle="Choose who is playing, then let Cric4All suggest the fairest next carrier."
        icon="✨"
        count={
          rotationByScope[suggestionScopeKey]?.length ||
          0
        }
        open
      >
        <div className={styles.suggestionLayout}>
          <article className={styles.suggestionHero}>
            <div>
              <span>
                {upcomingMatch
                  ? "NEXT SUGGESTED CARRIER"
                  : pendingTasks.length
                    ? "SUGGESTED CARRIER AWAITING CONFIRMATION"
                    : "NEXT SUGGESTED CARRIER"}
              </span>
              <h3>
                {activeSuggestion?.holderName ||
                  "No suggestion yet"}
              </h3>
              <p>
                {activeSuggestion
                  ? activeSuggestion.note ||
                    "Based on completed turns and the longest wait."
                  : pendingTasks.length
                    ? "The completed match has no saved suggestion. Choose the actual holder below."
                    : "Confirm the next-match eligible players and generate a fair suggestion."}
              </p>
            </div>

            {activeSuggestion && (
              <div className={styles.suggestionBadge}>
                Suggested
              </div>
            )}
          </article>

          <div className={styles.nextMatchBar}>
            <span>Upcoming match</span>

            <strong>
              {upcomingMatch?.label ||
                "No upcoming match found"}
            </strong>

            <small>
              {formatDate(
                upcomingMatch?.scheduledAt
              )}
            </small>

            {upcomingMatch && (
              <em
                className={styles.rosterSourceBadge}
              >
                {upcomingMatch.savedPlayingRoster
                  ? "Confirmed playing roster"
                  : "Team roster fallback"}
              </em>
            )}
          </div>

          {!sharedKit && teams.length > 1 && (
            <label className={styles.field}>
              <span>Team kit</span>
              <select
                value={suggestTeamId}
                onChange={(event) => {
                  setSuggestTeamId(
                    event.target.value
                  );
                  setEligibilityMode("ROSTER");
                }}
              >
                {teams.map((team) => (
                  <option
                    key={team.id}
                    value={team.id}
                  >
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className={styles.segmentedControl}>
            <button
              type="button"
              className={
                eligibilityMode === "ROSTER"
                  ? styles.segmentActive
                  : ""
              }
              onClick={() => {
                setEligibilityMode("ROSTER");
                lastRosterSeedKeyRef.current =
                  rosterSeedKey;
                setEligibleNames(
                  rosterCandidateNames
                );
              }}
            >
              👥 Team roster
            </button>

            <button
              type="button"
              className={
                eligibilityMode === "SCREENSHOT"
                  ? styles.segmentActive
                  : ""
              }
              onClick={() =>
                setEligibilityMode("SCREENSHOT")
              }
            >
              🖼️ Playing-team screenshot
            </button>
          </div>

          {eligibilityMode === "SCREENSHOT" && (
            <div className={styles.uploadPanel}>
              <label className={styles.uploadBox}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    setScreenshotFile(
                      event.target.files?.[0] ||
                        null
                    );
                    setEligibleNames([]);
                  }}
                />
                <span>📷</span>
                <strong>
                  {screenshotFile?.name ||
                    "Choose screenshot"}
                </strong>
                <small>
                  PNG, JPG, JPEG, or WEBP • up to
                  8 MB
                </small>
              </label>

              <button
                type="button"
                className={styles.secondaryButton}
                disabled={
                  !screenshotFile ||
                  readingScreenshot
                }
                onClick={readScreenshot}
              >
                {readingScreenshot
                  ? "Reading names…"
                  : "Read Player Names"}
              </button>
            </div>
          )}

          <div className={styles.eligibilityHeader}>
            <div>
              <strong>Eligible for the next turn</strong>
              <small>
                {eligibleNames.length} player
                {eligibleNames.length === 1
                  ? ""
                  : "s"}{" "}
                selected
              </small>
            </div>

            {rosterCandidates.length > 0 && (
              <button
                type="button"
                className={styles.textButton}
                onClick={() =>
                  setEligibleNames(
                    rosterCandidates.map(
                      (player) => player.name
                    )
                  )
                }
              >
                Select all
              </button>
            )}
          </div>

          {(
            eligibilityMode === "ROSTER"
              ? rosterCandidates
              : eligibleNames
          ).length === 0 ? (
            <div className={styles.eligibleEmptyState}>
              <span aria-hidden="true">👥</span>

              <div>
                <strong>
                  No eligible players loaded
                </strong>

                <small>
                  {upcomingMatch
                    ? "Save the match playing roster, or use a screenshot to confirm who is playing."
                    : "Create or schedule the next match, then return to generate a fair suggestion."}
                </small>
              </div>
            </div>
          ) : (
          <div className={styles.eligibleGrid}>
            {(eligibilityMode === "ROSTER"
              ? rosterCandidates.map(
                  (player) => player.name
                )
              : eligibleNames
            ).map((name) => {
              const selected =
                eligibleNames.some(
                  (item) =>
                    normalizeName(item) ===
                    normalizeName(name)
                );

              return (
                <button
                  type="button"
                  key={normalizeName(name)}
                  className={`${styles.playerChip} ${
                    selected
                      ? styles.playerChipSelected
                      : ""
                  }`}
                  onClick={() =>
                    toggleEligibleName(name)
                  }
                >
                  <span>
                    {selected ? "✓" : "+"}
                  </span>
                  <strong>{name}</strong>
                </button>
              );
            })}
          </div>
          )}

          <button
            type="button"
            className={styles.primaryButton}
            disabled={
              suggesting ||
              !eligibleNames.length ||
              !data.access?.canRecord
            }
            onClick={suggestNextCarrier}
          >
            {suggesting
              ? "Calculating fair turn…"
              : activeSuggestion
                ? "Suggest Another Fair Carrier"
                : "Suggest Next Fair Carrier"}
          </button>

          {(rotationByScope[suggestionScopeKey] ||
            []).length > 0 && (
            <details
              className={styles.rotationDisclosure}
            >
              <summary
                className={styles.rotationDisclosureSummary}
              >
                <span
                  className={styles.rotationDisclosureIcon}
                  aria-hidden="true"
                >
                  📊
                </span>

                <span
                  className={styles.rotationDisclosureCopy}
                >
                  <strong>
                    Rotation standings
                  </strong>

                  <small>
                    {
                      rotationByScope[
                        suggestionScopeKey
                      ].length
                    }{" "}
                    eligible player
                    {rotationByScope[
                      suggestionScopeKey
                    ].length === 1
                      ? ""
                      : "s"}{" "}
                    ranked by completed turns
                  </small>
                </span>

                <span
                  className={styles.rotationDisclosureAction}
                >
                  View
                </span>
              </summary>

              <div className={styles.rotationList}>
                {(rotationByScope[
                  suggestionScopeKey
                ] || [])
                  .slice(0, 12)
                  .map((item, index) => (
                    <div
                      key={normalizeName(item.name)}
                      className={styles.rotationRow}
                    >
                      <b>{index + 1}</b>
                      <span>{item.name}</span>
                      <small>
                        {item.completedTurns} turn
                        {item.completedTurns === 1
                          ? ""
                          : "s"}
                      </small>
                    </div>
                  ))}
              </div>
            </details>
          )}
        </div>
      </Section>

      <Section
        title={sharedKit ? "Current shared-kit holder" : "Current team holders"}
        subtitle={sharedKit ? "Visible to every Surprise Cricket League player." : "Only teams within your authorized scope are shown."}
        icon="👤"
        count={sharedKit ? 1 : teams.length}
        open
      >
        <div className={styles.holderGrid}>
          {(sharedKit ? [{ id: "shared", name: leagueName || data.league?.name }] : teams).map((team) => {
            const scopeKey = sharedKit ? "LEAGUE" : `TEAM:${team.id}`;
            const state = stateByScope.get(scopeKey);
            return (
              <article key={team.id} className={styles.holderCard}>
                <div className={styles.holderIdentity}>
                  <span className={styles.avatar}>{initials(state?.currentHolderName)}</span>
                  <div>
                    <small>{sharedKit ? "SHARED LEAGUE KIT" : team.name}</small>
                    <strong>{state?.currentHolderName || "Holder not recorded"}</strong>
                  </div>
                </div>
                <dl>
                  <div>
                    <dt>Last updated</dt>
                    <dd>{formatDate(state?.updatedAt)}</dd>
                  </div>
                  <div>
                    <dt>Last match</dt>
                    <dd>{state?.lastMatchId ? `Match #${state.lastMatchId}` : "Not linked"}</dd>
                  </div>
                </dl>
                {data.access?.canRecord && (
                  <button className={styles.secondaryButton} onClick={() => openRecord(null, sharedKit ? null : team.id)}>
                    {state?.currentHolderName ? "Correct Holder" : "Record Holder"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </Section>

      <Section
        title="Custody history"
        subtitle="A clear audit trail of who took the kit and who recorded it."
        icon="🕘"
        count={history.length}
      >
        {history.length === 0 ? (
          <div className={styles.historyEmpty}>No kit custody history has been recorded yet.</div>
        ) : (
          <div className={styles.timeline}>
            {history.map((item) => (
              <article key={item.id} className={styles.timelineItem}>
                <span className={styles.timelineDot} />
                <div className={styles.timelineMain}>
                  <div className={styles.timelineTitle}>
                    <strong>{item.holderName || "Holder cleared"}</strong>
                    <time>{formatDate(item.createdAt)}</time>
                  </div>
                  <p>
                    {sharedKit ? "Shared league kit" : item.team?.name || "Team kit"}
                    {item.match?.label ? ` • after ${item.match.label}` : ""}
                  </p>
                  <small>
                    Recorded by {item.recordedByName || item.recordedByEmail || "Authorized user"}
                    {item.previousHolderName ? ` • Previous holder: ${item.previousHolderName}` : ""}
                  </small>
                  {item.note && <blockquote>{item.note}</blockquote>}
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>

      {recordDialogOpen && data.access?.canRecord && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => {
          setSelectedTask(null);
          setRecordDialogOpen(false);
          setSelectedTeamId("");
        }}>
          <form className={styles.modal} onSubmit={saveCustody} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>RECORD KIT CUSTODY</span>
                <h3>{sharedKit ? "Who took the shared league kit?" : `Who took ${selectedTeam?.name || "this team"}'s kit?`}</h3>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => {
                setSelectedTask(null);
                setRecordDialogOpen(false);
                setSelectedTeamId("");
              }} aria-label="Close">×</button>
            </header>

            {!sharedKit && teams.length > 1 && !selectedTask && (
              <label>
                <span>Team</span>
                <select value={selectedTeamId} onChange={(event) => { setSelectedTeamId(event.target.value); setHolderPlayerId(""); setHolderName(""); }} required>
                  <option value="">Select team</option>
                  {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </label>
            )}


            {(selectedTask?.suggestion ||
              latestSuggestions[
                sharedKit
                  ? "LEAGUE"
                  : `TEAM:${selectedTeamId}`
              ])?.holderName && (
              <button
                type="button"
                className={styles.suggestedChoice}
                onClick={() => {
                  const name =
                    (
                      selectedTask
                        ?.suggestion ||
                      latestSuggestions[
                        sharedKit
                          ? "LEAGUE"
                          : `TEAM:${selectedTeamId}`
                      ]
                    ).holderName;
                  setHolderPlayerId("");
                  setHolderName(name);
                }}
              >
                <span>✨ Suggested carrier</span>
                <strong>
                  {
                    (
                      selectedTask
                        ?.suggestion ||
                      latestSuggestions[
                        sharedKit
                          ? "LEAGUE"
                          : `TEAM:${selectedTeamId}`
                      ]
                    ).holderName
                  }
                </strong>
                <small>
                  Tap to confirm the same person took the kit
                </small>
              </button>
            )}

            <label>
              <span>Select player</span>
              <select value={holderPlayerId} onChange={(event) => choosePlayer(event.target.value)}>
                <option value="">Choose from roster or type a name below</option>
                {availablePlayers.map((player) => (
                  <option key={`${player.teamId || selectedTeamId}-${player.id}-${normalizeName(player.name)}`} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Actual holder name</span>
              <input value={holderName} onChange={(event) => setHolderName(event.target.value)} maxLength={160} placeholder="Enter the person who took the kit" required />
            </label>

            <label>
              <span>Optional note</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} placeholder="Handover detail, correction reason, or anything useful" />
            </label>

            {selectedTask?.match?.label && (
              <div className={styles.matchContext}>
                <span>Linked match</span>
                <strong>{selectedTask.match.label}</strong>
              </div>
            )}

            <footer>
              <button type="button" className={styles.secondaryButton} onClick={() => {
                setSelectedTask(null);
                setRecordDialogOpen(false);
                setSelectedTeamId("");
              }}>Cancel</button>
              <button className={styles.primaryButton} disabled={saving}>{saving ? "Saving custody…" : "Save Current Holder"}</button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}
