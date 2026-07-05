"use client";

import { useState } from "react";

export default function AITeamBalancer({ players = [] }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  function togglePlayer(playerId) {
    setSelectedIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  }

  async function generateTeams() {
    const selectedPlayers = players.filter((p) => selectedIds.includes(p.id));

    if (selectedPlayers.length < 4) {
      alert("Please select at least 4 players.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/team-balancer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ players: selectedPlayers }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to balance teams.");
        return;
      }

      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ai-balancer-card">
      <div className="ai-balancer-header">
        <div>
          <h3>🤖 AI Team Balancer</h3>
          <p>Select available players and split teams fairly by skill.</p>
        </div>

        <button
          type="button"
          onClick={generateTeams}
          disabled={loading}
          className="ai-balance-btn"
        >
          {loading ? "Balancing..." : "Generate Balanced Teams"}
        </button>
      </div>

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
            <strong>{player.playerName || player.name}</strong>
            <small>{player.teamName || player.team?.name || "Player"}</small>
          </button>
        ))}
      </div>

      {result && (
        <div className="ai-balance-result">
          <div className="ai-balance-summary">
            <div>
              <span>Balance Quality</span>
              <strong>{result.balanceQuality}%</strong>
            </div>

            <div>
              <span>Team A Strength</span>
              <strong>{result.totalsA.total.toFixed(1)}</strong>
            </div>

            <div>
              <span>Team B Strength</span>
              <strong>{result.totalsB.total.toFixed(1)}</strong>
            </div>
          </div>

          <div className="ai-teams-grid">
            <div className="ai-team-box">
              <h4>🔵 Team A</h4>
              {result.teamA.map((p) => (
                <div key={p.id} className="ai-team-player">
                  <span>{p.playerName || p.name}</span>
                  <b>{p.skillScore}</b>
                </div>
              ))}
            </div>

            <div className="ai-team-box">
              <h4>🟣 Team B</h4>
              {result.teamB.map((p) => (
                <div key={p.id} className="ai-team-player">
                  <span>{p.playerName || p.name}</span>
                  <b>{p.skillScore}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="ai-vote-row">
            <button type="button">👍 Fair Teams</button>
            <button type="button">👎 Not Balanced</button>
            <button type="button">🔁 Suggest Swap</button>
          </div>
        </div>
      )}
    </div>
  );
}