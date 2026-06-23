"use client";

import { useEffect, useState } from "react";

function getBallDisplay(label) {
  const raw =
    String(label || "")
      .split(" ")
      .slice(1)
      .join(" ")
      .replace(/[()]/g, "")
      .trim() || "-";

  const upper = raw.toUpperCase();

  if (raw === "4") return { text: "4", type: "four" };
  if (raw === "6") return { text: "6", type: "six" };

  if (upper.includes("W") && !upper.includes("WD")) {
    return { text: "W", type: "wicket" };
  }

  if (
    upper.includes("WD") ||
    upper.includes("NB") ||
    upper.includes("LB") ||
    upper === "B" ||
    upper.startsWith("B")
  ) {
    return { text: raw, type: "extra" };
  }

  return { text: raw, type: "normal" };
}

function InfoPill({ label, value }) {
  return (
    <div className="live-info-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PlayerCard({ label, name, value }) {
  return (
    <div className="live-player-card">
      <span>{label}</span>
      <strong>{name || "-"}</strong>
      {value && <small>{value}</small>}
    </div>
  );
}

function ProTable({ children }) {
  return (
    <div className="live-table-wrap">
      <table className="live-pro-table">{children}</table>
    </div>
  );
}

export default function LiveScoreClient({ matchId }) {
  const [scoreboard, setScoreboard] = useState(null);
  const [error, setError] = useState("");
  const [collapsedInnings, setCollapsedInnings] = useState({});

  function toggleInnings(inningsNo) {
    setCollapsedInnings((prev) => ({
      ...prev,
      [inningsNo]: !prev[inningsNo],
    }));
  }

  useEffect(() => {
    async function loadScorecard() {
      try {
        const res = await fetch(`/api/liveview/${matchId}`);

        if (!res.ok) {
          throw new Error("Failed to load scorecard");
        }

        const data = await res.json();
        setScoreboard(data);
      } catch (err) {
        setError(err.message);
      }
    }

    loadScorecard();

    const interval = setInterval(loadScorecard, 5000);
    return () => clearInterval(interval);
  }, [matchId]);

  if (error) {
    return (
      <main className="live-page-shell">
        <div className="live-error-card">
          <h2>Unable to load scorecard</h2>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!scoreboard) {
    return (
      <main className="live-page-shell">
        <div className="live-loading-card">
          <div className="live-loading-dot" />
          <h2>Loading live scorecard...</h2>
        </div>
      </main>
    );
  }

  const latestInnings =
    scoreboard?.innings?.find(
      (inn) => inn.number === scoreboard?.currentInnings
    ) ??
    scoreboard?.innings?.[scoreboard?.innings?.length - 1] ??
    null;

  const ballsLeft = scoreboard?.summary?.remainingBalls;

  const strikerValue = scoreboard?.currentState?.strikerStats
    ? `${scoreboard.currentState.strikerStats.runs} (${scoreboard.currentState.strikerStats.balls})`
    : "";

  const nonStrikerValue = scoreboard?.currentState?.nonStrikerStats
    ? `${scoreboard.currentState.nonStrikerStats.runs} (${scoreboard.currentState.nonStrikerStats.balls})`
    : "";

  const bowlerValue = scoreboard?.currentState?.bowlerStats
    ? `${scoreboard.currentState.bowlerStats.wickets}/${scoreboard.currentState.bowlerStats.runs} in ${scoreboard.currentState.bowlerStats.overs} ov`
    : "";

  return (
    <main className="live-page-shell">
      <section className="live-hero-card">
        <div className="live-hero-top">
          <span className="live-pill">● LIVE SCORE</span>
          <span className="live-refresh">Auto refreshes every 5s</span>
        </div>

        <div className="live-match-title">
          {scoreboard?.match?.teamAName} vs {scoreboard?.match?.teamBName}
        </div>

        <div className="live-score-row">
          <div className="live-main-score">
            {latestInnings
              ? `${latestInnings.runs}/${latestInnings.wickets}`
              : "-"}
          </div>

          <div className="live-score-side">
            <span>Current innings</span>
            <strong>
              {latestInnings
                ? `Innings ${latestInnings.number} • ${latestInnings.oversDisplay} ov`
                : "-"}
            </strong>
          </div>
        </div>

        <p className="live-status-text">
          {scoreboard?.summary?.statusText || "Match in progress"}
        </p>

        <div className="live-recent-section">
          <span>Recent</span>

          <div className="live-recent-strip">
            {scoreboard?.recentBalls?.slice(-12).map((ball, index) => {
              const item = getBallDisplay(ball.label);

              return (
                <b
                  key={ball.id || index}
                  className={`live-ball live-ball-${item.type}`}
                >
                  {item.text}
                </b>
              );
            })}
          </div>
        </div>

        <div className="live-hero-metrics">
          <InfoPill
            label="Overs"
            value={latestInnings?.oversDisplay || "0.0"}
          />

          <InfoPill
            label="Run Rate"
            value={latestInnings?.runRate || "0.00"}
          />

          <InfoPill
            label="Target"
            value={
              scoreboard?.currentInnings === 2 && scoreboard?.summary?.target
                ? scoreboard.summary.target
                : "—"
            }
          />

          <InfoPill label="Balls Left" value={ballsLeft ?? "—"} />
        </div>
      </section>

      <section className="live-current-grid">
        <PlayerCard
          label="🏏 Striker"
          name={scoreboard?.currentState?.strikerName || "-"}
          value={strikerValue}
        />

        <PlayerCard
          label="🏃 Non-striker"
          name={scoreboard?.currentState?.nonStrikerName || "-"}
          value={nonStrikerValue}
        />

        <PlayerCard
          label="🎯 Bowler"
          name={scoreboard?.currentState?.bowlerName || "-"}
          value={bowlerValue}
        />
      </section>

      {scoreboard?.innings?.map((innings) => {
        const isCollapsed = collapsedInnings[innings.number];

        return (
          <section key={innings.number} className="live-innings-card">
            <button
              type="button"
              className="live-innings-header"
              onClick={() => toggleInnings(innings.number)}
            >
              <div>
                <span>Innings {innings.number}</span>
                <strong>{innings.teamName}</strong>
              </div>

              <b>
                {innings.runs}/{innings.wickets} ({innings.oversDisplay})
              </b>

              <i>{isCollapsed ? "+" : "−"}</i>
            </button>

            {!isCollapsed && (
              <div className="live-innings-body">
                <div className="live-summary-grid">
                  <InfoPill
                    label="Score"
                    value={`${innings.runs}/${innings.wickets}`}
                  />
                  <InfoPill label="Overs" value={innings.oversDisplay} />
                  <InfoPill label="Run Rate" value={innings.runRate} />
                  <InfoPill
                    label="Powerplay"
                    value={`${innings.powerplay?.runs || 0}/${
                      innings.powerplay?.wickets || 0
                    }`}
                  />
                </div>

                <h3 className="live-section-title">🏏 Batting Scorecard</h3>

                <ProTable>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>R</th>
                      <th>B</th>
                      <th>4s</th>
                      <th>6s</th>
                      <th>SR</th>
                      <th>Dismissal</th>
                    </tr>
                  </thead>

                  <tbody>
                    {innings?.battingStats?.map((batter) => (
                      <tr key={batter.playerId}>
                        <td className="name-cell">{batter.playerName}</td>
                        <td>{batter.runs}</td>
                        <td>{batter.balls}</td>
                        <td>{batter.fours}</td>
                        <td>{batter.sixes}</td>
                        <td>{batter.strikeRate}</td>
                        <td>
                          {batter.isRetiredHurt
                            ? "Retired hurt"
                            : batter.dismissal || "not out"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </ProTable>

                <h3 className="live-section-title">🎯 Bowling Scorecard</h3>

                <ProTable>
                  <thead>
                    <tr>
                      <th>Bowler</th>
                      <th>Overs</th>
                      <th>Runs</th>
                      <th>Wickets</th>
                      <th>Dots</th>
                      <th>Economy</th>
                    </tr>
                  </thead>

                  <tbody>
                    {innings?.bowlingStats?.map((bowler) => (
                      <tr key={bowler.playerId}>
                        <td className="name-cell">{bowler.playerName}</td>
                        <td>{bowler.overs}</td>
                        <td>{bowler.runs}</td>
                        <td>{bowler.wickets}</td>
                        <td>{bowler.dots}</td>
                        <td>{bowler.economy}</td>
                      </tr>
                    ))}
                  </tbody>
                </ProTable>

                <h3 className="live-section-title">🤝 Partnerships</h3>

                <ProTable>
                  <thead>
                    <tr>
                      <th>Batters</th>
                      <th>Runs</th>
                      <th>Balls</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {innings.partnerships?.map((p, index) => (
                      <tr key={index}>
                        <td className="name-cell">
                          {p.batter1} & {p.batter2}
                        </td>
                        <td>{p.runs}</td>
                        <td>{p.balls}</td>
                        <td>{p.ongoing ? "Current" : `W${p.wicketNumber}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </ProTable>

                <h3 className="live-section-title">☝️ Fall of Wickets</h3>

                <ProTable>
                  <thead>
                    <tr>
                      <th>Wicket</th>
                      <th>Score</th>
                      <th>Player</th>
                      <th>Over</th>
                    </tr>
                  </thead>

                  <tbody>
                    {innings.fallOfWickets?.map((w, index) => (
                      <tr key={index}>
                        <td>{w.wicketNumber}</td>
                        <td>{w.score}</td>
                        <td className="name-cell">{w.playerOut}</td>
                        <td>{w.over}</td>
                      </tr>
                    ))}
                  </tbody>
                </ProTable>
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}