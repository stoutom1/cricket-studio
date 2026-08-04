"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import navStyles from "./team-poll-navigation.module.css";

export default function TeamPollClient({
  token,
  returnTo: returnToProp = "",
}) {
  const returnTo =
    returnToProp.startsWith("/") &&
    !returnToProp.startsWith("//")
      ? returnToProp
      : "";

  const returnLabel =
    returnTo.includes("/match-day")
      ? "Back to Match Day"
      : "Back";
  const [poll, setPoll] = useState(null);
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [comment, setComment] = useState("");
  const [dateResponses, setDateResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadPoll();
  }, [token]);

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return players.slice(0, 80);
    return players
      .filter((player) =>
        `${player.playerName} ${(player.sourceTeams || []).join(" ")}`
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 80);
  }, [players, search]);

  async function loadPoll() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/team-availability-poll/${token}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load poll.");
      setPoll(data.poll);
      setPlayers(data.poll?.players || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load poll.");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setError("");
    if (!selectedPlayer) {
      setError("Please select your Cric4All player name.");
      return;
    }
    const responses = Object.entries(dateResponses).map(([optionId, response]) => ({
      optionId: Number(optionId),
      response,
    }));
    if (!responses.length) {
      setError("Choose Yes, Maybe, or No for at least one match option.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/team-availability-poll/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          playerKey: selectedPlayer.playerKey,
          playerName: selectedPlayer.playerName,
          responses,
          displayName,
          comment,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to submit availability.");
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError.message || "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const returnNavigation =
    returnTo ? (
      <div className={navStyles.returnBar}>
        <Link
          href={returnTo}
          className={navStyles.returnButton}
        >
          <span aria-hidden="true">←</span>
          <span>{returnLabel}</span>
        </Link>

        {returnTo.includes(
          "/match-day"
        ) && (
          <small>
            Return to the selected match workflow
          </small>
        )}
      </div>
    ) : null;

  if (loading) return (
    <main className="team-poll-page">
      {returnNavigation}
      <section className="team-poll-card">
        Loading poll...
      </section>
    </main>
  );
  if (error && !poll) return (
    <main className="team-poll-page">
      {returnNavigation}
      <section className="team-poll-card">
        <h1>Unable to open poll</h1>
        <p>{error}</p>
      </section>
    </main>
  );
  if (submitted) return (
    <main className="team-poll-page">
      {returnNavigation}
      <section className="team-poll-card">
        <span className="team-poll-kicker">
          Cric4All Availability Poll
        </span>

        <h1>✅ Response saved</h1>

        <p>
          Thanks! Your availability has been submitted successfully.
        </p>

        {returnTo && (
          <Link
            href={returnTo}
            className={navStyles.submittedReturnButton}
          >
            {returnLabel}
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </section>
    </main>
  );

  return (
    <main className="team-poll-page">
      {returnNavigation}

      <section className="team-poll-card">
        <span className="team-poll-kicker">Cric4All Availability Poll</span>
        <h1>🏏 {poll.title}</h1>
        {poll.matchText && <p>{poll.matchText}</p>}

        <div className="team-poll-progress">
          <span className={selectedPlayer ? "complete" : "active"}>1. Your name</span>
          <span className={selectedPlayer ? "active" : ""}>2. Availability</span>
          <span>3. Submit</span>
        </div>

        <label className="team-poll-label">Find your Cric4All player name</label>
        <input className="team-poll-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Start typing your name..." />

        {selectedPlayer && (
          <div className="team-poll-selected-player">
            <div><small>Selected player</small><strong>{selectedPlayer.playerName}</strong><span>{selectedPlayer.sourceTeams?.join(" + ")}</span></div>
            <button type="button" onClick={() => setSelectedPlayer(null)}>Change</button>
          </div>
        )}

        {!selectedPlayer && (
          <div className="team-poll-player-list">
            {filteredPlayers.map((player) => (
              <button key={player.playerKey} type="button" className="team-poll-player" onClick={() => { setSelectedPlayer(player); setSearch(player.playerName); }}>
                <strong>{player.playerName}</strong><small>{player.sourceTeams?.join(" + ")}</small><span>Choose</span>
              </button>
            ))}
            {!filteredPlayers.length && <div className="team-poll-empty">No matching player found.</div>}
          </div>
        )}

        <div className="team-poll-date-options">
          <h3>Choose your availability</h3>
          {poll.options?.map((option) => (
            <div key={option.id} className="team-poll-date-card">
              <div><strong>{option.label}</strong>{option.startTime && <small>{new Date(option.startTime).toLocaleString()}</small>}</div>
              <div className="team-poll-date-actions">
                {[["YES", "✅ Yes"], ["MAYBE", "🤔 Maybe"], ["NO", "❌ No"]].map(([value, label]) => (
                  <button key={value} type="button" className={dateResponses[option.id] === value ? `selected ${value.toLowerCase()}` : ""} onClick={() => setDateResponses((current) => ({ ...current, [option.id]: value }))}>{label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="team-poll-optional-grid">
          <label><span>Optional WhatsApp name</span><input className="team-poll-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Sachi, Raj, KP..." /></label>
          <label><span>Optional comment</span><input className="team-poll-input" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Late by 10 minutes..." /></label>
        </div>

        {error && <div className="team-poll-error">{error}</div>}
        <button type="button" className="team-poll-submit-btn" onClick={submit} disabled={submitting}>{submitting ? "Submitting..." : "Submit Availability"}</button>
      </section>
    </main>
  );
}
