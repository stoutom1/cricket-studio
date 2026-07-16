"use client";

import {useEffect,useMemo,useRef,useState,} from "react";
import { buildMatchInsights } from "@/lib/match-insights";

const FINAL_MATCH_STATUSES = new Set([
  "ABANDONED",
  "COMPLETED",
  "COMPLETED_LOCKED",
  "COMPLETED_CORRECTED",
]);

function normalizeMatchStatus(status) {
  return String(status || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function isFinalMatchStatus(status) {
  return FINAL_MATCH_STATUSES.has(
    normalizeMatchStatus(status)
  );
}

function getBallDisplay(label) {
  const raw =
    String(label || "")
      .split(" ")
      .slice(1)
      .join(" ")
      .replace(/[()]/g, "")
      .trim() || "-";

  const upper = raw.toUpperCase();

  if (raw === "4") {
    return { text: "4", type: "four" };
  }

  if (raw === "6") {
    return { text: "6", type: "six" };
  }

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

function InfoPill({
  label,
  value,
  emphasis = false,
}) {
  return (
    <div
      className={`live-info-pill ${
        emphasis ? "is-emphasis" : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PlayerCard({
  label,
  name,
  value,
  active = false,
}) {
  return (
    <div
      className={`live-player-card ${
        active ? "is-active" : ""
      }`}
    >
      <span>{label}</span>
      <strong>{name || "-"}</strong>
      {value ? <small>{value}</small> : null}
    </div>
  );
}

function ProTable({
  children,
  type = "default",
}) {
  return (
    <div
      className={`live-table-shell table-type-${type}`}
    >
      <div
        className="table-scroll-hint"
        aria-hidden="true"
      >
        <span>Swipe for more details</span>
        <b>⇄</b>
      </div>

      <div
        className="live-table-wrap"
        tabIndex={0}
      >
        <table className="live-pro-table sticky-first-col-table">
          {children}
        </table>
      </div>
    </div>
  );
}

function AccordionSection({
  id,
  title,
  subtitle,
  open,
  onToggle,
  children,
}) {
  return (
    <section
      className={`live-detail-card ${
        open ? "is-open" : ""
      }`}
    >
      <button
        type="button"
        className="live-detail-header"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
      >
        <span>
          <strong>{title}</strong>

          {subtitle ? (
            <small>{subtitle}</small>
          ) : null}
        </span>

        <i aria-hidden="true">
          {open ? "−" : "+"}
        </i>
      </button>

      {open ? (
        <div
          id={id}
          className="live-detail-body"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

function getTopRuns(battingStats = []) {
  return Math.max(
    ...battingStats.map((player) =>
      Number(player.runs || 0)
    ),
    0
  );
}

function getBestWickets(bowlingStats = []) {
  return Math.max(
    ...bowlingStats.map((player) =>
      Number(player.wickets || 0)
    ),
    0
  );
}

function getTopBatter(scoreboard) {
  const rows =
    scoreboard?.innings?.flatMap(
      (innings) => innings.battingStats || []
    ) || [];

  return rows
    .filter(
      (player) =>
        Number(player.runs || 0) > 0
    )
    .sort(
      (a, b) =>
        Number(b.runs || 0) -
        Number(a.runs || 0)
    )[0];
}

function getBestBowler(scoreboard) {
  const rows =
    scoreboard?.innings?.flatMap(
      (innings) => innings.bowlingStats || []
    ) || [];

  return rows
    .filter(
      (player) =>
        Number(player.wickets || 0) > 0 ||
        Number(player.runs || 0) > 0
    )
    .sort((a, b) => {
      const wicketDifference =
        Number(b.wickets || 0) -
        Number(a.wickets || 0);

      if (wicketDifference !== 0) {
        return wicketDifference;
      }

      return (
        Number(a.runs || 0) -
        Number(b.runs || 0)
      );
    })[0];
}

function getLastThreeOvers(scoreboard) {
  const balls = scoreboard?.recentBalls || [];
  const overMap = new Map();

  balls.forEach((ball) => {
    const label = String(ball.label || "");
    const overNo = label.split(".")[0];

    const result =
      label
        .split(" ")
        .slice(1)
        .join(" ")
        .replace(/[()]/g, "") || "";

    if (!overMap.has(overNo)) {
      overMap.set(overNo, {
        overNo,
        runs: 0,
        wickets: 0,
      });
    }

    const over = overMap.get(overNo);
    const normalizedResult =
      result.toUpperCase();

    const runs =
      normalizedResult.includes("WD") ||
      normalizedResult.includes("NB")
        ? Number(
            result.replace(/\D/g, "") || 1
          )
        : Number(result) || 0;

    over.runs += runs;

    if (
      normalizedResult.includes("W") &&
      !normalizedResult.includes("WD")
    ) {
      over.wickets += 1;
    }
  });

  return Array.from(overMap.values()).slice(-3);
}

function getRunRateTrend(
  scoreboard,
  latestInnings,
  ballsLeft
) {
  const currentRunRate = Number(
    latestInnings?.runRate || 0
  );

  const target = Number(
    scoreboard?.summary?.target || 0
  );

  const currentRuns = Number(
    latestInnings?.runs || 0
  );

  const runsNeeded =
    scoreboard?.currentInnings === 2 &&
    target
      ? Math.max(
          target - currentRuns,
          0
        )
      : 0;

  const requiredRunRate =
    scoreboard?.currentInnings === 2 &&
    Number(ballsLeft) > 0
      ? Number(
          (
            (runsNeeded /
              Number(ballsLeft)) *
            6
          ).toFixed(2)
        )
      : 0;

  const maximumRate = Math.max(
    currentRunRate,
    requiredRunRate,
    12
  );

  return {
    crr: currentRunRate.toFixed(2),

    rrr: requiredRunRate
      ? requiredRunRate.toFixed(2)
      : "—",

    crrPct: Math.min(
      (currentRunRate / maximumRate) * 100,
      100
    ),

    rrrPct: Math.min(
      (requiredRunRate / maximumRate) * 100,
      100
    ),
  };
}

export default function LiveScoreClient({
  matchId,
}) {
  const [scoreboard, setScoreboard] =
    useState(null);

  const [error, setError] =
    useState("");

  const [
    collapsedInnings,
    setCollapsedInnings,
  ] = useState({});

  const [
    showScorecard,
    setShowScorecard,
  ] = useState(false);

  const [
    showInsights,
    setShowInsights,
  ] = useState(false);

  const [tvMode, setTvMode] =
    useState(false);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const finalViewInitializedRef = useRef(false);

  useEffect(() => {
    let intervalId = null;
    let cancelled = false;
    finalViewInitializedRef.current = false;

    async function loadScorecard() {
      try {
        const response = await fetch(
          `/api/liveview/${matchId}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load scorecard"
          );
        }

        const data =
          await response.json();

        if (cancelled) {
          return;
        }

setScoreboard(data);
setError("");

const loadedRawStatus =
  data?.match?.status ??
  data?.status ??
  data?.matchStatus ??
  data?.summary?.matchStatus ??
  data?.summary?.status ??
  "";

const loadedHasFinalResult =
  Boolean(
    data?.summary?.resultText ||
    data?.resultText ||
    data?.match?.resultText
  );

const loadedMatchIsFinal =
  isFinalMatchStatus(loadedRawStatus) ||
  loadedHasFinalResult;

if (
  loadedMatchIsFinal &&
  !finalViewInitializedRef.current
) {
  /*
    Final-match default view:
    - Match Insights expanded
    - Full Scorecard expanded
    - Every innings remains collapsed
  */
  setShowInsights(false);
  setShowScorecard(false);

  setCollapsedInnings(
    Object.fromEntries(
      (data?.innings || []).map((innings) => [
        innings.number,
        true,
      ])
    )
  );

  finalViewInitializedRef.current = true;
}

if (!loadedMatchIsFinal) {
  finalViewInitializedRef.current = false;
}

if (loadedMatchIsFinal && intervalId) {
  clearInterval(intervalId);
  intervalId = null;
}
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError?.message ||
              "Failed to load scorecard"
          );
        }
      }
    }

    loadScorecard();

    intervalId = setInterval(
      loadScorecard,
      5000
    );

    return () => {
      cancelled = true;

      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [matchId]);

  const latestInnings = useMemo(() => {
    if (!scoreboard) {
      return null;
    }

    return (
      scoreboard.innings?.find(
        (innings) =>
          innings.number ===
          scoreboard.currentInnings
      ) ??
      scoreboard.innings?.[
        scoreboard.innings.length - 1
      ] ??
      null
    );
  }, [scoreboard]);

  if (error && !scoreboard) {
    return (
      <main className="live-page-shell">
        <div className="live-error-card">
          <h2>
            Unable to load scorecard
          </h2>

          <p>{error}</p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!scoreboard) {
    return (
      <main className="live-page-shell">
        <div className="live-loading-card">
          <div className="live-loading-dot" />

          <h2>
            Loading live scorecard...
          </h2>
        </div>
      </main>
    );
  }

  const ballsLeft =
    scoreboard?.summary?.remainingBalls;

  const rateTrend = getRunRateTrend(
    scoreboard,
    latestInnings,
    ballsLeft
  );

  const topBatter =
    getTopBatter(scoreboard);

  const bestBowler =
    getBestBowler(scoreboard);

  const lastThreeOvers =
    getLastThreeOvers(scoreboard);

  const matchInsights =
    buildMatchInsights(scoreboard);

  /*
  Different live-view API versions may expose status
  in different locations. Resolve every known location.
*/
const rawMatchStatus =
  scoreboard?.match?.status ??
  scoreboard?.status ??
  scoreboard?.matchStatus ??
  scoreboard?.summary?.matchStatus ??
  scoreboard?.summary?.status ??
  "";

const matchStatus =
  normalizeMatchStatus(rawMatchStatus);

const hasRecordedFinalResult =
  Boolean(
    scoreboard?.summary?.resultText ||
    scoreboard?.resultText ||
    scoreboard?.match?.resultText
  );

const isMatchFinished =
  isFinalMatchStatus(matchStatus) ||
  hasRecordedFinalResult;
  
  const finalInnings = [...(scoreboard?.innings || [])]
  .sort(
    (first, second) =>
      Number(first.number || 0) -
      Number(second.number || 0)
  );

const finalMatchHeading =
  matchStatus === "ABANDONED"
    ? "Match Abandoned"
    : matchStatus === "COMPLETED_LOCKED"
      ? "Match Completed & Locked"
      : matchStatus === "COMPLETED_CORRECTED"
        ? "Match Completed & Corrected"
        : "Match Completed";

const finalResultText =
  scoreboard?.summary?.resultText ||
  scoreboard?.resultText ||
  scoreboard?.match?.resultText ||
  matchInsights?.resultText ||
  scoreboard?.summary?.statusText ||
  (matchStatus === "ABANDONED"
    ? "The match was abandoned."
    : "Match completed.");

  const chaseRunsNeeded =
    scoreboard?.currentInnings === 2 &&
    scoreboard?.summary?.target
      ? Math.max(
          Number(
            scoreboard.summary.target
          ) -
            Number(
              latestInnings?.runs || 0
            ),
          0
        )
      : null;

  const requiredRate =
    chaseRunsNeeded !== null &&
    Number(ballsLeft) > 0
      ? (
          (chaseRunsNeeded /
            Number(ballsLeft)) *
          6
        ).toFixed(2)
      : null;

  const livePillText =
    matchStatus === "ABANDONED"
      ? "MATCH ABANDONED"
      : matchStatus ===
          "COMPLETED_LOCKED"
        ? "COMPLETED & LOCKED"
        : matchStatus ===
            "COMPLETED_CORRECTED"
          ? "COMPLETED & CORRECTED"
          : matchStatus === "COMPLETED"
            ? "MATCH COMPLETED"
            : "LIVE";

  const strikerValue =
    scoreboard?.currentState
      ?.strikerStats
      ? `${scoreboard.currentState.strikerStats.runs} (${scoreboard.currentState.strikerStats.balls})`
      : "";

  const nonStrikerValue =
    scoreboard?.currentState
      ?.nonStrikerStats
      ? `${scoreboard.currentState.nonStrikerStats.runs} (${scoreboard.currentState.nonStrikerStats.balls})`
      : "";

  const bowlerValue =
    scoreboard?.currentState
      ?.bowlerStats
      ? `${scoreboard.currentState.bowlerStats.wickets}/${scoreboard.currentState.bowlerStats.runs} • ${scoreboard.currentState.bowlerStats.overs} ov`
      : "";

  function toggleInnings(inningsNo) {
    setCollapsedInnings((previous) => ({
      ...previous,

      [inningsNo]:
        previous[inningsNo] === false
          ? true
          : false,
    }));
  }

  async function shareLiveScore() {
    const shareUrl =
      window.location.href;

    const shareText =
      `${scoreboard?.match?.teamAName} vs ` +
      `${scoreboard?.match?.teamBName} • ` +
      `${latestInnings?.runs}/` +
      `${latestInnings?.wickets} in ` +
      `${latestInnings?.oversDisplay} ov`;

    try {
      if (navigator.share) {
        await navigator.share({
          title:
            "Cric4All Live Score",

          text: shareText,
          url: shareUrl,
        });

        return;
      }

      await navigator.clipboard.writeText(
        shareUrl
      );

      alert(
        "Live score link copied!"
      );
    } catch (shareError) {
      if (
        shareError?.name !==
        "AbortError"
      ) {
        alert(
          "Unable to share this score right now."
        );
      }
    }
  }

  async function refreshNow() {
    try {
      setIsRefreshing(true);

      const response = await fetch(
        `/api/liveview/${matchId}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to refresh scorecard"
        );
      }

      const data =
        await response.json();

      setScoreboard(data);
      setError("");
    } catch (refreshError) {
      setError(
        refreshError?.message ||
          "Failed to refresh scorecard"
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <main
      className={`live-page-shell ${
        tvMode ? "live-tv-mode" : ""
      }`}
    >
      {tvMode ? (
        <button
          type="button"
          className="live-tv-exit-btn"
          onClick={() =>
            setTvMode(false)
          }
        >
          ✕ Exit TV Mode
        </button>
      ) : null}
{!isMatchFinished ? (
      <section
        className="live-primary-card"
        aria-label="Live match summary"
      >
        <div className="live-primary-topline">
          <span
            className={`live-pill ${
              isMatchFinished
                ? "completed"
                : ""
            }`}
          >
            <i aria-hidden="true" />

            {livePillText}
          </span>

          <span className="live-refresh-copy">
            {isMatchFinished
              ? "Final scorecard"
              : "Updates every 5 seconds"}
          </span>
        </div>

        <div className="live-match-title">
          {scoreboard?.match?.teamAName}

          <span>vs</span>

          {scoreboard?.match?.teamBName}
        </div>

        <div className="live-score-focus">
          <div>
            <span className="live-batting-team">
              {latestInnings?.teamName ||
                "Current innings"}
            </span>

            <strong className="live-main-score">
              {latestInnings
                ? `${latestInnings.runs}/${latestInnings.wickets}`
                : "-"}
            </strong>
          </div>

          <div className="live-over-focus">
            <strong>
              {latestInnings?.oversDisplay ||
                "0.0"}
            </strong>

            <span>overs</span>
          </div>
        </div>

        <p className="live-status-text">
          {scoreboard?.summary
            ?.statusText ||
            "Match in progress"}
        </p>

        {scoreboard?.currentInnings ===
          2 &&
        chaseRunsNeeded !== null &&
        !isMatchFinished ? (
          <div className="live-chase-card">
            <span>
              CHASE EQUATION
            </span>

            <strong>
              Need {chaseRunsNeeded} from{" "}
              {ballsLeft ?? "-"} balls
            </strong>

            <small>
              Required rate{" "}
              {requiredRate || "—"}
            </small>
          </div>
        ) : null}

        <div className="live-key-metrics">
          <InfoPill
            label="CRR"
            value={rateTrend.crr}
            emphasis
          />

          <InfoPill
            label="Target"
            value={
              scoreboard?.currentInnings ===
              2
                ? scoreboard?.summary
                    ?.target || "—"
                : "—"
            }
          />

          <InfoPill
            label="Balls left"
            value={ballsLeft ?? "—"}
          />

          <InfoPill
            label="RRR"
            value={rateTrend.rrr}
            emphasis={
              scoreboard?.currentInnings ===
              2
            }
          />
        </div>

        <section
          className="live-current-grid"
          aria-label="Players currently involved"
        >
          <PlayerCard
            label="🏏 Striker"
            name={
              scoreboard?.currentState
                ?.strikerName || "-"
            }
            value={strikerValue}
            active
          />

          <PlayerCard
            label="🏃 Non-striker"
            name={
              scoreboard?.currentState
                ?.nonStrikerName || "-"
            }
            value={nonStrikerValue}
          />

          <PlayerCard
            label="🎯 Bowler"
            name={
              scoreboard?.currentState
                ?.bowlerName || "-"
            }
            value={bowlerValue}
          />
        </section>

        <div className="live-recent-section">
          <div className="live-section-label">
            <strong>
              Recent balls
            </strong>

            <span>
              Latest delivery on the right
            </span>
          </div>

          <div className="live-recent-strip">
            {scoreboard?.recentBalls
              ?.slice(-12)
              .map((ball, index) => {
                const item =
                  getBallDisplay(
                    ball.label
                  );

                return (
                  <b
                    key={
                      ball.id || index
                    }
                    className={`live-ball live-ball-${item.type}`}
                  >
                    {item.text}
                  </b>
                );
              })}
          </div>
        </div>

        {lastThreeOvers.length > 0 ? (
          <div className="live-momentum-strip">
            <span>
              Last overs
            </span>

            <div>
              {lastThreeOvers.map(
                (over) => (
                  <b key={over.overNo}>
                    O
                    {Number(
                      over.overNo
                    ) + 1}
                    : {over.runs}
                    {over.wickets
                      ? `/${over.wickets}`
                      : ""}
                  </b>
                )
              )}
            </div>
          </div>
        ) : null}
</section>
) : (
  <section
    className="final-match-summary-card"
    aria-label="Final match summary"
  >
    <div className="final-match-summary-top">
      <div>
        <span className="final-match-status-label">
          {matchStatus === "ABANDONED"
            ? "⚠️"
            : "✅"}{" "}
          {finalMatchHeading}
        </span>

        <h1>
          {scoreboard?.match?.teamAName}
          <span> vs </span>
          {scoreboard?.match?.teamBName}
        </h1>
      </div>

      <span className="final-scorecard-label">
        Final Scorecard
      </span>
    </div>

    <div className="final-match-result">
      <span>
        {matchStatus === "ABANDONED"
          ? "MATCH STATUS"
          : "MATCH RESULT"}
      </span>

      <strong>{finalResultText}</strong>
    </div>

    {finalInnings.length ? (
      <div
        className={`final-innings-summary-grid ${
          finalInnings.length === 1
            ? "single-innings"
            : ""
        }`}
      >
        {finalInnings.map((innings) => (
          <div
            key={`final-summary-${innings.number}`}
            className="final-innings-summary-card"
          >
            <div className="final-innings-card-top">
              <span>
                Innings {innings.number}
              </span>

              <small>
                {innings.oversDisplay || "0.0"} overs
              </small>
            </div>

            <strong className="final-innings-team-name">
              {innings.teamName ||
                `Team ${innings.number}`}
            </strong>

            <div className="final-innings-score">
              <b>
                {Number(innings.runs || 0)}/
                {Number(innings.wickets || 0)}
              </b>

              <span>
                in{" "}
                {innings.oversDisplay || "0.0"} overs
              </span>
            </div>

            <div className="final-innings-mini-facts">
              <span>
                RR{" "}
                <b>
                  {innings.runRate ?? "0.00"}
                </b>
              </span>

              <span>
                PP{" "}
                <b>
                  {innings.powerplay?.runs || 0}/
                  {innings.powerplay?.wickets || 0}
                </b>
              </span>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="final-no-innings">
        No innings score was recorded for this match.
      </div>
    )}

    <div className="final-match-next-step">
      <span>👇</span>

      <div>
        <strong>
          Match insights and full scorecard are
          displayed below
        </strong>

        <small>
          Tap either innings inside the scorecard to
          view batting, bowling, partnerships, and
          wickets.
        </small>
      </div>
    </div>
  </section>
)}

      {!tvMode && !isMatchFinished ? (
        <nav
          className="live-action-bar"
          aria-label="Scorecard actions"
        >
          <button
            type="button"
            onClick={shareLiveScore}
          >
            📤 <span>Share</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setTvMode(true)
            }
          >
            📺 <span>TV mode</span>
          </button>

          <button
            type="button"
            onClick={refreshNow}
            disabled={isRefreshing}
          >
            🔄{" "}
            <span>
              {isRefreshing
                ? "Refreshing"
                : "Refresh"}
            </span>
          </button>
        </nav>
      ) : null}

      {!tvMode &&
      (matchInsights ||
        topBatter ||
        bestBowler) ? (
        <AccordionSection
  id="live-insights-panel"
  title="📊 Match Insights"
  subtitle="Result, win probability and standout performers"
          open={showInsights}
          onToggle={() =>
            setShowInsights(
              (previous) => !previous
            )
          }
        >
          {matchInsights?.resultText ? (
            <div className="insight-result">
              <span>
                🏆 Match Result
              </span>

              <strong>
                {
                  matchInsights.resultText
                }
              </strong>
            </div>
          ) : null}

          <div className="live-stars-grid">
            <div className="live-star-card">
              <span>
                🔥 Top Batter
              </span>

              <strong>
                {topBatter?.playerName ||
                  "-"}
              </strong>

              <small>
                {topBatter
                  ? `${topBatter.runs} (${topBatter.balls})`
                  : "No runs yet"}
              </small>
            </div>

            <div className="live-star-card">
              <span>
                🎯 Best Bowler
              </span>

              <strong>
                {bestBowler?.playerName ||
                  "-"}
              </strong>

              <small>
                {bestBowler
                  ? `${bestBowler.wickets}/${bestBowler.runs} in ${bestBowler.overs} ov`
                  : "No figures yet"}
              </small>
            </div>
          </div>

          {matchInsights?.potm ? (
            <div className="insight-mini">
              <span>
                ⭐ Player of the Match
              </span>

              <strong>
                {
                  matchInsights.potm
                    .playerName
                }
              </strong>

              <small>
                {matchInsights.potm
                  .summary?.join(" & ") ||
                  "Top performer"}
              </small>
            </div>
          ) : null}

          {matchInsights?.winProbability ? (
            <div className="insight-mini">
              <span>
                📈 Win Probability
              </span>

              <div className="win-prob-row">
                <b>
                  {
                    matchInsights
                      .winProbability
                      .bowlingTeam
                  }
                </b>

                <div className="win-prob-track">
                  <i
                    style={{
                      width: `${matchInsights.winProbability.bowlingChance}%`,
                    }}
                  />
                </div>

                <b>
                  {
                    matchInsights
                      .winProbability
                      .bowlingChance
                  }
                  %
                </b>
              </div>

              <div className="win-prob-row">
                <b>
                  {
                    matchInsights
                      .winProbability
                      .battingTeam
                  }
                </b>

                <div className="win-prob-track chase">
                  <i
                    style={{
                      width: `${matchInsights.winProbability.battingChance}%`,
                    }}
                  />
                </div>

                <b>
                  {
                    matchInsights
                      .winProbability
                      .battingChance
                  }
                  %
                </b>
              </div>
            </div>
          ) : null}

          <div className="live-rate-trend">
            <div className="rate-row">
              <span>
                CRR {rateTrend.crr}
              </span>

              <div className="rate-track">
                <i
                  style={{
                    width: `${rateTrend.crrPct}%`,
                  }}
                />
              </div>
            </div>

            <div className="rate-row rrr">
              <span>
                RRR {rateTrend.rrr}
              </span>

              <div className="rate-track">
                <i
                  style={{
                    width: `${rateTrend.rrrPct}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </AccordionSection>
      ) : null}

      {!tvMode ? (
        <AccordionSection
  id="full-scorecard-panel"
  title="📋 Full Scorecard"
  subtitle="Explore batting, bowling, partnerships and wickets"
          open={showScorecard}
          onToggle={() =>
            setShowScorecard(
              (previous) => !previous
            )
          }
        >
          <div className="live-innings-list">
            {scoreboard?.innings?.map(
              (innings) => {
                const isCollapsed =
                  collapsedInnings[
                    innings.number
                  ] !== false;

                return (
                  <section
                    key={innings.number}
                    className="live-innings-card"
                  >
                    <button
                      type="button"
                      className="live-innings-header"
                      onClick={() =>
                        toggleInnings(
                          innings.number
                        )
                      }
                      aria-expanded={
                        !isCollapsed
                      }
                      aria-controls={`innings-${innings.number}-content`}
                    >
                      <div>
                        <span>
                          Innings{" "}
                          {innings.number}
                        </span>

                        <strong>
                          {
                            innings.teamName
                          }
                        </strong>
                      </div>

                      <b>
                        {innings.runs}/
                        {innings.wickets}{" "}
                        <small>
                          (
                          {
                            innings.oversDisplay
                          }
                          )
                        </small>
                      </b>

                      <i aria-hidden="true">
                        {isCollapsed
                          ? "+"
                          : "−"}
                      </i>
                    </button>

                    {!isCollapsed ? (
                      <div
                        id={`innings-${innings.number}-content`}
                        className="live-innings-body"
                      >
                        <div className="live-summary-grid">
                          <InfoPill
                            label="Score"
                            value={`${innings.runs}/${innings.wickets}`}
                          />

                          <InfoPill
                            label="Overs"
                            value={
                              innings.oversDisplay
                            }
                          />

                          <InfoPill
                            label="Run Rate"
                            value={
                              innings.runRate
                            }
                          />

                          <InfoPill
                            label="Powerplay"
                            value={`${
                              innings
                                .powerplay
                                ?.runs || 0
                            }/${
                              innings
                                .powerplay
                                ?.wickets ||
                              0
                            }`}
                          />
                        </div>

                        <h3 className="live-section-title">
                          🏏 Batting
                        </h3>

                        <ProTable type="batting">
                          <thead>
                            <tr>
                              <th>
                                Player
                              </th>
                              <th>R</th>
                              <th>B</th>
                              <th>4s</th>
                              <th>6s</th>
                              <th>SR</th>
                              <th>
                                Dismissal
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {innings?.battingStats?.map(
                              (
                                batter
                              ) => {
                                const isTopScorer =
                                  Number(
                                    batter.runs ||
                                      0
                                  ) ===
                                    getTopRuns(
                                      innings.battingStats
                                    ) &&
                                  Number(
                                    batter.runs ||
                                      0
                                  ) > 0;

                                const isNotOut =
                                  !batter.dismissal &&
                                  !batter.isRetiredHurt;

                                return (
                                  <tr
                                    key={
                                      batter.playerId
                                    }
                                    className={
                                      isTopScorer
                                        ? "highlight-top-batter"
                                        : ""
                                    }
                                  >
                                    <td className="name-cell">
                                      {
                                        batter.playerName
                                      }
                                    </td>

                                    <td>
                                      {
                                        batter.runs
                                      }
                                    </td>

                                    <td>
                                      {
                                        batter.balls
                                      }
                                    </td>

                                    <td>
                                      {
                                        batter.fours
                                      }
                                    </td>

                                    <td>
                                      {
                                        batter.sixes
                                      }
                                    </td>

                                    <td>
                                      {
                                        batter.strikeRate
                                      }
                                    </td>

                                    <td>
                                      {batter.isRetiredHurt ? (
                                        <span className="score-badge retired">
                                          Retired
                                          hurt
                                        </span>
                                      ) : isNotOut ? (
                                        <span className="score-badge notout">
                                          not out
                                        </span>
                                      ) : (
                                        batter.dismissal ||
                                        "-"
                                      )}
                                    </td>
                                  </tr>
                                );
                              }
                            )}
                          </tbody>
                        </ProTable>

                        <h3 className="live-section-title">
                          🎯 Bowling
                        </h3>

                        <ProTable type="bowling">
                          <thead>
                            <tr>
                              <th>
                                Bowler
                              </th>
                              <th>
                                Overs
                              </th>
                              <th>
                                Runs
                              </th>
                              <th>
                                Wickets
                              </th>
                              <th>
                                Dots
                              </th>
                              <th>
                                Economy
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {innings?.bowlingStats?.map(
                              (
                                bowler
                              ) => {
                                const isBestBowler =
                                  Number(
                                    bowler.wickets ||
                                      0
                                  ) ===
                                    getBestWickets(
                                      innings.bowlingStats
                                    ) &&
                                  Number(
                                    bowler.wickets ||
                                      0
                                  ) > 0;

                                return (
                                  <tr
                                    key={
                                      bowler.playerId
                                    }
                                    className={
                                      isBestBowler
                                        ? "highlight-best-bowler"
                                        : ""
                                    }
                                  >
                                    <td className="name-cell">
                                      {
                                        bowler.playerName
                                      }
                                    </td>

                                    <td>
                                      {
                                        bowler.overs
                                      }
                                    </td>

                                    <td>
                                      {
                                        bowler.runs
                                      }
                                    </td>

                                    <td>
                                      {Number(
                                        bowler.wickets ||
                                          0
                                      ) >
                                      0 ? (
                                        <span className="score-badge wicket">
                                          {
                                            bowler.wickets
                                          }
                                        </span>
                                      ) : (
                                        bowler.wickets
                                      )}
                                    </td>

                                    <td>
                                      {
                                        bowler.dots
                                      }
                                    </td>

                                    <td>
                                      {
                                        bowler.economy
                                      }
                                    </td>
                                  </tr>
                                );
                              }
                            )}
                          </tbody>
                        </ProTable>

                        <h3 className="live-section-title">
                          🤝 Partnerships
                        </h3>

                        <ProTable type="partnerships">
                          <thead>
                            <tr>
                              <th>
                                Batters
                              </th>
                              <th>
                                Runs
                              </th>
                              <th>
                                Balls
                              </th>
                              <th>
                                Status
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {innings.partnerships?.map(
                              (
                                partnership,
                                index
                              ) => (
                                <tr
                                  key={`${partnership.batter1}-${partnership.batter2}-${index}`}
                                >
                                  <td className="name-cell">
                                    {
                                      partnership.batter1
                                    }{" "}
                                    &amp;{" "}
                                    {
                                      partnership.batter2
                                    }
                                  </td>

                                  <td>
                                    {
                                      partnership.runs
                                    }
                                  </td>

                                  <td>
                                    {
                                      partnership.balls
                                    }
                                  </td>

                                  <td>
                                    {partnership.ongoing
                                      ? "Current"
                                      : `W${partnership.wicketNumber}`}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </ProTable>

                        <h3 className="live-section-title">
                          ☝️ Fall of wickets
                        </h3>

                        <ProTable type="wickets">
                          <thead>
                            <tr>
                              <th>
                                Wicket
                              </th>
                              <th>
                                Score
                              </th>
                              <th>
                                Player
                              </th>
                              <th>
                                Over
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {innings.fallOfWickets?.map(
                              (
                                wicket,
                                index
                              ) => (
                                <tr
                                  key={`${wicket.wicketNumber}-${index}`}
                                >
                                  <td>
                                    {
                                      wicket.wicketNumber
                                    }
                                  </td>

                                  <td>
                                    {
                                      wicket.score
                                    }
                                  </td>

                                  <td className="name-cell">
                                    {
                                      wicket.playerOut
                                    }
                                  </td>

                                  <td>
                                    {
                                      wicket.over
                                    }
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </ProTable>
                      </div>
                    ) : null}
                  </section>
                );
              }
            )}
          </div>
        </AccordionSection>
      ) : null}

      {error ? (
        <p className="live-inline-error">
          {error}
        </p>
      ) : null}
    </main>
  );
}