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
function getTopRuns(battingStats = []) {
  return Math.max(...battingStats.map((p) => Number(p.runs || 0)), 0);
}

function getBestWickets(bowlingStats = []) {
  return Math.max(...bowlingStats.map((p) => Number(p.wickets || 0)), 0);
}
function getMatchStory(scoreboard) {
  const story = [];

  scoreboard?.innings?.forEach((innings) => {
    const topBatter = [...(innings.battingStats || [])].sort(
      (a, b) => Number(b.runs || 0) - Number(a.runs || 0)
    )[0];

    const bestBowler = [...(innings.bowlingStats || [])].sort((a, b) => {
      const wicketDiff = Number(b.wickets || 0) - Number(a.wickets || 0);
      if (wicketDiff !== 0) return wicketDiff;
      return Number(a.runs || 0) - Number(b.runs || 0);
    })[0];

    story.push({
      label: `Innings ${innings.number}`,
      title: `${innings.teamName} scored ${innings.runs}/${innings.wickets}`,
      detail: `${innings.oversDisplay} overs • RR ${innings.runRate}`,
    });

    if (topBatter?.runs > 0) {
      story.push({
        label: "Top batting",
        title: `${topBatter.playerName} ${topBatter.runs} (${topBatter.balls})`,
        detail: `${topBatter.fours || 0} fours • ${topBatter.sixes || 0} sixes`,
      });
    }

    if (bestBowler?.wickets > 0) {
      story.push({
        label: "Best bowling",
        title: `${bestBowler.playerName} ${bestBowler.wickets}/${bestBowler.runs}`,
        detail: `${bestBowler.overs} overs • Econ ${bestBowler.economy}`,
      });
    }
  });

  return story;
}

export default function LiveScoreClient({ matchId }) {
  const [scoreboard, setScoreboard] = useState(null);
  const [error, setError] = useState("");
  const [collapsedInnings, setCollapsedInnings] = useState({});
  const [viewMode, setViewMode] = useState("full");

  const matchStory = getMatchStory(scoreboard);

  function toggleInnings(inningsNo) {
    setCollapsedInnings((prev) => ({
      ...prev,
      [inningsNo]: !prev[inningsNo],
    }));
  }
async function shareLiveScore() {
  const shareUrl = window.location.href;

  const text = `${scoreboard?.match?.teamAName} vs ${scoreboard?.match?.teamBName} • ${latestInnings?.runs}/${latestInnings?.wickets} in ${latestInnings?.oversDisplay} ov`;

  if (navigator.share) {
    await navigator.share({
      title: "Cric4All Live Score",
      text,
      url: shareUrl,
    });
    return;
  }

  await navigator.clipboard.writeText(shareUrl);
  alert("Live score link copied!");
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

  const topBatter = getTopBatter(scoreboard);
const bestBowler = getBestBowler(scoreboard);
const lastThreeOvers = getLastThreeOvers(scoreboard);
const chaseRunsNeeded =
  scoreboard?.currentInnings === 2 && scoreboard?.summary?.target
    ? Math.max(
        Number(scoreboard.summary.target) - Number(latestInnings?.runs || 0),
        0
      )
    : null;
console.log("chaseRunsNeeded",chaseRunsNeeded);
const requiredRate =
  chaseRunsNeeded !== null && ballsLeft
    ? ((chaseRunsNeeded / ballsLeft) * 6).toFixed(2)
    : null;


  const strikerValue = scoreboard?.currentState?.strikerStats
    ? `${scoreboard.currentState.strikerStats.runs} (${scoreboard.currentState.strikerStats.balls})`
    : "";

  const nonStrikerValue = scoreboard?.currentState?.nonStrikerStats
    ? `${scoreboard.currentState.nonStrikerStats.runs} (${scoreboard.currentState.nonStrikerStats.balls})`
    : "";

  const bowlerValue = scoreboard?.currentState?.bowlerStats
    ? `${scoreboard.currentState.bowlerStats.wickets}/${scoreboard.currentState.bowlerStats.runs} in ${scoreboard.currentState.bowlerStats.overs} ov`
    : "";

    function getTopBatter(scoreboard) {
  const rows =
    scoreboard?.innings?.flatMap((inn) => inn.battingStats || []) || [];

  return rows
    .filter((p) => Number(p.runs || 0) > 0)
    .sort((a, b) => Number(b.runs || 0) - Number(a.runs || 0))[0];
}

function getBestBowler(scoreboard) {
  const rows =
    scoreboard?.innings?.flatMap((inn) => inn.bowlingStats || []) || [];

  return rows
    .filter((p) => Number(p.wickets || 0) > 0 || Number(p.runs || 0) > 0)
    .sort((a, b) => {
      const wicketDiff = Number(b.wickets || 0) - Number(a.wickets || 0);
      if (wicketDiff !== 0) return wicketDiff;
      return Number(a.runs || 0) - Number(b.runs || 0);
    })[0];
}
function getLastThreeOvers(scoreboard) {
  const balls = scoreboard?.recentBalls || [];
  const overMap = new Map();

  balls.forEach((ball) => {
    const label = String(ball.label || "");
    const overNo = label.split(".")[0];
    const result =
      label.split(" ").slice(1).join(" ").replace(/[()]/g, "") || "";

    if (!overMap.has(overNo)) {
      overMap.set(overNo, {
        overNo,
        runs: 0,
        wickets: 0,
        balls: [],
      });
    }

    const over = overMap.get(overNo);

    const runs =
      result.includes("Wd") || result.includes("Nb")
        ? Number(result.replace(/\D/g, "") || 1)
        : Number(result) || 0;

    over.runs += runs;

    if (
      result.toUpperCase().includes("W") &&
      !result.toUpperCase().includes("WD")
    ) {
      over.wickets += 1;
    }

    over.balls.push(result);
  });

  return Array.from(overMap.values()).slice(-3);
}

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
{scoreboard?.currentInnings === 2 && chaseRunsNeeded !== null && (
  <div className="live-chase-card">
    <span>Chase Equation</span>
    <strong>
      Need {chaseRunsNeeded} from {ballsLeft ?? "-"} balls
    </strong>
    <small>Required rate {requiredRate || "—"}</small>
  </div>
)}

<div className="live-stars-grid">
  <div className="live-star-card">
    <span>🔥 Top Batter</span>
    <strong>{topBatter?.playerName || "-"}</strong>
    <small>
      {topBatter
        ? `${topBatter.runs} (${topBatter.balls})`
        : "No runs yet"}
    </small>
  </div>

  <div className="live-star-card">
    <span>🎯 Best Bowler</span>
    <strong>{bestBowler?.playerName || "-"}</strong>
    <small>
      {bestBowler
        ? `${bestBowler.wickets}/${bestBowler.runs} in ${bestBowler.overs} ov`
        : "No figures yet"}
    </small>
  </div>
</div>
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

        {lastThreeOvers.length > 0 && (
  <div className="live-momentum-strip">
    <span>Momentum</span>

    <div>
      {lastThreeOvers.map((over) => (
        <b key={over.overNo}>
          Over {over.overNo}: {over.runs}
          {over.wickets ? `/${over.wickets}` : ""}
        </b>
      ))}
    </div>
  </div>
  
)}
{/*}
{matchStory.length > 0 && (
  <section className="live-story-card">
    <div className="live-story-head">
      <strong>📖 Match Story</strong>
      <span>Quick highlights</span>
    </div>

    <div className="live-story-list">
      {matchStory.slice(0, 6).map((item, index) => (
        <div key={`${item.label}-${index}`} className="live-story-item">
          <span>{item.label}</span>
          <strong>{item.title}</strong>
          <small>{item.detail}</small>
        </div>
      ))}
    </div>
  </section>
)}
*/}
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
      <div className="live-action-bar">
  <button type="button" onClick={shareLiveScore}>
    📤 Share Live Score
  </button>

  <button type="button" onClick={() => window.location.reload()}>
    🔄 Refresh
  </button>
</div>
<div className="live-view-toggle">
  <button
    type="button"
    className={viewMode === "compact" ? "active" : ""}
    onClick={() => setViewMode("compact")}
  >
    ⚡ Compact
  </button>

  <button
    type="button"
    className={viewMode === "full" ? "active" : ""}
    onClick={() => setViewMode("full")}
  >
    📋 Full Scorecard
  </button>
</div>
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

 {viewMode === "full" &&
  scoreboard?.innings?.map((innings) => {
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
{innings?.battingStats?.map((batter) => {
  const isTopScorer =
    Number(batter.runs || 0) === getTopRuns(innings.battingStats) &&
    Number(batter.runs || 0) > 0;

  const isNotOut =
    !batter.dismissal && !batter.isRetiredHurt;

  return (
    <tr
      key={batter.playerId}
      className={isTopScorer ? "highlight-top-batter" : ""}
    >
                        <td className="name-cell">{batter.playerName}</td>
                        <td>{batter.runs}</td>
                        <td>{batter.balls}</td>
                        <td>{batter.fours}</td>
                        <td>{batter.sixes}</td>
                        <td>{batter.strikeRate}</td>
<td>
  {batter.isRetiredHurt ? (
    <span className="score-badge retired">Retired hurt</span>
  ) : isNotOut ? (
    <span className="score-badge notout">not out</span>
  ) : (
    batter.dismissal || "-"
  )}
</td>
                      </tr>
                    );
                    })}
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
{innings?.bowlingStats?.map((bowler) => {
  const isBestBowler =
    Number(bowler.wickets || 0) === getBestWickets(innings.bowlingStats) &&
    Number(bowler.wickets || 0) > 0;

  return (
    <tr
      key={bowler.playerId}
      className={isBestBowler ? "highlight-best-bowler" : ""}
    >
                        <td className="name-cell">{bowler.playerName}</td>
                        <td>{bowler.overs}</td>
                        <td>{bowler.runs}</td>
  <td>
  {Number(bowler.wickets || 0) > 0 ? (
    <span className="score-badge wicket">{bowler.wickets}</span>
  ) : (
    bowler.wickets
  )}
</td>
                        <td>{bowler.dots}</td>
                        <td>{bowler.economy}</td>
                      </tr>
                       );
                    })}
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