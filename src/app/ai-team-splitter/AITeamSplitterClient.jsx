"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function AITeamSplitterClient() {
  const [players, setPlayers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [result, setResult] = useState(null);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [balancing, setBalancing] = useState(false);

  useEffect(() => {
    loadPlayers();
  }, []);

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
  } finally {
    setLoadingPlayers(false);
  }
}

  const selectedPlayers = useMemo(
    () => players.filter((p) => selectedIds.includes(p.id)),
    [players, selectedIds]
  );

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
    } finally {
      setBalancing(false);
    }
  }

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
          Select available players from Surprise 1 and Surprise 2. Cric4All AI
          will split them into two equal teams based on player strength.
        </p>
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

              {result.teamA.map((p, idx) => (
                <div key={`a-${p.id}-${idx}`} className="ai-team-row">
                  <span>
                    <b>{idx + 1}.</b> {p.playerName}
                  </span>
                </div>
              ))}
            </div>

            <div className="ai-team-box">
              <h2>🟣 Surprise 2</h2>

              {result.teamB.map((p, idx) => (
                <div key={`b-${p.id}-${idx}`} className="ai-team-row">
                  <span>
                    <b>{idx + 1}.</b> {p.playerName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}