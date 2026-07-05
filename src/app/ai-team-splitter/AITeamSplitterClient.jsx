"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  const [players, setPlayers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [result, setResult] = useState(null);

  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [balancing, setBalancing] = useState(false);

  const [poll, setPoll] = useState(null);
  const [pollTitle, setPollTitle] = useState("Surprise Match Availability");
  const [pollText, setPollText] = useState("");
  const [pollResponses, setPollResponses] = useState([]);
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [refreshingPoll, setRefreshingPoll] = useState(false);

  const [pollOptions, setPollOptions] = useState([
    { label: "", startTime: "" },
  ]);

  useEffect(() => {
    loadPlayers();
  }, []);

  const selectedPlayers = useMemo(
    () => players.filter((p) => selectedIds.includes(p.id)),
    [players, selectedIds]
  );

  async function loadPlayers() {
    setLoadingPlayers(true);

    try {
      const playerRes = await fetch("/api/ai-team-splitter/players");
      const playerData = await playerRes.json();

      if (!playerRes.ok) {
        alert(playerData.error || "Failed to load players.");
        return;
      }

      const statsRes = await fetch(`/api/leagues/${playerData.leagueId}/stats`);
      const statsData = await statsRes.json();

      if (!statsRes.ok) {
        alert(statsData.error || "Failed to load league stats.");
        return;
      }

      const mergedPlayers = mergeStatsIntoPlayers(
        playerData.players || [],
        statsData
      );

      setPlayers(mergedPlayers);
      setSelectedIds(mergedPlayers.map((p) => p.id));
    } catch (error) {
      console.error("Load AI splitter players failed:", error);
      alert("Failed to load players.");
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

  function updatePollOption(index, field, value) {
    setPollOptions((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  }

  function addPollOption() {
    setPollOptions((prev) => [...prev, { label: "", startTime: "" }]);
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
          leagueId: players?.[0]?.leagueId || null,
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
    } catch (error) {
      console.error("Generate balanced teams failed:", error);
      alert("Failed to balance teams.");
    } finally {
      setBalancing(false);
    }
  }

  const bestPollOption = getBestPollOption();

  return (
    <main className="ai-splitter-page">
      <div className="ai-splitter-topbar">
        <Link href="/dashboard" className="ai-back-link">
          ← Dashboard
        </Link>
      </div>

      <section className="ai-splitter-hero">
        <span className="ai-kicker">Cric4All AI</span>
        <h1>🤖 AI Surprise Team Splitter</h1>
        <p>
          Create a WhatsApp availability poll, collect votes for multiple dates,
          then use the best date’s available players to generate balanced
          Surprise 1 and Surprise 2 teams.
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

        <div className="poll-options-admin compact">
  <div className="poll-options-header">
    <strong>Match Date Options</strong>
    <button type="button" onClick={addPollOption}>
      ➕ Add Date
    </button>
  </div>

  {pollOptions.map((option, index) => (
    <div key={index} className="poll-option-compact-row">
      <input
        value={option.label}
        onChange={(e) =>
          updatePollOption(index, "label", e.target.value)
        }
        placeholder={`Option ${index + 1} label`}
      />

      <input
        type="datetime-local"
        value={option.startTime}
        onChange={(e) =>
          updatePollOption(index, "startTime", e.target.value)
        }
      />

      {pollOptions.length > 1 && (
        <button
          type="button"
          className="poll-remove-option-btn"
          onClick={() => removePollOption(index)}
          title="Remove date option"
        >
          ✕
        </button>
      )}
    </div>
  ))}
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

        {poll && (
          <div className="poll-link-box">
            <strong>Poll Link</strong>
            <span>{`${window.location.origin}/team-poll/${poll.token}`}</span>
          </div>
        )}

        {!!pollResponses.length && (
          <div className="poll-response-summary">
            <div>
              <span>✅ Yes</span>
              <strong>
                {pollResponses.filter((r) => r.response === "YES").length}
              </strong>
            </div>

            <div>
              <span>🤔 Maybe</span>
              <strong>
                {pollResponses.filter((r) => r.response === "MAYBE").length}
              </strong>
            </div>

            <div>
              <span>❌ No</span>
              <strong>
                {pollResponses.filter((r) => r.response === "NO").length}
              </strong>
            </div>
          </div>
        )}

        {bestPollOption && (
          <div className="poll-best-date-box">
            <span>🏆 Best Date</span>
            <strong>{bestPollOption.label}</strong>
            <small>{bestPollOption.yesCount} YES votes</small>
          </div>
        )}
      </section>

      <section className="ai-splitter-card">
        <div className="ai-splitter-toolbar">
          <div>
            <strong>Available Players</strong>
            <span>
              Selected {selectedIds.length} / {players.length}
            </span>
          </div>

          <div className="ai-toolbar-actions">
            <button type="button" onClick={selectAll}>
              Select All
            </button>

            <button type="button" onClick={clearAll}>
              Clear
            </button>

            <button
              type="button"
              className="ai-primary-btn"
              onClick={generateTeams}
              disabled={balancing || loadingPlayers}
            >
              {balancing ? "Balancing..." : "✨ Generate Balanced Teams"}
            </button>
          </div>
        </div>

        {loadingPlayers ? (
          <div className="ai-empty-box">Loading players...</div>
        ) : !players.length ? (
          <div className="ai-empty-box">
            No players found for Surprise 1 and Surprise 2.
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
                    {player.sourceTeams?.join(" + ") || player.teamName}
                  </small>

                  <small>
                    🏏 {player.runs} runs • 🎯 {player.wickets} wkts
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
              <span>Surprise 1 Strength</span>
              <strong>{result.teamAStrength}</strong>
            </div>

            <div>
              <span>Surprise 2 Strength</span>
              <strong>{result.teamBStrength}</strong>
            </div>
          </div>

          <div className="ai-teams-grid">
            <div className="ai-team-box">
              <h2>🔵 Surprise 1</h2>

              {result.teamA.map((player, idx) => (
                <div key={`a-${player.id}-${idx}`} className="ai-team-row">
                  <span>
                    <b>{idx + 1}.</b> {player.playerName}
                  </span>

                  <strong>{player.skillScore}</strong>
                </div>
              ))}
            </div>

            <div className="ai-team-box">
              <h2>🟣 Surprise 2</h2>

              {result.teamB.map((player, idx) => (
                <div key={`b-${player.id}-${idx}`} className="ai-team-row">
                  <span>
                    <b>{idx + 1}.</b> {player.playerName}
                  </span>

                  <strong>{player.skillScore}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}