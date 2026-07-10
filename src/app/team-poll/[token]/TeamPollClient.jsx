"use client";

import { useEffect, useMemo, useState } from "react";

export default function TeamPollClient({ token }) {
  const [poll, setPoll] = useState(null);
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dateResponses, setDateResponses] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    loadPoll();
  }, []);

  async function loadPoll() {
    setLoading(true);

    try {
      const res = await fetch(`/api/team-availability-poll/${token}`);
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to load poll.");
        return;
      }

      setPoll(data.poll);
      setPlayers(data.players || []);
    } finally {
      setLoading(false);
    }
  }

  function setOptionResponse(optionId, response) {
    setDateResponses((prev) => ({
      ...prev,
      [optionId]: response,
    }));
  }

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return players.slice(0, 20);

    return players
      .filter((p) => p.playerName.toLowerCase().includes(q))
      .slice(0, 20);
  }, [players, search]);

async function submit() {
  setSubmitError("");

  if (!selectedPlayer) {
    setSubmitError("Please select your Cric4All player name.");
    return;
  }

  const responses = Object.entries(dateResponses || {}).map(
    ([optionId, response]) => ({
      optionId: Number(optionId),
      response,
    })
  );

  if (!responses.length) {
    setSubmitError("Please choose Yes, Maybe, or No for at least one option.");
    return;
  }

  setSubmitting(true);

  try {
    const res = await fetch("/api/team-availability-poll/respond", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        playerKey: selectedPlayer.playerKey,
        playerName: selectedPlayer.playerName,
        responses,
        displayName,
        comment,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setSubmitError(data.error || "Failed to submit availability.");
      return;
    }

    setSubmitted(true);
  } catch (error) {
    console.error("Submit availability failed:", error);
    setSubmitError("Network error. Please try again.");
  } finally {
    setSubmitting(false);
  }
}

  if (loading) {
    return <main className="team-poll-page">Loading poll...</main>;
  }

  if (!poll) {
    return <main className="team-poll-page">Poll not found.</main>;
  }

  if (submitted) {
    return (
      <main className="team-poll-page">
        <section className="team-poll-card">
          <h1>✅ Response saved</h1>
          <p>Thanks! Your availability has been submitted.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="team-poll-page">
      <section className="team-poll-card">
        <span className="team-poll-kicker">Cric4All Availability Poll</span>
        <h1>🏏 {poll.title}</h1>

        {poll.matchText && <p>{poll.matchText}</p>}

        {poll.startTime && (
          <div className="team-poll-time">
            Match Start: {new Date(poll.startTime).toLocaleString()}
          </div>
        )}

        <label className="team-poll-label">Search your Cric4All name</label>
        <input
          className="team-poll-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type your name..."
        />

<details className="team-poll-player-collapse">
  <summary className="team-poll-player-summary">
    <div className="team-poll-player-summary-left">
      <span className="team-poll-player-icon">👥</span>

      <div>
        <strong>Select Player</strong>
        <small>
          {filteredPlayers.length} available player
          {filteredPlayers.length !== 1 ? "s" : ""}
        </small>
      </div>
    </div>

    <span className="team-poll-player-arrow">⌄</span>
  </summary>

  <div className="team-poll-player-list">
    {filteredPlayers.map((player) => (
      <button
        key={player.playerKey}
        type="button"
        className={`team-poll-player ${
          selectedPlayer?.playerKey === player.playerKey ? "selected" : ""
        }`}
        onClick={() => setSelectedPlayer(player)}
      >
        <strong>{player.playerName}</strong>
        <small>{player.sourceTeams?.join(" + ")}</small>
      </button>
    ))}
  </div>
</details>

        <label className="team-poll-label">Optional WhatsApp name</label>
        <input
          className="team-poll-input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Example: Sachi, Raj, KP..."
        />

        <label className="team-poll-label">Optional comment</label>
        <input
          className="team-poll-input"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Late by 10 mins, only fielding, etc."
        />

<div className="team-poll-date-options">
  <h3>Choose your availability</h3>

  {poll.options?.map((option) => (
    <div key={option.id} className="team-poll-date-card">
      <div>
        <strong>{option.label}</strong>
        {option.startTime && (
          <small>{new Date(option.startTime).toLocaleString()}</small>
        )}
      </div>

      <div className="team-poll-date-actions">
        <button
          type="button"
          className={dateResponses[option.id] === "YES" ? "selected yes" : ""}
          onClick={() => setOptionResponse(option.id, "YES")}
        >
          ✅ Yes
        </button>

        <button
          type="button"
          className={dateResponses[option.id] === "MAYBE" ? "selected maybe" : ""}
          onClick={() => setOptionResponse(option.id, "MAYBE")}
        >
          🤔 Maybe
        </button>

        <button
          type="button"
          className={dateResponses[option.id] === "NO" ? "selected no" : ""}
          onClick={() => setOptionResponse(option.id, "NO")}
        >
          ❌ No
        </button>
      </div>
    </div>
  ))}
</div>

{submitError && (
  <div className="team-poll-error">
    {submitError}
  </div>
)}

<button
  type="button"
  className="team-poll-submit-btn"
  onClick={submit}
  disabled={submitting}
>
  {submitting ? "Submitting..." : "Submit Availability"}
</button>
      </section>
    </main>
  );
}