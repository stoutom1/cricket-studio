"use client";

import { useEffect, useState } from "react";

function StatCard({ title, children }) {
  return (
    <div
      style={{
        background: "#111827",
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        border: "1px solid #1f2937"
      }}
    >
      <h3
        style={{
          marginBottom: 16,
          fontSize: 18,
          fontWeight: 700
        }}
      >
        {title}
      </h3>

      {children}
    </div>
  );
}

export default function LiveScoreClient({ matchId }) {
  const [scoreboard, setScoreboard] = useState(null);
  const [error, setError] = useState("");

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
      <div style={{ padding: 40 }}>
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!scoreboard) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Loading scorecard...</h2>
      </div>
    );
  }

  const latestInnings =
  scoreboard?.innings?.find(
    (inn) => inn.number === scoreboard.currentInnings
  ) || scoreboard?.innings?.[0];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#030712",
        color: "white",
        padding: 24,
        fontFamily: "sans-serif"
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "#111827",
          borderRadius: 20,
          padding: 24,
          marginBottom: 24,
          border: "1px solid #1f2937"
        }}
      >
        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            marginBottom: 10
          }}
        >
          {scoreboard?.match?.teamAName} vs{" "}
          {scoreboard?.match?.teamBName}
        </h1>

        {/* MATCH STATUS */}
        <div
          style={{
            background: "#1f2937",
            padding: 16,
            borderRadius: 12,
            marginBottom: 20
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 8
            }}
          >
            Match Status
          </div>

          <div style={{ color: "#d1d5db" }}>
            {scoreboard?.summary?.statusText ||
              "Match in progress"}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap"
          }}
        >
          <InfoPill
                  label="Current Score"
                          value={latestInnings? `${latestInnings.runs}/${latestInnings.wickets}`: "-"}
          />

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
            value={scoreboard?.summary?.target ?? "-"}
          />

          <InfoPill
            label="Balls Left"
            value={
                    scoreboard?.summary?.remainingBalls !== null &&
                    scoreboard?.summary?.remainingBalls !== undefined
                      ? scoreboard.summary.remainingBalls
                      : "-"
                  }
          />
        </div>
      </div>

      {/* CURRENT PLAYERS */}
      <StatCard title="Current Players">
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={thStyle}>Striker</td>
              <td style={tdStyle}>
                {scoreboard?.currentState?.strikerName || "Yet to bat"}

                {scoreboard?.currentState?.strikerStats && (
                  <span
                    style={{
                      color: "#9ca3af",
                      marginLeft: 8,
                      fontSize: 14
                    }}
                  >
                    ({scoreboard.currentState.strikerStats.runs}
                    {" "}
                    off
                    {" "}
                    {scoreboard.currentState.strikerStats.balls})
                  </span>
                )}
              </td>
            </tr>

            <tr>
              <td style={thStyle}>Non Striker</td>
              <td style={tdStyle}>
                {scoreboard?.currentState?.nonStrikerName || "Yet to bat"}

                {scoreboard?.currentState?.nonStrikerStats && (
                  <span
                    style={{
                      color: "#9ca3af",
                      marginLeft: 8,
                      fontSize: 14
                    }}
                  >
                    ({scoreboard.currentState.nonStrikerStats.runs}
                    {" "}
                    off
                    {" "}
                    {scoreboard.currentState.nonStrikerStats.balls})
                  </span>
                )}
              </td>
            </tr>

            <tr>
              <td style={thStyle}>Bowler</td>
              <td style={tdStyle}>
                {scoreboard?.currentState?.bowlerName || "Yet to bowl"}

                {scoreboard?.currentState?.bowlerStats && (
                  <span
                    style={{
                      color: "#9ca3af",
                      marginLeft: 8,
                      fontSize: 14
                    }}
                  >
                    ({scoreboard.currentState.bowlerStats.wickets}/
                    {scoreboard.currentState.bowlerStats.runs}
                    {" "}
                    in
                    {" "}
                    {scoreboard.currentState.bowlerStats.overs}
                    {" "}
                    overs)
                  </span>
                )}
              </td>
            </tr>

            <tr>
              <td style={thStyle}>Next Ball</td>
              <td style={tdStyle}>
                {scoreboard?.currentState?.nextOverNo !==
                undefined
                  ? `${scoreboard?.currentState?.nextOverNo}.${scoreboard?.currentState?.nextBallInOver}`
                  : "-"}
              </td>
            </tr>
            <tr>
              <td style={thStyle}>Recent Balls</td>
              <td style={tdStyle}>
                 {/* RECENT BALLS */}
                  <StatCard title="">
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap"
                      }}
                    >
                      {scoreboard?.recentBalls?.map((ball) => (
                        <div
                          key={ball.id}
                          style={{
                            background: "#2563eb",
                            padding: "10px 14px",
                            borderRadius: 999,
                            fontWeight: 600
                          }}
                        >
                          {ball.label}
                        </div>
                      ))}
                    </div>
                  </StatCard>
              </td>    
            </tr>

          </tbody>
        </table>
      </StatCard>

      {/* INNINGS */}
      {scoreboard?.innings?.map((innings) => (
        <StatCard
          key={innings.number}
          title={`Innings ${innings.number} - ${innings.teamName}`}
        >
          {/* INNINGS SUMMARY */}
          <table
            style={{
              ...tableStyle,
              marginBottom: 24
            }}
          >
            <tbody>
              <tr>
                <td style={thStyle}>Score</td>
                <td style={tdStyle}>
                  {innings.runs}/{innings.wickets}
                </td>
              </tr>

              <tr>
                <td style={thStyle}>Overs</td>
                <td style={tdStyle}>
                  {innings.oversDisplay}
                </td>
              </tr>

              <tr>
                <td style={thStyle}>Run Rate</td>
                <td style={tdStyle}>
                  {innings.runRate}
                </td>
              </tr>

              <tr>
                <td style={thStyle}>Powerplay</td>
                <td style={tdStyle}>
                  {innings.powerplay?.runs}/
                  {innings.powerplay?.wickets}
                </td>
              </tr>
            </tbody>
          </table>

          {/* BATTING STATS */}
          <h3 style={sectionTitle}>
            Batting Statistics
          </h3>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Player</th>
                <th style={thStyle}>R</th>
                <th style={thStyle}>B</th>
                <th style={thStyle}>4s</th>
                <th style={thStyle}>6s</th>
                <th style={thStyle}>SR</th>
                <th style={thStyle}>Dismissal</th>
              </tr>
            </thead>

            <tbody>
              {innings?.battingStats?.map((batter) => (
                <tr key={batter.playerId}>
                  <td style={tdStyle}>
                    {batter.playerName}
                  </td>

                  <td style={tdStyle}>
                    {batter.runs}
                  </td>

                  <td style={tdStyle}>
                    {batter.balls}
                  </td>

                  <td style={tdStyle}>
                    {batter.fours}
                  </td>

                  <td style={tdStyle}>
                    {batter.sixes}
                  </td>

                  <td style={tdStyle}>
                    {batter.strikeRate}
                  </td>

                  <td style={tdStyle}>
                    {batter.dismissal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* BOWLING STATS */}
          <h3 style={sectionTitle}>
            Bowling Statistics
          </h3>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Bowler</th>
                <th style={thStyle}>Overs</th>
                <th style={thStyle}>Runs</th>
                <th style={thStyle}>Wickets</th>
                <th style={thStyle}>Dots</th>
                <th style={thStyle}>Economy</th>
              </tr>
            </thead>

            <tbody>
              {innings?.bowlingStats?.map((bowler) => (
                <tr key={bowler.playerId}>
                  <td style={tdStyle}>
                    {bowler.playerName}
                  </td>

                  <td style={tdStyle}>
                    {bowler.overs}
                  </td>

                  <td style={tdStyle}>
                    {bowler.runs}
                  </td>

                  <td style={tdStyle}>
                    {bowler.wickets}
                  </td>

                  <td style={tdStyle}>
                    {bowler.dots}
                  </td>

                  <td style={tdStyle}>
                    {bowler.economy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* PARTNERSHIPS */}
          <h3 style={sectionTitle}>Partnerships</h3>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Batters</th>
                <th style={thStyle}>Runs</th>
                <th style={thStyle}>Balls</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>

            <tbody>
              {innings.partnerships?.map((p, index) => (
                <tr key={index}>
                  <td style={tdStyle}>
                    {p.batter1} & {p.batter2}
                  </td>

                  <td style={tdStyle}>{p.runs}</td>

                  <td style={tdStyle}>{p.balls}</td>

                  <td style={tdStyle}>
                    {p.ongoing
                      ? "Current"
                      : `W${p.wicketNumber}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* FALL OF WICKETS */}
          <h3 style={sectionTitle}>
            Fall Of Wickets
          </h3>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Wicket</th>
                <th style={thStyle}>Score</th>
                <th style={thStyle}>Player</th>
                <th style={thStyle}>Over</th>
              </tr>
            </thead>

            <tbody>
              {innings.fallOfWickets?.map((w, index) => (
                <tr key={index}>
                  <td style={tdStyle}>
                    {w.wicketNumber}
                  </td>

                  <td style={tdStyle}>
                    {w.score}
                  </td>

                  <td style={tdStyle}>
                    {w.playerOut}
                  </td>

                  <td style={tdStyle}>
                    {w.over}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </StatCard>
      ))}
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div
      style={{
        background: "#1f2937",
        padding: "12px 18px",
        borderRadius: 12,
        minWidth: 140
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#9ca3af",
          marginBottom: 6
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 700
        }}
      >
        {value}
      </div>
    </div>
  );
}

const sectionTitle = {
  marginTop: 30,
  marginBottom: 12,
  fontSize: 18,
  fontWeight: 700
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  marginBottom: 24
};

const thStyle = {
  textAlign: "left",
  padding: 12,
  background: "#1f2937",
  border: "1px solid #374151"
};

const tdStyle = {
  padding: 12,
  border: "1px solid #374151"
};