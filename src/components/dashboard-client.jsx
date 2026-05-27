"use client";

import { useEffect, useMemo, useState } from "react";
import { EXTRA_TYPES, WICKET_TYPES } from "@/lib/scoring";

function Card({ title, children, right }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>{title}</h2>
        {right || null}
      </div>
      {children}
    </section>
  );
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function DashboardClient() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");

  const [matchDetail, setMatchDetail] = useState(null);
  const [scoreboard, setScoreboard] = useState(null);
  const [stats, setStats] = useState({ batting: [], bowling: [] });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [teamName, setTeamName] = useState("");
  const [playerForm, setPlayerForm] = useState({
    teamId: "",
    name: ""
  });

  const [matchForm, setMatchForm] = useState({
    teamAId: "",
    teamBId: "",
    battingFirstTeamId: "",
    oversPerInnings: "20",
    powerplayOversInnings: "6"
  });

  const [ballForm, setBallForm] = useState({
    inningsNo: "1",
    strikerId: "",
    nonStrikerId: "",
    bowlerId: "",
    extraType: "NONE",
    runsOffBat: "0",
    extras: "0",
    isWicket: false,
    wicketType: "NONE",
    dismissedPlayerId: "",
    newBatterId: "",
    note: ""
  });

  async function api(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  }

      async function handleShareMatch() {
      if (!scoreboard) return;

      const shareUrl = `${window.location.origin}/scoreboard/${selectedMatchId}`;

      const innings =
        scoreboard.innings?.[scoreboard.innings.length - 1];

      const shareText = `
    🏏 ${scoreboard.match.teamAName} vs ${scoreboard.match.teamBName}

    Score:
    ${innings?.teamName || ""} ${innings?.runs}/${innings?.wickets}
    Overs: ${innings?.oversDisplay}

    ${scoreboard.summary.statusText}

    Live Score:
    ${shareUrl}
      `.trim();

      try {
        if (navigator.share) {
          await navigator.share({
            title: `${scoreboard.match.teamAName} vs ${scoreboard.match.teamBName}`,
            text: shareText,
            url: shareUrl,
          });
        } else {
          await navigator.clipboard.writeText(
            `${shareText}\n\n${shareUrl}`
          );

          alert("Share link copied to clipboard");
        }
      } catch (err) {
        console.error(err);
      }
    }

  async function loadTeams() {
    const data = await api("/api/teams");
    setTeams(data);
  }

  async function loadMatches() {
    const data = await api("/api/matches");
    setMatches(data);

    if (!selectedMatchId && data.length > 0) {
      setSelectedMatchId(String(data[0].id));
    } else if (
      selectedMatchId &&
      !data.some((m) => String(m.id) === String(selectedMatchId))
    ) {
      setSelectedMatchId(data[0] ? String(data[0].id) : "");
    }
  }

  async function loadSelectedMatch(matchId) {
    if (!matchId) {
      setMatchDetail(null);
      setScoreboard(null);
      setStats({ batting: [], bowling: [] });
      return;
    }

    const [detail, board, statData] = await Promise.all([
      api(`/api/matches/${matchId}`),
      api(`/api/scoreboard/${matchId}`),
      api(`/api/stats/${matchId}`),
      api(`/api/liveview/${matchId}`)
    ]);

    setMatchDetail(detail);
    setScoreboard(board);
    setStats(statData);
  }

  async function refreshAll(matchId = selectedMatchId) {
    await Promise.all([loadTeams(), loadMatches()]);
    if (matchId) {
      await loadSelectedMatch(matchId);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadTeams(), loadMatches()]);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedMatchId) {
      loadSelectedMatch(selectedMatchId).catch((err) => setError(err.message));
    } else {
      setMatchDetail(null);
      setScoreboard(null);
      setStats({ batting: [], bowling: [] });
    }
  }, [selectedMatchId]);

  useEffect(() => {
    if (scoreboard?.currentInnings) {
      setBallForm((prev) => ({
        ...prev,
        inningsNo: String(scoreboard.currentInnings)
      }));
    }
  }, [scoreboard?.currentInnings]);

  const battingTeam = useMemo(() => {
    if (!matchDetail) return null;
    const inningsNo = Number(ballForm.inningsNo);

    const battingFirst =
      matchDetail.battingFirstTeamId === matchDetail.teamA.id
        ? matchDetail.teamA
        : matchDetail.teamB;

    const secondBat =
      matchDetail.battingFirstTeamId === matchDetail.teamA.id
        ? matchDetail.teamB
        : matchDetail.teamA;

    return inningsNo === 1 ? battingFirst : secondBat;
  }, [matchDetail, ballForm.inningsNo]);

  const bowlingTeam = useMemo(() => {
    if (!matchDetail || !battingTeam) return null;
    return battingTeam.id === matchDetail.teamA.id ? matchDetail.teamB : matchDetail.teamA;
  }, [matchDetail, battingTeam]);

  const availableNewBatters = useMemo(() => {
    if (!battingTeam) return [];
    return battingTeam.players.filter(
      (p) =>
        String(p.id) !== String(ballForm.strikerId) &&
        String(p.id) !== String(ballForm.nonStrikerId)
    );
  }, [battingTeam, ballForm.strikerId, ballForm.nonStrikerId]);

  useEffect(() => {
    if (!battingTeam || !bowlingTeam) return;

    const firstStriker = battingTeam.players[0]?.id ? String(battingTeam.players[0].id) : "";
    const secondPlayer = battingTeam.players.find(
      (p) => String(p.id) !== firstStriker
    );
    const firstNonStriker = secondPlayer?.id ? String(secondPlayer.id) : "";
    const firstBowler = bowlingTeam.players[0]?.id ? String(bowlingTeam.players[0].id) : "";

    setBallForm((prev) => ({
      ...prev,
      strikerId: prev.strikerId || firstStriker,
      nonStrikerId: prev.nonStrikerId || firstNonStriker,
      bowlerId: prev.bowlerId || firstBowler,
      dismissedPlayerId: prev.dismissedPlayerId || firstStriker
    }));
  }, [battingTeam?.id, bowlingTeam?.id]);

  useEffect(() => {
    if (!scoreboard?.currentState) return;

    setBallForm((prev) => ({
      ...prev,
      inningsNo: String(scoreboard.currentInnings || prev.inningsNo),
      strikerId: scoreboard.currentState.strikerId
        ? String(scoreboard.currentState.strikerId)
        : prev.strikerId,
      nonStrikerId: scoreboard.currentState.nonStrikerId
        ? String(scoreboard.currentState.nonStrikerId)
        : prev.nonStrikerId,
      dismissedPlayerId: scoreboard.currentState.strikerId
        ? String(scoreboard.currentState.strikerId)
        : prev.dismissedPlayerId,
      newBatterId: ""
    }));
  }, [
    scoreboard?.currentState?.strikerId,
    scoreboard?.currentState?.nonStrikerId,
    scoreboard?.currentInnings
  ]);

  async function handleAddTeam(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      await api("/api/teams", {
        method: "POST",
        body: JSON.stringify({ name: teamName.trim() })
      });
      setTeamName("");
      setMessage("✅ Team added");
      await loadTeams();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteTeam(teamId, teamName) {
    if (!confirm(`Delete team "${teamName}"?`)) return;

    setMessage("");
    setError("");

    try {
      await api(`/api/teams/${teamId}`, {
        method: "DELETE"
      });
      setMessage("🗑️ Team deleted");
      await refreshAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddPlayer(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      await api("/api/players", {
        method: "POST",
        body: JSON.stringify({
          teamId: Number(playerForm.teamId),
          name: playerForm.name.trim()
        })
      });

      setPlayerForm({ teamId: "", name: "" });
      setMessage("✅ Player added");
      await refreshAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeletePlayer(playerId, playerName) {
    if (!confirm(`Delete player "${playerName}"?`)) return;

    setMessage("");
    setError("");

    try {
      await api(`/api/players/${playerId}`, {
        method: "DELETE"
      });
      setMessage("🗑️ Player deleted");
      await refreshAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateMatch(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      const match = await api("/api/matches", {
        method: "POST",
        body: JSON.stringify({
          teamAId: Number(matchForm.teamAId),
          teamBId: Number(matchForm.teamBId),
          battingFirstTeamId: Number(matchForm.battingFirstTeamId),
          oversPerInnings: Number(matchForm.oversPerInnings),
          powerplayOversInnings: Number(matchForm.powerplayOversInnings)
        })
      });

      setMatchForm({
        teamAId: "",
        teamBId: "",
        battingFirstTeamId: "",
        oversPerInnings: "20",
        powerplayOversInnings: "6"
      });

      setMessage("✅ Match created");
      await loadMatches();
      setSelectedMatchId(String(match.id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteMatch(matchId) {
    if (!confirm("Delete this match and all its scoring data?")) return;

    setMessage("");
    setError("");

    try {
      await api(`/api/matches/${matchId}`, {
        method: "DELETE"
      });
      setMessage("🗑️ Match deleted");
      await refreshAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddBall(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!selectedMatchId) {
      setError("Please select a match");
      return;
    }

    try {
      await api("/api/balls", {
        method: "POST",
        body: JSON.stringify({
          matchId: Number(selectedMatchId),
          inningsNo: Number(ballForm.inningsNo),
          strikerId: Number(ballForm.strikerId),
          nonStrikerId: Number(ballForm.nonStrikerId),
          bowlerId: Number(ballForm.bowlerId),
          extraType: ballForm.extraType,
          runsOffBat: Number(ballForm.runsOffBat),
          extras: Number(ballForm.extras),
          isWicket: ballForm.isWicket ? 1 : 0,
          wicketType: ballForm.isWicket ? ballForm.wicketType : "NONE",
          dismissedPlayerId: ballForm.isWicket
            ? Number(ballForm.dismissedPlayerId || ballForm.strikerId)
            : null,
          newBatterId:
            ballForm.isWicket && ballForm.newBatterId
              ? Number(ballForm.newBatterId)
              : null,
          note: ballForm.note
        })
      });

      setMessage("✅ Ball added");

      setBallForm((prev) => ({
        ...prev,
        extraType: "NONE",
        runsOffBat: "0",
        extras: "0",
        isWicket: false,
        wicketType: "NONE",
        newBatterId: "",
        note: ""
      }));

      await loadSelectedMatch(selectedMatchId);
      await loadTeams();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUndoBall() {
    setMessage("");
    setError("");

    if (!selectedMatchId) {
      setError("Please select a match");
      return;
    }

    try {
      await api(`/api/matches/${selectedMatchId}/undo`, {
        method: "POST"
      });

      setMessage("↩️ Last ball removed");
      await loadSelectedMatch(selectedMatchId);
    } catch (err) {
      setError(err.message);
    }
  }
  
  const battingByTeam = stats?.batting.reduce((acc, row) => {
    if (!acc[row.teamName]) acc[row.teamName] = [];
    acc[row.teamName].push(row);
    return acc;
  }, {});

  const bowlingByTeam = stats?.bowling.reduce((acc, row) => {
    if (!acc[row.teamName]) acc[row.teamName] = [];
    acc[row.teamName].push(row);
    return acc;
  }, {});

  function quickNormalBall(runs) {
    setBallForm((prev) => ({
      ...prev,
      extraType: "NONE",
      runsOffBat: String(runs),
      extras: "0",
      isWicket: false,
      wicketType: "NONE"
    }));
  }

  function quickExtra(type) {
    setBallForm((prev) => ({
      ...prev,
      extraType: type,
      runsOffBat: "0",
      extras: "1"
    }));
  }

  function quickWicket(type = "BOWLED") {
    setBallForm((prev) => ({
      ...prev,
      isWicket: true,
      wicketType: type,
      dismissedPlayerId: prev.strikerId
    }));
  }

  const activeInnings =
    scoreboard?.innings?.find((x) => x.number === scoreboard.currentInnings) ||
    scoreboard?.innings?.[0];

  return (
    <div className="page-grid">
      <div className="grid-main">
          <Card
            title="🏏 Live Scoreboard"
            right={
              selectedMatchId ? (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleShareMatch}
                >
                  📤 Share
                </button>
              ) : null
            }
          >
          {!scoreboard ? (
            <p className="muted">Select a match to view scoreboard.</p>
          ) : (
            <div className="scoreboard-wrap">
              <div className="score-header">
                <div>
                  <h3>
                    {scoreboard.match.teamAName} vs {scoreboard.match.teamBName}
                  </h3>
                  <p className="muted small">
                    Batting first: {scoreboard.match.battingFirstTeamName} • Overs:{" "}
                    {scoreboard.match.oversPerInnings} • Powerplay:{" "}
                    {scoreboard.match.powerplayOversInnings}
                  </p>
                </div>
                <span className="pill">{scoreboard.match.status}</span>
              </div>

              <table className="score-table">
                <thead>
                  <tr>
                    <th>Innings</th>
                    <th>Team</th>
                    <th>Runs</th>
                    <th>Wkts</th>
                    <th>Overs</th>
                    <th>RR</th>
                    <th>PP</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreboard.innings.map((inn) => (
                    <tr key={inn.number}>
                      <td>{inn.number}</td>
                      <td>{inn.teamName}</td>
                      <td>{inn.runs}</td>
                      <td>{inn.wickets}</td>
                      <td>{inn.oversDisplay}</td>
                      <td>{inn.runRate}</td>
                      <td>{inn.powerplay.runs}/{inn.powerplay.wickets}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {scoreboard.currentState ? (
                <div className="result-box">
                  <p><strong>🎯 Current innings:</strong> {scoreboard.currentInnings}</p>
                  <p><strong>🏏 Striker:</strong> {scoreboard.currentState.strikerName}</p>
                  <p><strong>🏃 Non-striker:</strong> {scoreboard.currentState.nonStrikerName}</p>
                  <p>
                    <strong>⏭️ Next ball:</strong>{" "}
                    {scoreboard.currentState.nextOverNo}.{scoreboard.currentState.nextBallInOver}
                  </p>
                </div>
              ) : null}

              <div className="result-box">
                <p><strong>📌 Status:</strong> {scoreboard.summary.statusText}</p>
                {scoreboard.summary.target ? (
                  <p><strong>🎯 Target:</strong> {scoreboard.summary.target}</p>
                ) : null}
                {scoreboard.summary.remainingBalls !== null ? (
                  <p><strong>⏳ Remaining balls:</strong> {scoreboard.summary.remainingBalls}</p>
                ) : null}
              </div>

              <div>
                <h4>🤝 Partnerships</h4>
                {!activeInnings?.partnerships?.length ? (
                  <p className="muted">No partnerships yet</p>
                ) : (
                  <table className="score-table">
                    <thead>
                      <tr>
                        <th>Batters</th>
                        <th>Runs</th>
                        <th>Balls</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeInnings.partnerships.map((p, idx) => (
                        <tr key={idx}>
                          <td>{p.batter1} & {p.batter2}</td>
                          <td>{p.runs}</td>
                          <td>{p.balls}</td>
                          <td>{p.ongoing ? "Current" : `Ended at wicket ${p.wicketNumber}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div>
                <h4>💥 Fall of Wickets</h4>
                {!activeInnings?.fallOfWickets?.length ? (
                  <p className="muted">No wickets yet</p>
                ) : (
                  <table className="score-table">
                    <thead>
                      <tr>
                        <th>Wkt</th>
                        <th>Score</th>
                        <th>Player Out</th>
                        <th>Over</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeInnings.fallOfWickets.map((w, idx) => (
                        <tr key={idx}>
                          <td>{w.wicketNumber}</td>
                          <td>{w.score}</td>
                          <td>{w.playerOut}</td>
                          <td>{w.over}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div>
                <h4>🕘 Recent Balls</h4>
                <div className="recent-balls">
                  {scoreboard.recentBalls.length === 0 ? (
                    <span className="muted">No deliveries yet</span>
                  ) : (
                    scoreboard.recentBalls.map((item) => (
                      <span key={item.id} className="tag">
                        {item.label}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card
          title="🎯 Advanced Scoring"
          right={
            <button type="button" className="btn btn-outline" onClick={handleUndoBall}>
              Undo last ball
            </button>
          }
        >
          {!matchDetail ? (
            <p className="muted">Select a match first.</p>
          ) : (
            <>
              <div className="quick-actions">
                <button type="button" className="chip" onClick={() => quickNormalBall(0)}>0</button>
                <button type="button" className="chip" onClick={() => quickNormalBall(1)}>1</button>
                <button type="button" className="chip" onClick={() => quickNormalBall(2)}>2</button>
                <button type="button" className="chip" onClick={() => quickNormalBall(3)}>3</button>
                <button type="button" className="chip" onClick={() => quickNormalBall(4)}>4</button>
                <button type="button" className="chip" onClick={() => quickNormalBall(6)}>6</button>
                <button type="button" className="chip" onClick={() => quickExtra("WIDE")}>Wd</button>
                <button type="button" className="chip" onClick={() => quickExtra("NOBALL")}>Nb</button>
                <button type="button" className="chip" onClick={() => quickExtra("BYE")}>B</button>
                <button type="button" className="chip" onClick={() => quickExtra("LEGBYE")}>LB</button>
                <button type="button" className="chip chip-danger" onClick={() => quickWicket("BOWLED")}>W</button>
              </div>

              <form className="form grid-2" onSubmit={handleAddBall}>
                <label>
                  <span>Innings</span>
                  <select
                    value={ballForm.inningsNo}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, inningsNo: e.target.value }))
                    }
                  >
                    <option value="1">Innings 1</option>
                    <option value="2">Innings 2</option>
                  </select>
                </label>

                <label>
                  <span>Striker</span>
                  <select
                    value={ballForm.strikerId}
                    onChange={(e) =>
                      setBallForm((prev) => ({
                        ...prev,
                        strikerId: e.target.value,
                        dismissedPlayerId: e.target.value
                      }))
                    }
                    required
                  >
                    <option value="">Select striker</option>
                    {(battingTeam?.players || []).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Non-striker</span>
                  <select
                    value={ballForm.nonStrikerId}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, nonStrikerId: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select non-striker</option>
                    {(battingTeam?.players || []).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Bowler</span>
                  <select
                    value={ballForm.bowlerId}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, bowlerId: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select bowler</option>
                    {(bowlingTeam?.players || []).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Extra Type</span>
                  <select
                    value={ballForm.extraType}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, extraType: e.target.value }))
                    }
                  >
                    {EXTRA_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Runs Off Bat</span>
                  <input
                    type="number"
                    min="0"
                    value={ballForm.runsOffBat}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, runsOffBat: e.target.value }))
                    }
                    required
                  />
                </label>

                <label>
                  <span>Extras</span>
                  <input
                    type="number"
                    min="0"
                    value={ballForm.extras}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, extras: e.target.value }))
                    }
                    required
                  />
                </label>

                <label className="checkbox-row">
                  <span>Wicket</span>
                  <input
                    type="checkbox"
                    checked={ballForm.isWicket}
                    onChange={(e) =>
                      setBallForm((prev) => ({
                        ...prev,
                        isWicket: e.target.checked,
                        wicketType: e.target.checked ? "BOWLED" : "NONE"
                      }))
                    }
                  />
                </label>

                <label>
                  <span>Wicket Type</span>
                  <select
                    value={ballForm.wicketType}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, wicketType: e.target.value }))
                    }
                    disabled={!ballForm.isWicket}
                  >
                    {WICKET_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Dismissed Player</span>
                  <select
                    value={ballForm.dismissedPlayerId}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, dismissedPlayerId: e.target.value }))
                    }
                    disabled={!ballForm.isWicket}
                  >
                    <option value="">Select dismissed player</option>
                    {(battingTeam?.players || []).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>New Batter</span>
                  <select
                    value={ballForm.newBatterId}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, newBatterId: e.target.value }))
                    }
                    disabled={!ballForm.isWicket}
                  >
                    <option value="">Select new batter</option>
                    {availableNewBatters.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>

                <label className="full-span">
                  <span>Note</span>
                  <input
                    type="text"
                    value={ballForm.note}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, note: e.target.value }))
                    }
                    placeholder="Optional note"
                  />
                </label>

                <div className="full-span">
                  <button type="submit" className="btn">Add Delivery</button>
                </div>
              </form>
            </>
          )}
        </Card>

        <Card title="📊 Player Statistics">
          {!stats ? (
            <p className="muted">Select a match.</p>
          ) : (
            <div className="stats-grid">
              <div>
                  <h4>Batting</h4>

                  {Object.entries(battingByTeam || {}).map(([teamName, players]) => (
                    <div key={teamName} style={{ marginBottom: 24 }}>
                      <h5>{teamName}</h5>

                      <table className="score-table">
                        <thead>
                          <tr>
                            <th>Player</th>
                            <th>R</th>
                            <th>B</th>
                            <th>4s</th>
                            <th>6s</th>
                            <th>SR</th>
                            <th>Out</th>
                          </tr>
                        </thead>

                        <tbody>
                          {players.map((row) => (
                            <tr key={row.playerId}>
                              <td>{row.playerName}</td>
                              <td>{row.runs}</td>
                              <td>{row.balls}</td>
                              <td>{row.fours}</td>
                              <td>{row.sixes}</td>
                              <td>{row.strikeRate}</td>
                              <td>{row.outs ? row.dismissal : "not out"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              <div>
                        <h4>Bowling</h4>
                        {Object.entries(bowlingByTeam || {}).map(([teamName, players]) => (
                          <div key={teamName} style={{ marginBottom: 24 }}>
                            <h5>{teamName}</h5>

                            <table className="score-table">
                              <thead>
                                <tr>
                                  <th>Player</th>
                                  <th>O</th>
                                  <th>R</th>
                                  <th>W</th>
                                  <th>Dots</th>
                                  <th>Eco</th>
                                </tr>
                              </thead>

                              <tbody>
                                {players.map((row) => (
                                  <tr key={row.playerId}>
                                    <td>{row.playerName}</td>
                                    <td>{row.overs}</td>
                                    <td>{row.runs}</td>
                                    <td>{row.wickets}</td>
                                    <td>{row.dots}</td>
                                    <td>{row.economy}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
            </div>
          )}
        </Card>
      </div>
      <div className="grid-side">
        <Card title="👥 Teams">
          <form className="form stack" onSubmit={handleAddTeam}>
            <label>
              <span>Team name</span>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Enter team name"
                required
              />
            </label>
            <button type="submit" className="btn">Add Team</button>
          </form>

          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            {teams.map((team) => (
              <div key={team.id} className="card" style={{ padding: 12 }}>
                <div className="card-head">
                  <h4>{team.name}</h4>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => handleDeleteTeam(team.id, team.name)}
                  >
                    Delete
                  </button>
                </div>

                <div className="tags">
                  {team.players.length === 0 ? (
                    <span className="muted">No players</span>
                  ) : (
                    team.players.map((player) => (
                      <span key={player.id} className="tag">
                        {player.name}
                        <button
                          type="button"
                          style={{
                            marginLeft: 8,
                            background: "transparent",
                            color: "inherit",
                            border: "none",
                            cursor: "pointer"
                          }}
                          onClick={() => handleDeletePlayer(player.id, player.name)}
                        >
                          ✖
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="🧍 Add Player">
          <form className="form stack" onSubmit={handleAddPlayer}>
            <label>
              <span>Team</span>
              <select
                value={playerForm.teamId}
                onChange={(e) =>
                  setPlayerForm((prev) => ({ ...prev, teamId: e.target.value }))
                }
                required
              >
                <option value="">Select team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Player name</span>
              <input
                type="text"
                value={playerForm.name}
                onChange={(e) =>
                  setPlayerForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Enter player name"
                required
              />
            </label>

            <button type="submit" className="btn">Add Player</button>
          </form>
        </Card>

        <Card title="🗓️ Create Match">
          <form className="form stack" onSubmit={handleCreateMatch}>
            <label>
              <span>Team A</span>
              <select
                value={matchForm.teamAId}
                onChange={(e) =>
                  setMatchForm((prev) => ({ ...prev, teamAId: e.target.value }))
                }
                required
              >
                <option value="">Select Team A</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Team B</span>
              <select
                value={matchForm.teamBId}
                onChange={(e) =>
                  setMatchForm((prev) => ({ ...prev, teamBId: e.target.value }))
                }
                required
              >
                <option value="">Select Team B</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Batting First</span>
              <select
                value={matchForm.battingFirstTeamId}
                onChange={(e) =>
                  setMatchForm((prev) => ({
                    ...prev,
                    battingFirstTeamId: e.target.value
                  }))
                }
                required
              >
                <option value="">Select batting first team</option>
                {teams
                  .filter((t) => [matchForm.teamAId, matchForm.teamBId].includes(String(t.id)))
                  .map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
              </select>
            </label>

            <label>
              <span>Overs per innings</span>
              <input
                type="number"
                min="1"
                value={matchForm.oversPerInnings}
                onChange={(e) =>
                  setMatchForm((prev) => ({
                    ...prev,
                    oversPerInnings: e.target.value
                  }))
                }
                required
              />
            </label>

            <label>
              <span>Powerplay overs</span>
              <input
                type="number"
                min="0"
                value={matchForm.powerplayOversInnings}
                onChange={(e) =>
                  setMatchForm((prev) => ({
                    ...prev,
                    powerplayOversInnings: e.target.value
                  }))
                }
              />
            </label>

            <button type="submit" className="btn">Create Match</button>
          </form>
        </Card>

        <Card title="📋 Matches">
          {matches.length === 0 ? (
            <p className="muted">No matches yet</p>
          ) : (
            <div className="match-list">
              {matches.map((match) => (
                <div
                  key={match.id}
                  className={`match-item ${String(match.id) === String(selectedMatchId) ? "active" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedMatchId(String(match.id))}
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      color: "inherit",
                      textAlign: "left",
                      cursor: "pointer"
                    }}
                  >
                    <div>
                      <strong>
                        #{match.id} • {match.teamAName} vs {match.teamBName}
                      </strong>
                      <div className="muted small">
                        Bat first: {match.battingFirstTeamName} • {match.oversPerInnings} overs
                      </div>
                      <div className="muted small">{formatDate(match.createdAt)}</div>
                    </div>
                  </button>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span className="pill">{match.status}</span>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => handleDeleteMatch(match.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {(message || error) && (
          <Card title="ℹ️ Notifications">
            {message ? <p className="success">{message}</p> : null}
            {error ? <p className="error">{error}</p> : null}
          </Card>
        )}
      </div>
    </div>
  );
}