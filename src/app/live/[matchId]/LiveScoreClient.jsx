"use client";

import { useEffect, useState } from "react";

function StatCard({ title, children }) {
  return (
    <div
      style={{
        background: "#111827",
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        border: "1px solid #1f2937"
      }}
    >
      <h3
        style={{
          marginBottom: 12,
          fontSize: 16,
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
  const [collapsedInnings, setCollapsedInnings] = useState({});

  function toggleInnings(inningsNo) {
        setCollapsedInnings((prev) => ({
        ...prev,
        [inningsNo]: !prev[inningsNo]
        }));
      }
      const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768);
  };

  checkMobile();

  window.addEventListener("resize", checkMobile);

  return () =>
    window.removeEventListener("resize", checkMobile);
}, []);
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
        padding: isMobile ? 12 : 24,
        fontFamily: "sans-serif"
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "#111827",
padding: isMobile ? 14 : 24,
borderRadius: isMobile ? 14 : 20,
          marginBottom: 24,
          border: "1px solid #1f2937"
        }}
      >
        <h1
          style={{
fontSize: isMobile ? 22 : 32,
lineHeight: 1.3,
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
display: "grid",
gridTemplateColumns: isMobile
  ? "repeat(2,1fr)"
  : "repeat(auto-fit,minmax(140px,1fr))",
gap: 12
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
  value={
    scoreboard?.currentInnings === 2 &&
    scoreboard?.summary?.target
      ? `${scoreboard.summary.target} (${
          Math.max(
            scoreboard.summary.target -
              (latestInnings?.runs || 0),
            0
          )
        } needed to win)`
      : scoreboard?.summary?.target ?? "-"
  }
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
      <div className="single-line-scoreboard">
  <span className="status-text">
    📌 {scoreboard?.summary?.statusText}
  </span>
</div>
      {/* CURRENT PLAYERS */}
      <StatCard title="Current Players">
        <div
  style={{
    overflowX: "auto",
    WebkitOverflowScrolling: "touch"
  }}
></div>
<div
  style={{
    overflowX: "auto",
    WebkitOverflowScrolling: "touch"
  }}
>
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
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    padding: "6px 0"
  }}
>
  {scoreboard?.recentBalls
    ?.slice(-20)
    ?.map((ball, index, arr) => {

      // Example label:
      // "12.3 4"

      const label = ball.label || "";

      // Over number
      const currentOver =
        label.split(".")[0];

      const prevOver =
        index > 0
          ? arr[index - 1]?.label
              ?.split(".")[0]
          : currentOver;

      // Ball result only
      const result =
        label
          .split(" ")
          .slice(1)
          .join(" ") || label;

      const clean =
        result.replace(/[()]/g, "");

      let color = "#d1d5db";

      if (clean === "4") {
        color = "#22c55e";
      } else if (clean === "6") {
        color = "#22c55e";
      } else if (
        clean === "Wd" ||
        clean === "Nb"
      ) {
        color = "#c5f838";
      } else if (
        clean.toUpperCase().includes("W")
      ) {
        color = "#ef4444";
      }

      return (
        <div
          key={ball.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10
          }}
        >
          {/* OVER SEPARATOR */}
          {index > 0 &&
            currentOver !== prevOver && (
              <span
                style={{
                  color: "#6b7280",
                  fontWeight: 700
                }}
              >
                |
              </span>
          )}

          <span
            style={{
              fontWeight: 200,
              fontSize: 14,
              color,
              letterSpacing: 0.5
            }}
          >
            {clean}
          </span>
        </div>
      );
    })}
</div>
              </td>    
            </tr>

          </tbody>
        </table>
        </div>
      </StatCard>

      {/* INNINGS */}
      {scoreboard?.innings?.map((innings) => {
  const isCollapsed =
    collapsedInnings[innings.number];

  return (
    <div
      key={innings.number}
      style={{
        background: "#111827",
        borderRadius: 16,
        marginBottom: 20,
        border: "1px solid #1f2937",
        overflow: "hidden"
      }}
    >
      {/* COLLAPSIBLE HEADER */}
      <div
        onClick={() =>
          toggleInnings(innings.number)
        }
        style={{
          padding: 20,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#111827",
          userSelect: "none"
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700
          }}
        >
          Innings {innings.number} -{" "}
          {innings.teamName}
        </h3>

        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#9ca3af"
          }}
        >
          {isCollapsed ? "+" : "−"}
        </span>
      </div>

      {!isCollapsed && (
        <div style={{ padding: 20 }}>

          {/* INNINGS SUMMARY */}
          <div
  style={{
    overflowX: "auto",
    WebkitOverflowScrolling: "touch"
  }}
>
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
</div>
          {/* BATTING STATS */}
          <h3 style={sectionTitle}>
            Batting Statistics
          </h3>
<div
  style={{
    overflowX: "auto",
    WebkitOverflowScrolling: "touch"
  }}
>
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
</div>
          {/* BOWLING STATS */}
          <h3 style={sectionTitle}>
            Bowling Statistics
          </h3>
<div
  style={{
    overflowX: "auto",
    WebkitOverflowScrolling: "touch"
  }}
>
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
</div>
          {/* PARTNERSHIPS */}
          <h3 style={sectionTitle}>Partnerships</h3>
<div
  style={{
    overflowX: "auto",
    WebkitOverflowScrolling: "touch"
  }}
>
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
</div>
          {/* FALL OF WICKETS */}
          <h3 style={sectionTitle}>
            Fall Of Wickets
          </h3>
<div
  style={{
    overflowX: "auto",
    WebkitOverflowScrolling: "touch"
  }}
>
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
          </div>
         </div>
      )}
    </div>
  );
})}
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div
      style={{
        background: "#1f2937",
        padding: "10px 12px",
        borderRadius: 12,
        width: "100%"
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#9ca3af",
          marginBottom: 4
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 16,
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