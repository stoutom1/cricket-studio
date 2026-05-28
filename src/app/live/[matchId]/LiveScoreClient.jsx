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
    scoreboard?.innings?.[scoreboard.innings.length - 1];

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
            marginBottom: 8
          }}
        >
          {scoreboard?.match?.teamAName} vs{" "}
          {scoreboard?.match?.teamBName}
        </h1>

        <p
          style={{
            fontSize: 18,
            color: "#d1d5db"
          }}
        >
          {scoreboard?.summary?.statusText || "Match in progress"}
        </p>

        <div
          style={{
            marginTop: 20,
            display: "flex",
            gap: 16,
            flexWrap: "wrap"
          }}
        >
          <div
            style={{
              background: "#1f2937",
              padding: "12px 18px",
              borderRadius: 12
            }}
          >
            <strong>Current Score:</strong>{" "}
            {latestInnings?.runs}/{latestInnings?.wickets}
          </div>

          <div
            style={{
              background: "#1f2937",
              padding: "12px 18px",
              borderRadius: 12
            }}
          >
            <strong>Overs:</strong>{" "}
            {latestInnings?.oversDisplay}
          </div>

          <div
            style={{
              background: "#1f2937",
              padding: "12px 18px",
              borderRadius: 12
            }}
          >
            <strong>Run Rate:</strong>{" "}
            {latestInnings?.runRate}
          </div>
        </div>
      </div>

      {/* INNINGS */}
      {scoreboard?.innings?.map((innings) => (
        <StatCard
          key={innings.number}
          title={`Innings ${innings.number} - ${innings.teamName}`}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              marginBottom: 24
            }}
          >
            <div>
              <h4>Score</h4>
              <p style={{ fontSize: 28, fontWeight: 700 }}>
                {innings.runs}/{innings.wickets}
              </p>
            </div>

            <div>
              <h4>Overs</h4>
              <p>{innings.oversDisplay}</p>
            </div>

            <div>
              <h4>Run Rate</h4>
              <p>{innings.runRate}</p>
            </div>

            <div>
              <h4>Powerplay</h4>
              <p>
                {innings.powerplay?.runs}/
                {innings.powerplay?.wickets}
              </p>
            </div>
          </div>

          {/* PARTNERSHIPS */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ marginBottom: 12 }}>
              Partnerships
            </h3>

            {innings.partnerships?.length === 0 ? (
              <p>No partnerships yet</p>
            ) : (
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
                          : `Ended at wicket ${p.wicketNumber}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* FALL OF WICKETS */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ marginBottom: 12 }}>
              Fall Of Wickets
            </h3>

            {innings.fallOfWickets?.length === 0 ? (
              <p>No wickets yet</p>
            ) : (
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
            )}
          </div>
        </StatCard>
      ))}

      {/* CURRENT BATTERS */}
      <StatCard title="Current Players">
        <div
          style={{
            display: "flex",
            gap: 40,
            flexWrap: "wrap"
          }}
        >
          <div>
            <h4>🏏 Striker</h4>

            <p>
              {scoreboard?.currentState?.strikerName ||
                "Yet to bat"}
            </p>
          </div>

          <div>
            <h4>🏃 Non Striker</h4>

            <p>
              {scoreboard?.currentState
                ?.nonStrikerName || "Yet to bat"}
            </p>
          </div>

          <div>
            <h4>⏭ Next Ball</h4>

            <p>
              {scoreboard?.currentState?.nextOverNo}.
              {scoreboard?.currentState?.nextBallInOver}
            </p>
          </div>
        </div>
      </StatCard>

      {/* RECENT BALLS */}
      <StatCard title="Recent Balls">
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
                borderRadius: 999
              }}
            >
              {ball.label}
            </div>
          ))}
        </div>
      </StatCard>
    </div>
  );
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse"
};

const thStyle = {
  textAlign: "left",
  padding: 12,
  background: "#1f2937",
  borderBottom: "1px solid #374151"
};

const tdStyle = {
  padding: 12,
  borderBottom: "1px solid #1f2937"
};