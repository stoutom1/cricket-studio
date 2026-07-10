"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { suggestCaptainsForTeam } from "@/lib/captainSuggestions";
import { useSearchParams } from "next/navigation";

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function numberOrZero(value) {
  if (value === "Not out") return 50;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mergeStatsIntoPlayers(players, stats) {
  const battingMap = new Map();
  const bowlingMap = new Map();
  const fieldingMap = new Map();
  const keepingMap = new Map();
  const captaincyMap = new Map();

  for (const row of stats?.batting || []) {
    battingMap.set(normalizeName(row.playerName), row);
  }

  for (const row of stats?.bowling || []) {
    bowlingMap.set(normalizeName(row.playerName), row);
  }

  for (const row of stats?.fielding || []) {
    fieldingMap.set(normalizeName(row.playerName), row);
  }

  for (const row of stats?.wicketkeeping || []) {
    keepingMap.set(normalizeName(row.playerName), row);
  }

  for (const row of stats?.captaincy || []) {
    captaincyMap.set(normalizeName(row.playerName), row);
  }

  return players.map((player) => {
    const key = normalizeName(player.playerName);

    const bat = battingMap.get(key);
    const bowl = bowlingMap.get(key);
    const field = fieldingMap.get(key);
    const keep = keepingMap.get(key);
    const captain = captaincyMap.get(key);

    const winPct =
      captain?.winPct ||
      (captain?.played
        ? ((Number(captain.won || 0) / Number(captain.played || 1)) * 100).toFixed(1)
        : 0);

    return {
      ...player,
      playerKey: player.playerKey || player.id,

      runs: Number(bat?.runs || 0),
      average: numberOrZero(bat?.average),
      strikeRate: numberOrZero(bat?.strikeRate),

      wickets: Number(bowl?.wickets || 0),
      economy: bowl?.economy ? Number(bowl.economy) : 12,

      catches: Number(field?.catches || 0),
      runOuts: Number(field?.runOuts || 0),
      stumpings: Number(field?.stumpings || 0),

      dismissals: Number(keep?.dismissals || 0),
      winPct: Number(winPct || 0),
    };
  });
}

export default function AITeamSplitterClient() {
  const searchParams = useSearchParams();
  const requestedLeagueId = Number(searchParams.get("leagueId"));

  const [players, setPlayers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [result, setResult] = useState(null);

  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [balancing, setBalancing] = useState(false);

  const [poll, setPoll] = useState(null);
  const [pollTitle, setPollTitle] = useState("Match Availability");
  const [pollText, setPollText] = useState("");
  const [pollResponses, setPollResponses] = useState([]);
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [refreshingPoll, setRefreshingPoll] = useState(false);
  const [allPolls, setAllPolls] = useState([]);
  const [leagueId, setLeagueId] = useState(null);

  const [pollOptions, setPollOptions] = useState([]);
  const [showOptionForm, setShowOptionForm] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [newOptionStartTime, setNewOptionStartTime] = useState("");
  const [captainSuggestions, setCaptainSuggestions] = useState(null);
  const [leagueTeams, setLeagueTeams] = useState([]);
  const [selectedSourceTeamIds, setSelectedSourceTeamIds] = useState([]);
  const [generatedTeamAName, setGeneratedTeamAName] = useState("Team A");
  const [generatedTeamBName, setGeneratedTeamBName] = useState("Team B");
  const [sourceTeamsInitialized, setSourceTeamsInitialized] = useState(false);

useEffect(() => {
  if (
    !Number.isInteger(requestedLeagueId) ||
    requestedLeagueId <= 0
  ) {
    setLoadingPlayers(false);
    return;
  }

  setSourceTeamsInitialized(false);
  setLeagueId(requestedLeagueId);
  loadInitialTeamBuilderData(requestedLeagueId);
}, [requestedLeagueId]);


useEffect(() => {
  if (!poll?.token) return;

  refreshPollResponses();

  const timer = setInterval(() => {
    refreshPollResponses();
  }, 10000);

  return () => clearInterval(timer);
}, [poll?.token]);

useEffect(() => {
  const token = localStorage.getItem("cric4all-latest-team-poll-token");
  if (token) loadPollByToken(token);
}, []);

useEffect(() => {
  if (!leagueId || !sourceTeamsInitialized) return;

  loadPlayersForSelectedTeams();
}, [
  leagueId,
  sourceTeamsInitialized,
  selectedSourceTeamIds,
]);


  const selectedPlayers = useMemo(
    () => players.filter((p) => selectedIds.includes(p.id)),
    [players, selectedIds]
  );

  async function loadLeagueTeams(targetLeagueId) {
  if (!targetLeagueId) return;

  try {
    const res = await fetch(
      `/api/teams?leagueId=${targetLeagueId}`
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error || "Failed to load league teams."
      );
    }

    const teams = Array.isArray(data)
      ? data
      : data.teams || [];

    setLeagueTeams(teams);
  } catch (error) {
    console.error("Load league teams failed:", error);
    setLeagueTeams([]);
  }
}

async function loadPlayersForSelectedTeams() {
  if (!leagueId) return;

  if (!selectedSourceTeamIds.length) {
    setPlayers([]);
    setSelectedIds([]);
    setResult(null);
    setCaptainSuggestions(null);
    return;
  }

  setLoadingPlayers(true);

  try {
    const teamIdsParam =
      selectedSourceTeamIds.join(",");

    const playerRes = await fetch(
      `/api/ai-team-splitter/players?leagueId=${leagueId}&teamIds=${encodeURIComponent(
        teamIdsParam
      )}`
    );

    const playerData = await playerRes.json();

    if (!playerRes.ok) {
      throw new Error(
        playerData.error || "Failed to load selected team players."
      );
    }

    const statsRes = await fetch(
      `/api/leagues/${leagueId}/stats`
    );

    const statsData = await statsRes.json();

    if (!statsRes.ok) {
      throw new Error(
        statsData.error || "Failed to load league statistics."
      );
    }

    const mergedPlayers = mergeStatsIntoPlayers(
      playerData.players || [],
      statsData
    );

    setPlayers(mergedPlayers);
    setSelectedIds(
      mergedPlayers.map((player) => player.id)
    );
    setResult(null);
    setCaptainSuggestions(null);
  } catch (error) {
    console.error(
      "Load selected-team players failed:",
      error
    );

    alert(
      error.message ||
        "Failed to load selected team players."
    );
  } finally {
    setLoadingPlayers(false);
  }
}

async function loadInitialTeamBuilderData(targetLeagueId) {
  if (!targetLeagueId) return;

  setLoadingPlayers(true);

  try {
    const playerRes = await fetch(
      `/api/ai-team-splitter/players?leagueId=${targetLeagueId}`
    );

    const playerData = await playerRes.json();

    if (!playerRes.ok) {
      throw new Error(
        playerData.error || "Failed to load players."
      );
    }

    const availableTeams = playerData.teams || [];

    setLeagueTeams(availableTeams);

    /*
      Start with every league team selected.
      Users can deselect teams afterward.
    */
    const allTeamIds = availableTeams.map((team) =>
      Number(team.id)
    );

  setSelectedSourceTeamIds(allTeamIds);
setSourceTeamsInitialized(true);

    const statsRes = await fetch(
      `/api/leagues/${targetLeagueId}/stats`
    );

    const statsData = await statsRes.json();

    if (!statsRes.ok) {
      throw new Error(
        statsData.error || "Failed to load league statistics."
      );
    }

    const mergedPlayers = mergeStatsIntoPlayers(
      playerData.players || [],
      statsData
    );

    setPlayers(mergedPlayers);
    setSelectedIds(mergedPlayers.map((player) => player.id));
    setResult(null);
    setCaptainSuggestions(null);

    setLeagueId(targetLeagueId);

    await loadAllPolls(targetLeagueId);

    const latestPollRes = await fetch(
      `/api/team-availability-poll/latest?leagueId=${targetLeagueId}`
    );

    const latestPollData = await latestPollRes.json();

    if (latestPollRes.ok && latestPollData.poll) {
      setPoll(latestPollData.poll);
      setPollResponses(
        latestPollData.poll.responses || []
      );
    }
  } catch (error) {
    console.error(
      "Load team-builder data failed:",
      error
    );

    alert(
      error.message ||
        "Failed to load the team builder."
    );

    setPlayers([]);
    setSelectedIds([]);
    setLeagueTeams([]);
  } finally {
    setLoadingPlayers(false);
  }
}

  function togglePlayer(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAll() {
    setSelectedIds(players.map((p) => p.id));
  }

  function clearAll() {
    setSelectedIds([]);
    setResult(null);
  }

  function addMatchOption() {
  const label = newOptionLabel.trim();
  const startTime = newOptionStartTime;

  if (!label && !startTime) {
    alert("Please enter a label or date/time.");
    return;
  }

  setPollOptions((prev) => [
    ...prev,
    {
      label: label || `Match Option ${prev.length + 1}`,
      startTime,
    },
  ]);

  setNewOptionLabel("");
  setNewOptionStartTime("");
  setShowOptionForm(false);
}

  function removePollOption(index) {
    setPollOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function createPoll() {
    const cleanOptions = pollOptions.filter(
      (option) => option.label.trim() || option.startTime
    );

    if (!cleanOptions.length) {
      alert("Please add at least one date option.");
      return;
    }

    setCreatingPoll(true);

    try {
      const res = await fetch("/api/team-availability-poll/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leagueId,
          title: pollTitle,
          matchText: pollText,
          options: cleanOptions,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to create poll.");
        return;
      }

      setPoll(data.poll);
      setPollResponses(data.poll?.responses || []);
      await loadAllPolls(leagueId);
      localStorage.setItem("cric4all-latest-team-poll-token", data.poll.token);
      setTimeout(() => {
  refreshPollResponses();
}, 500);
      alert("Poll created. You can now share it to WhatsApp.");
    } catch (error) {
      console.error("Create poll failed:", error);
      alert("Failed to create poll.");
    } finally {
      setCreatingPoll(false);
    }
  }

  function sharePollToWhatsApp() {
    if (!poll?.token) return;

    const url = `${window.location.origin}/team-poll/${poll.token}`;

    const msg = `🏏 ${poll.title}

${poll.matchText || "Please confirm your availability for the match."}

Vote here:
${url}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  async function refreshPollResponses() {
    if (!poll?.token) return;

    setRefreshingPoll(true);

    try {
      const res = await fetch(`/api/team-availability-poll/${poll.token}`);
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to refresh poll.");
        return;
      }

      setPoll(data.poll);
      setPollResponses(data.poll?.responses || []);
    } catch (error) {
      console.error("Refresh poll failed:", error);
      alert("Failed to refresh poll.");
    } finally {
      setRefreshingPoll(false);
    }
  }

  function getBestPollOption() {
    if (!poll?.options?.length || !pollResponses.length) return null;

    return poll.options
      .map((option) => {
        const yesResponses = pollResponses.filter(
          (response) =>
            Number(response.optionId) === Number(option.id) &&
            response.response === "YES"
        );

        return {
          ...option,
          yesCount: yesResponses.length,
          yesPlayerKeys: yesResponses.map((response) => response.playerKey),
        };
      })
      .sort((a, b) => b.yesCount - a.yesCount)[0];
  }

  function useBestDatePlayersFromPoll() {
    const best = getBestPollOption();

    if (!best || !best.yesPlayerKeys.length) {
      alert("No YES votes found yet.");
      return;
    }

    const yesSet = new Set(best.yesPlayerKeys);

    const selected = players
      .filter((player) => yesSet.has(player.id) || yesSet.has(player.playerKey))
      .map((player) => player.id);

    setSelectedIds(selected);
    setResult(null);

    alert(
      `Using ${selected.length} players from ${best.label} (${best.yesCount} YES votes).`
    );
  }

  async function generateTeams() {
    if (selectedPlayers.length < 4) {
      alert("Please select at least 4 players.");
      return;
    }

    setBalancing(true);

    try {
      const res = await fetch("/api/ai-team-splitter/balance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          players: selectedPlayers,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to balance teams.");
        return;
      }

      setResult(data);

      setCaptainSuggestions({
        teamA: suggestCaptainsForTeam(data.teamA || []),
        teamB: suggestCaptainsForTeam(data.teamB || []),
      });
    } catch (error) {
      console.error("Generate balanced teams failed:", error);
      alert("Failed to balance teams.");
    } finally {
      setBalancing(false);
    }
  }

function getPollOptionResults() {
  if (!poll?.options?.length) return [];

  return poll.options.map((option) => {
    const optionResponses = pollResponses.filter(
      (r) => Number(r.optionId) === Number(option.id)
    );

    const yes = optionResponses.filter((r) => r.response === "YES");
    const maybe = optionResponses.filter((r) => r.response === "MAYBE");
    const no = optionResponses.filter((r) => r.response === "NO");

    const respondedKeys = new Set(optionResponses.map((r) => r.playerKey));

    const notResponded = players.filter(
      (p) => !respondedKeys.has(p.id) && !respondedKeys.has(p.playerKey)
    );

    return {
      option,
      yes,
      maybe,
      no,
      notResponded,
      totalResponses: optionResponses.length,
    };
  });
}

function useOptionPlayers(optionId) {
  const yesKeys = new Set(
    pollResponses
      .filter(
        (r) =>
          Number(r.optionId) === Number(optionId) &&
          r.response === "YES"
      )
      .map((r) => r.playerKey)
  );

  const selected = players
    .filter((p) => yesKeys.has(p.id) || yesKeys.has(p.playerKey))
    .map((p) => p.id);

  setSelectedIds(selected);
  setResult(null);

  alert(`Selected ${selected.length} available players.`);
}

async function loadPollByToken(token) {
  if (!token) return;

  const res = await fetch(`/api/team-availability-poll/${token}`);
  const data = await res.json();

  if (res.ok && data.poll) {
    setPoll(data.poll);
    setPollResponses(data.poll.responses || []);
  }
}

async function loadAllPolls(targetLeagueId = leagueId) {
  if (!targetLeagueId) return;

  const res = await fetch(
    `/api/team-availability-poll/list?leagueId=${targetLeagueId}`
  );

  const data = await res.json();

  if (res.ok) {
    setAllPolls(data.polls || []);
  }
}

function openExistingPoll(existingPoll) {
  setPoll(existingPoll);
  setPollResponses(existingPoll.responses || []);
  localStorage.setItem("cric4all-latest-team-poll-token", existingPoll.token);
}

async function deletePoll(token) {
  const confirmed = window.confirm(
    "Delete this poll and all its responses?"
  );

  if (!confirmed) return;

  const res = await fetch(`/api/team-availability-poll/${token}/delete`, {
    method: "DELETE",
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Failed to delete poll.");
    return;
  }

  if (poll?.token === token) {
    setPoll(null);
    setPollResponses([]);
    localStorage.removeItem("cric4all-latest-team-poll-token");
  }

  await loadAllPolls();
}

const pollOptionResults = getPollOptionResults();

  const bestPollOption = getBestPollOption();

  return (
    <main className="ai-splitter-page">
      <div className="ai-splitter-topbar">
        <Link href="/dashboard" className="ai-back-link">
          ← Dashboard
        </Link>
      </div>

      <section className="ai-splitter-hero">
        <span className="ai-kicker">Cric4All Team Builder</span>

        <h1>⚖️ Availability & Balanced Teams</h1>

        <p>
          Create a WhatsApp availability poll, collect player
          responses, and generate evenly balanced teams for your
          league.
        </p>
      </section>

      <section className="ai-splitter-card">
        <div className="ai-splitter-toolbar">
          <div>
            <strong>📲 Team Availability Poll</strong>
            <span>
              Create date options like Friday, Saturday, or Sunday and share the
              Cric4All voting link to WhatsApp.
            </span>
          </div>
        </div>

        <div className="poll-admin-grid">
          <input
            value={pollTitle}
            onChange={(e) => setPollTitle(e.target.value)}
            placeholder="Poll title"
          />

          <input
            value={pollText}
            onChange={(e) => setPollText(e.target.value)}
            placeholder="Custom WhatsApp message"
          />
        </div>

<div className="match-options-card">
  <div className="match-options-header">
    <div>
      <strong>📅 Match Options</strong>
      <span>Add one or more possible match dates/times.</span>
    </div>

    <button
      type="button"
      onClick={() => setShowOptionForm((prev) => !prev)}
    >
      ➕ Add Match Option
    </button>
  </div>

  {pollOptions.length > 0 ? (
    <div className="match-options-list">
      {pollOptions.map((option, index) => (
        <div key={`${option.label}-${index}`} className="match-option-pill">
          <div>
            <strong>{option.label}</strong>
            {option.startTime && (
              <small>{new Date(option.startTime).toLocaleString()}</small>
            )}
          </div>

          <button
            type="button"
            onClick={() => removePollOption(index)}
            title="Remove option"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  ) : (
    <div className="match-options-empty">
      No match options added yet. Add at least one option before creating poll.
    </div>
  )}

  {showOptionForm && (
    <div className="match-option-form">
      <input
        value={newOptionLabel}
        onChange={(e) => setNewOptionLabel(e.target.value)}
        placeholder="Example: Friday Night Match"
      />

      <input
        type="datetime-local"
        value={newOptionStartTime}
        onChange={(e) => setNewOptionStartTime(e.target.value)}
      />

      <div className="match-option-form-actions">
        <button type="button" onClick={addMatchOption}>
          Save Option
        </button>

        <button
          type="button"
          className="secondary"
          onClick={() => setShowOptionForm(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  )}
</div>

        <div className="ai-toolbar-actions poll-actions">
          <button type="button" onClick={createPoll} disabled={creatingPoll}>
            {creatingPoll ? "Creating..." : "➕ Create Poll"}
          </button>

          <button type="button" onClick={sharePollToWhatsApp} disabled={!poll}>
            📲 Share to WhatsApp
          </button>

          <button
            type="button"
            onClick={refreshPollResponses}
            disabled={!poll || refreshingPoll}
          >
            {refreshingPoll ? "Refreshing..." : "🔄 Refresh Responses"}
          </button>

          <button
            type="button"
            onClick={useBestDatePlayersFromPoll}
            disabled={!pollResponses.length}
          >
            🏆 Use Best Date Players
          </button>
        </div>
{!!allPolls.length && (
  <div className="existing-polls-box">
    <strong>📋 Existing Polls</strong>

    {allPolls.map((existingPoll) => (
      <div key={existingPoll.token} className="existing-poll-row">
        <div>
          <b>{existingPoll.title}</b>
          <small>
            {new Date(existingPoll.createdAt).toLocaleString()} •{" "}
            {existingPoll.responses?.length || 0} responses
          </small>
        </div>

        <div className="existing-poll-actions">
          <button type="button" onClick={() => openExistingPoll(existingPoll)}>
            Open
          </button>

          <button
            type="button"
            className="danger"
            onClick={() => deletePoll(existingPoll.token)}
          >
            Delete
          </button>
        </div>
      </div>
    ))}
  </div>
)}
        {poll && (
          <div className="poll-link-box">
            <strong>Poll Link</strong>
            <span>{typeof window !== "undefined"
              ? `${window.location.origin}/team-poll/${poll.token}`
              : `/team-poll/${poll.token}`}</span>
          </div>
        )}
{poll && pollOptionResults.length > 0 && (
  <section className="poll-results-card">
    <div className="poll-results-header">
      <div>
        <strong>📊 Live Poll Results</strong>
        <span>
          Responses by date option. Use any date’s YES players to generate teams.
        </span>
      </div>
    </div>

    <div className="poll-results-grid">
      {pollOptionResults.map((group) => {
        const isBest =
          bestPollOption &&
          Number(bestPollOption.id) === Number(group.option.id);

        return (
          <div
            key={group.option.id}
            className={`poll-date-result-card ${isBest ? "best" : ""}`}
          >
            <div className="poll-date-result-title">
              <div>
                <strong>
                  {isBest ? "🏆 " : "📅 "}
                  {group.option.label}
                </strong>

                {group.option.startTime && (
                  <small>
                    {new Date(group.option.startTime).toLocaleString()}
                  </small>
                )}
              </div>

              <button
                type="button"
                onClick={() => useOptionPlayers(group.option.id)}
                disabled={!group.yes.length}
              >
                Use YES Players
              </button>
            </div>

            <div className="poll-mini-counts">
              <div className="yes">
                <span>✅ Yes</span>
                <strong>{group.yes.length}</strong>
              </div>

              <div className="maybe">
                <span>🤔 Maybe</span>
                <strong>{group.maybe.length}</strong>
              </div>

              <div className="no">
                <span>❌ No</span>
                <strong>{group.no.length}</strong>
              </div>

              <div className="pending">
                <span>⚪ No Reply</span>
                <strong>{group.notResponded.length}</strong>
              </div>
            </div>

<details className="poll-player-breakdown">
  <summary className="poll-player-breakdown-summary">
    <div>
      <strong>👥 View Player Responses</strong>
      <small>
        Yes {group.yes.length} • Maybe {group.maybe.length} • No{" "}
        {group.no.length} • No Reply {group.notResponded.length}
      </small>
    </div>

    <span className="poll-player-breakdown-arrow">⌄</span>
  </summary>

  <div className="poll-response-dropdowns">
    <details className="poll-response-group yes-group">
      <summary>
        <div>
          <span>✅ Yes</span>
          <b>{group.yes.length}</b>
        </div>
        <i>⌄</i>
      </summary>

      <div className="poll-response-player-list">
        {group.yes.length ? (
          group.yes.map((r) => (
            <span key={`yes-${group.option.id}-${r.playerKey}`}>
              {r.playerName}
            </span>
          ))
        ) : (
          <small>None</small>
        )}
      </div>
    </details>

    <details className="poll-response-group maybe-group">
      <summary>
        <div>
          <span>🤔 Maybe</span>
          <b>{group.maybe.length}</b>
        </div>
        <i>⌄</i>
      </summary>

      <div className="poll-response-player-list">
        {group.maybe.length ? (
          group.maybe.map((r) => (
            <span key={`maybe-${group.option.id}-${r.playerKey}`}>
              {r.playerName}
            </span>
          ))
        ) : (
          <small>None</small>
        )}
      </div>
    </details>

    <details className="poll-response-group no-group">
      <summary>
        <div>
          <span>❌ No</span>
          <b>{group.no.length}</b>
        </div>
        <i>⌄</i>
      </summary>

      <div className="poll-response-player-list">
        {group.no.length ? (
          group.no.map((r) => (
            <span key={`no-${group.option.id}-${r.playerKey}`}>
              {r.playerName}
            </span>
          ))
        ) : (
          <small>None</small>
        )}
      </div>
    </details>

    <details className="poll-response-group pending-group">
      <summary>
        <div>
          <span>⚪ No Reply</span>
          <b>{group.notResponded.length}</b>
        </div>
        <i>⌄</i>
      </summary>

      <div className="poll-response-player-list">
        {group.notResponded.length ? (
          group.notResponded.map((p) => (
            <span key={`pending-${group.option.id}-${p.id}`}>
              {p.playerName}
            </span>
          ))
        ) : (
          <small>Everyone responded</small>
        )}
      </div>
    </details>
  </div>
</details>
          </div>
        );
      })}
    </div>
  </section>
)}
{bestPollOption && (
  <div className="poll-best-date-box polished-best-date">
    <span className="best-date-label">🏆 Best Date</span>

    <strong className="best-date-name">
      {bestPollOption.label}
    </strong>

    <small className="best-date-votes">
      {bestPollOption.yesCount} YES votes
    </small>
  </div>
)}
      </section>
<section className="team-builder-source-card">
  <div className="team-builder-source-head">
    <div>
      <strong>👥 Select Player Pools</strong>
      <span>
        Choose one or more league teams whose players can participate.
      </span>
    </div>

    <small>
      {selectedSourceTeamIds.length} selected
    </small>
  </div>

  {!leagueTeams.length ? (
    <div className="team-builder-source-empty">
      No teams found in this league.
    </div>
  ) : (
    <div className="team-builder-source-grid">
      {leagueTeams.map((team) => {
        const teamId = Number(team.id);

        const selected =
          selectedSourceTeamIds.includes(teamId);

        return (
          <button
            key={team.id}
            type="button"
            className={`team-builder-source-option ${
              selected ? "selected" : ""
            }`}
            onClick={() => {
              setSelectedSourceTeamIds((previous) =>
                selected
                  ? previous.filter(
                      (id) => Number(id) !== teamId
                    )
                  : [...previous, teamId]
              );
            }}
          >
            <span>
              {selected ? "✅" : "⬜"}
            </span>

            <div>
              <strong>{team.name}</strong>
              <small>
                {team.playerCount ?? 0} players
              </small>
            </div>
          </button>
        );
      })}
    </div>
  )}
</section>
<section className="ai-splitter-card team-builder-players-card">
  <div className="team-builder-players-head">
    <div className="team-builder-player-count">
      <strong>Available Players</strong>
      <span>
        Selected {selectedIds.length} / {players.length}
      </span>
    </div>

    <div className="team-builder-selection-actions">
      <button
        type="button"
        onClick={selectAll}
        disabled={!players.length}
      >
        Select All
      </button>

      <button
        type="button"
        onClick={clearAll}
        disabled={!players.length}
      >
        Clear
      </button>
    </div>

    <div className="generated-team-name-grid">
      <label>
        <span>Team 1 Name</span>
        <input
          value={generatedTeamAName}
          onChange={(event) =>
            setGeneratedTeamAName(event.target.value)
          }
          placeholder="Team A"
        />
      </label>

      <label>
        <span>Team 2 Name</span>
        <input
          value={generatedTeamBName}
          onChange={(event) =>
            setGeneratedTeamBName(event.target.value)
          }
          placeholder="Team B"
        />
      </label>
    </div>

    <button
      type="button"
      className="ai-primary-btn team-builder-generate-btn"
      onClick={generateTeams}
      disabled={
        balancing ||
        loadingPlayers ||
        selectedPlayers.length < 4
      }
    >
      {balancing
        ? "Balancing..."
        : "✨ Generate Balanced Teams"}
    </button>
  </div>

  {loadingPlayers ? (
    <div className="ai-empty-box">
      Loading players...
    </div>
  ) : !selectedSourceTeamIds.length ? (
    <div className="ai-empty-box">
      Select at least one player pool above.
    </div>
  ) : !players.length ? (
    <div className="ai-empty-box">
      No players found in the selected team pools.
    </div>
  ) : (
    <div className="ai-player-grid">
      {players.map((player) => (
        <button
          key={player.id}
          type="button"
          className={`ai-player-chip ${
            selectedIds.includes(player.id) ? "selected" : ""
          }`}
          onClick={() => togglePlayer(player.id)}
        >
          <span>{selectedIds.includes(player.id) ? "✅" : "⬜"}</span>

          <div>
            <strong>{player.playerName}</strong>

            <small>
              {player.sourceTeams?.join(" + ") || player.teamName || "League player"}
            </small>

            <small>
              🏏 {player.runs || 0} runs • 🎯 {player.wickets || 0} wkts
            </small>
          </div>
        </button>
      ))}
    </div>
  )}
</section>

      {result && (
        <section className="ai-result-card">
          <div className="ai-result-summary">
            <div>
              <span>Balance Quality</span>
              <strong>{result.balanceQuality}%</strong>
            </div>

            <div>
              <span>{generatedTeamAName || "Team A"} Strength</span>
              <strong>{result.teamAStrength}</strong>
            </div>

            <div>
              <span>{generatedTeamBName || "Team B"} Strength</span>
              <strong>{result.teamBStrength}</strong>
            </div>
          </div>

          <div className="ai-teams-grid">
            <div className="ai-team-box">
              <h2>🔵 {generatedTeamAName || "Team A"}</h2>

{[...result.teamA]
  .sort((a, b) => a.playerName.localeCompare(b.playerName))
  .map((player, idx) => (
    <div key={`a-${player.id}-${idx}`} className="ai-team-row">
      <span>
        <b>{idx + 1}.</b> {player.playerName}
      </span>
    </div>
  ))}
            </div>

            <div className="ai-team-box">
              <h2>🟣 {generatedTeamBName || "Team B"}</h2>

{[...result.teamB]
  .sort((a, b) => a.playerName.localeCompare(b.playerName))
  .map((player, idx) => (
    <div key={`b-${player.id}-${idx}`} className="ai-team-row">
      <span>
        <b>{idx + 1}.</b> {player.playerName}
      </span>
    </div>
  ))}
            </div>
          </div>
          {captainSuggestions && (
  <div className="captain-suggestions-card">
    <h3>⭐ Cric4All Captain Suggestions</h3>
    <p>Suggestions only. Organizer can choose anyone.</p>

    <div className="captain-suggestion-grid">
      {[
        [generatedTeamAName || "Team A", captainSuggestions.teamA || []],
        [generatedTeamBName || "Team B", captainSuggestions.teamB || []],
      ].map(([teamName, suggestions]) => (
        <div key={teamName} className="captain-team-card">
          <h4>🏏 {teamName}</h4>

          {suggestions.map((suggestion) => (
            <div key={suggestion.playerId} className="captain-choice-row">
              <strong>{suggestion.playerName}</strong>
              <span>{suggestion.label}</span>
              <small>{suggestion.reason}</small>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
)}
        </section>
      )}
    </main>
  );
}