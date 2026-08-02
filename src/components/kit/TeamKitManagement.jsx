"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

  const notify = useCallback(
    (message, type = "success") => {
      if (type === "error") onError?.(message);
      else onMessage?.(message);
    },
    [onError, onMessage]
  );

  const load = useCallback(async (quiet = false) => {
    if (!leagueId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const response = await fetch(`/api/leagues/${leagueId}/team-kit`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Unable to load kit custody.");
      setData(payload);
    } catch (error) {
      notify(error.message || "Unable to load kit custody.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leagueId, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const sharedKit = data?.league?.sharedKit === true;
  const teams = data?.teams || [];
  const states = data?.states || [];
  const pendingTasks = data?.pendingTasks || [];
  const pendingMatchTotal = Number(
    data?.pendingMatchTotal || pendingTasks.length
  );
  const history = data?.history || [];

  const stateByScope = useMemo(() => {
    const map = new Map();
    states.forEach((state) => map.set(state.scopeKey, state));
    return map;
  }, [states]);

  const selectedTeam = teams.find((team) => String(team.id) === String(selectedTeamId));
  const availablePlayers = sharedKit ? data?.sharedPlayers || [] : selectedTeam?.players || [];

  function openRecord(task = null, teamId = null) {
    const resolvedTeamId = sharedKit ? "" : String(teamId || task?.teamId || teams[0]?.id || "");
    setSelectedTask(task);
    setRecordDialogOpen(true);
    setSelectedTeamId(resolvedTeamId);
    setHolderPlayerId("");
    setHolderName("");
    setNote("");
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
                {data.access?.canRecord ? (
                  <button className={styles.primaryButton} onClick={() => openRecord(task, task.teamId)}>
                    Record Who Took the Kit
                  </button>
                ) : (
                  <span className={styles.viewOnly}>Waiting for an authorized scorer</span>
                )}
              </article>
            ))}
          </div>
        )}
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
