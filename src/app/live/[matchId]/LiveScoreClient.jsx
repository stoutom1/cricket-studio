"use client";

import {useEffect,useMemo,useRef,useState,} from "react";
import { buildMatchInsights } from "@/lib/match-insights";
import "@/app/live-score-premium.css";
import { trackGrowthEvent } from "@/components/growth-tracker";

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

function MobileStatValue({
  label,
  value,
  className = "",
}) {
  return (
    <div className={`mobile-stat-value ${className}`}>
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </div>
  );
}

function MobileExpandableList({
  rows = [],
  previewCount,
  itemLabel,
  renderItem,
  className = "",
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      className={`mobile-scorecard-group ${className} ${
        expanded ? "is-expanded" : ""
      }`}
    >
      <button
        type="button"
        className="mobile-scorecard-section-toggle"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <span>
          <small>{rows.length}</small>
          <strong>{itemLabel}</strong>
        </span>

        <b aria-hidden="true">
          {expanded ? "−" : "+"}
        </b>
      </button>

      {expanded ? (
        <div className="mobile-scorecard-list">
          {rows.map(renderItem)}
        </div>
      ) : null}
    </section>
  );
}

function MobileBattingCards({ rows = [] }) {
  const topRuns = getTopRuns(rows);

  return (
    <MobileExpandableList
      rows={rows}
      previewCount={2}
      itemLabel="Batting"
      className="mobile-batting-list"
      renderItem={(batter) => {
        const isTopScorer =
          Number(batter.runs || 0) === topRuns &&
          Number(batter.runs || 0) > 0;

        const isNotOut =
          !batter.dismissal &&
          !batter.isRetiredHurt;

        const dismissal = batter.isRetiredHurt
          ? "Retired hurt"
          : isNotOut
            ? "Not out"
            : batter.dismissal || "—";

        return (
          <article
            key={`mobile-batter-${batter.playerId}`}
            className={`mobile-scorecard-card ${
              isTopScorer ? "is-highlighted" : ""
            }`}
          >
            <header>
              <span>Batting</span>
              <strong>{batter.playerName}</strong>
            </header>

            <div className="mobile-stat-grid batting-stat-grid">
              <MobileStatValue
                label="Runs"
                value={batter.runs}
                className="is-primary"
              />
              <MobileStatValue
                label="Balls"
                value={batter.balls}
              />
              <MobileStatValue
                label="4s"
                value={batter.fours}
              />
              <MobileStatValue
                label="6s"
                value={batter.sixes}
              />
              <MobileStatValue
                label="Strike rate"
                value={batter.strikeRate}
              />
            </div>

            <footer>
              <span>Dismissal</span>
              <strong>{dismissal}</strong>
            </footer>
          </article>
        );
      }}
    />
  );
}

function MobileBowlingCards({ rows = [] }) {
  const bestWickets = getBestWickets(rows);

  return (
    <MobileExpandableList
      rows={rows}
      previewCount={2}
      itemLabel="Bowling"
      className="mobile-bowling-list"
      renderItem={(bowler) => {
        const isBestBowler =
          Number(bowler.wickets || 0) === bestWickets &&
          Number(bowler.wickets || 0) > 0;

        return (
          <article
            key={`mobile-bowler-${bowler.playerId}`}
            className={`mobile-scorecard-card ${
              isBestBowler ? "is-highlighted" : ""
            }`}
          >
            <header>
              <span>Bowling</span>
              <strong>{bowler.playerName}</strong>
            </header>

            <div className="mobile-stat-grid bowling-stat-grid">
              <MobileStatValue
                label="Overs"
                value={bowler.overs}
              />
              <MobileStatValue
                label="Runs"
                value={bowler.runs}
              />
              <MobileStatValue
                label="Wickets"
                value={bowler.wickets}
                className="is-primary"
              />
              <MobileStatValue
                label="Dots"
                value={bowler.dots}
              />
              <MobileStatValue
                label="Economy"
                value={bowler.economy}
              />
            </div>
          </article>
        );
      }}
    />
  );
}

function MobilePartnershipCards({ rows = [] }) {
  return (
    <MobileExpandableList
      rows={rows}
      previewCount={1}
      itemLabel="Partnerships"
      className="mobile-partnership-list"
      renderItem={(partnership, index) => (
        <article
          key={`mobile-partnership-${partnership.batter1}-${partnership.batter2}-${index}`}
          className="mobile-scorecard-card"
        >
          <header>
            <span>Partnership</span>
            <strong>
              {partnership.batter1} &amp; {partnership.batter2}
            </strong>
          </header>

          <div className="mobile-stat-grid partnership-stat-grid">
            <MobileStatValue
              label="Runs"
              value={partnership.runs}
              className="is-primary"
            />
            <MobileStatValue
              label="Balls"
              value={partnership.balls}
            />
            <MobileStatValue
              label="Status"
              value={
                partnership.ongoing
                  ? "Current"
                  : `W${partnership.wicketNumber}`
              }
            />
          </div>
        </article>
      )}
    />
  );
}

function MobileWicketCards({ rows = [] }) {
  return (
    <MobileExpandableList
      rows={rows}
      previewCount={1}
      itemLabel="Fall of wickets"
      className="mobile-wicket-list"
      renderItem={(wicket, index) => (
        <article
          key={`mobile-wicket-${wicket.wicketNumber}-${index}`}
          className="mobile-scorecard-card"
        >
          <header>
            <span>Fall of wicket</span>
            <strong>{wicket.playerOut}</strong>
          </header>

          <div className="mobile-stat-grid wicket-stat-grid">
            <MobileStatValue
              label="Wicket"
              value={wicket.wicketNumber}
            />
            <MobileStatValue
              label="Score"
              value={wicket.score}
              className="is-primary"
            />
            <MobileStatValue
              label="Over"
              value={wicket.over}
            />
          </div>
        </article>
      )}
    />
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

function LiveBroadcastIntelligence({
  broadcast,
  currentInnings,
  chaseRunsNeeded,
  ballsLeft,
  requiredRate,
  currentRate,
}) {
  if (!broadcast) {
    return null;
  }

  const partnership =
    broadcast.partnership;
  const matchup =
    broadcast.matchup;
  const milestone =
    broadcast.milestone;
  const phase =
    broadcast.phase;

  let pressureLabel =
    "Match building";
  let pressureTone =
    "balanced";
  let pressureDetail =
    currentInnings === 2
      ? "Chase pressure will update as the equation changes."
      : "First innings pressure will update with the scoring phase.";

  if (
    currentInnings === 2 &&
    chaseRunsNeeded !== null &&
    Number(ballsLeft) > 0
  ) {
    const rrr =
      Number(
        requiredRate ||
        0
      );
    const crr =
      Number(
        currentRate ||
        0
      );

    if (
      rrr >=
        crr + 2 ||
      Number(ballsLeft) <=
        18
    ) {
      pressureLabel =
        "High-pressure chase";
      pressureTone =
        "high";
    } else if (
      rrr >
      crr
    ) {
      pressureLabel =
        "Chase tightening";
      pressureTone =
        "medium";
    } else {
      pressureLabel =
        "Chase under control";
      pressureTone =
        "low";
    }

    pressureDetail =
      `Need ${chaseRunsNeeded} from ${ballsLeft} balls · RRR ${requiredRate || "—"}`;
  } else if (
    phase?.tone ===
    "batting"
  ) {
    pressureLabel =
      "Batting momentum";
    pressureTone =
      "low";
    pressureDetail =
      `${phase.runs} runs from the last ${phase.legalBalls} legal balls`;
  } else if (
    phase?.tone ===
    "bowling"
  ) {
    pressureLabel =
      "Bowling squeeze";
    pressureTone =
      "high";
    pressureDetail =
      `${phase.wickets} wicket${phase.wickets === 1 ? "" : "s"} in the last ${phase.legalBalls} legal balls`;
  }

  return (
    <section
      className="live-broadcast-center"
      aria-label="Broadcast intelligence"
    >
      <div className="live-broadcast-heading">
        <div>
          <span>
            📡 Broadcast intelligence
          </span>
          <strong>
            Live match context
          </strong>
        </div>

        <em>
          Auto-updating
        </em>
      </div>

      <div className="live-broadcast-grid">
        <article className="live-broadcast-card">
          <small>
            🤝 Partnership
          </small>

          {partnership ? (
            <>
              <strong>
                {partnership.runs} runs
              </strong>

              <span>
                {partnership.balls} balls
              </span>

              <p>
                {partnership.batter1}
                {" & "}
                {partnership.batter2}
              </p>
            </>
          ) : (
            <p>
              New partnership forming
            </p>
          )}
        </article>

        <article className="live-broadcast-card">
          <small>
            ⚔️ Batter vs bowler
          </small>

          {matchup ? (
            <>
              <strong>
                {matchup.runs} from{" "}
                {matchup.balls}
              </strong>

              <span>
                SR {matchup.strikeRate}
                {matchup.dismissals
                  ? ` · ${matchup.dismissals} dismissal${matchup.dismissals === 1 ? "" : "s"}`
                  : ""}
              </span>

              <p>
                {matchup.batterName}
                {" vs "}
                {matchup.bowlerName}
              </p>
            </>
          ) : (
            <p>
              Matchup data building
            </p>
          )}
        </article>

        <article className="live-broadcast-card">
          <small>
            ✨ Milestone watch
          </small>

          {milestone ? (
            <>
              <strong>
                {milestone.remaining} to go
              </strong>

              <span>
                {milestone.current}
                {" / "}
                {milestone.target}
              </span>

              <p>
                {milestone.icon}{" "}
                {milestone.playerName}
                {" → "}
                {milestone.label}
              </p>
            </>
          ) : (
            <>
              <strong>
                No milestone imminent
              </strong>
              <p>
                Watches 50/100+ scores and 3/5-wicket marks
              </p>
            </>
          )}
        </article>

        <article
          className={`live-broadcast-card live-broadcast-pressure is-${pressureTone}`}
        >
          <small>
            🌡 Match pressure
          </small>

          <strong>
            {pressureLabel}
          </strong>

          {phase ? (
            <span>
              {phase.label}
              {" · "}
              {phase.runs} runs
              {phase.wickets
                ? ` · ${phase.wickets} wicket${phase.wickets === 1 ? "" : "s"}`
                : ""}
            </span>
          ) : null}

          <p>
            {pressureDetail}
          </p>
        </article>
      </div>
    </section>
  );
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

function SuperOverLiveDetails({ superOver, compact = false }) {
  if (!superOver?.exists) return null;

  return (
    <section
      className="live-innings-card"
      style={{
        marginTop: 16,
        borderColor: "rgba(245, 158, 11, 0.45)",
        background: "rgba(120, 53, 15, 0.12)",
      }}
      aria-label="Super Over scorecard"
    >
      <div className="live-innings-header" style={{ cursor: "default" }}>
        <div>
          <span>⚡ Tie-breaker</span>
          <strong>Super Over</strong>
        </div>
        <b>
          {superOver.completed
            ? "Final"
            : superOver.active
              ? `Round ${superOver.round} live`
              : `Round ${superOver.round}`}
        </b>
      </div>

      <div style={{ padding: compact ? 12 : 16 }}>
        {(superOver.history || []).map((round) => (
          <div
            key={`live-super-over-details-${round.round}`}
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <strong>Round {round.round}</strong>

            {[round.first, round.second].map((innings, inningsIndex) => (
              <details
                key={`live-so-innings-${round.round}-${inningsIndex}`}
                open={!compact}
                style={{
                  marginTop: 10,
                  padding: 10,
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 10,
                }}
              >
                <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                  {innings.teamName}: {innings.runs}/{innings.wickets} ({innings.overs} ov)
                </summary>

                <div style={{ marginTop: 10, overflowX: "auto" }}>
                  <strong>🏏 Batting</strong>
                  <table className="live-pro-table" style={{ marginTop: 8, width: "100%" }}>
                    <thead>
                      <tr>
                        <th>Batter</th>
                        <th>R</th>
                        <th>B</th>
                        <th>4s</th>
                        <th>6s</th>
                        <th>SR</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(innings.batting || []).map((batter) => (
                        <tr key={`live-so-bat-${round.round}-${inningsIndex}-${batter.playerId}`}>
                          <td>{batter.playerName}</td>
                          <td>{batter.runs}</td>
                          <td>{batter.balls}</td>
                          <td>{batter.fours}</td>
                          <td>{batter.sixes}</td>
                          <td>{batter.strikeRate}</td>
                          <td>{batter.dismissal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {(innings.bowling || []).length > 0 ? (
                  <div style={{ marginTop: 12, overflowX: "auto" }}>
                    <strong>🎯 Bowling</strong>
                    <table className="live-pro-table" style={{ marginTop: 8, width: "100%" }}>
                      <thead>
                        <tr>
                          <th>Bowler</th>
                          <th>O</th>
                          <th>R</th>
                          <th>W</th>
                          <th>Econ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(innings.bowling || []).map((bowler) => (
                          <tr key={`live-so-bowl-${round.round}-${inningsIndex}-${bowler.playerId}`}>
                            <td>{bowler.playerName}</td>
                            <td>{bowler.overs}</td>
                            <td>{bowler.runs}</td>
                            <td>{bowler.wickets}</td>
                            <td>{bowler.economy}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {(innings.commentary || []).length > 0 ? (
                  <div style={{ marginTop: 12 }}>
                    <strong>📝 Ball by ball</strong>
                    <div className="live-recent-strip" style={{ marginTop: 8 }}>
                      {innings.commentary.map((ball) => (
                        <b
                          key={`live-so-ball-${round.round}-${inningsIndex}-${ball.id}`}
                          className={`live-ball ${
                            ball.isWicket
                              ? "live-ball-wicket"
                              : ball.extraType === "WIDE" || ball.extraType === "NOBALL"
                                ? "live-ball-extra"
                                : ball.runsOffBat === 4
                                  ? "live-ball-four"
                                  : ball.runsOffBat === 6
                                    ? "live-ball-six"
                                    : "live-ball-normal"
                          }`}
                          title={`${ball.over} ${ball.text} • ${ball.score}`}
                        >
                          {ball.badge}
                        </b>
                      ))}
                    </div>
                  </div>
                ) : null}
              </details>
            ))}

            {round.resultText ? (
              <small style={{ display: "block", marginTop: 8 }}>
                {round.resultText}
              </small>
            ) : null}
          </div>
        ))}

        {superOver.resultText ? (
          <strong style={{ display: "block", marginTop: 12 }}>
            🏆 {superOver.resultText}
          </strong>
        ) : null}
      </div>
    </section>
  );
}

function getTvPressureModel({
  currentInnings,
  chaseRunsNeeded,
  ballsLeft,
  requiredRate,
  currentRate,
  latestInnings,
  broadcast,
}) {
  let score = 38;
  let label = "Building";
  let tone = "building";
  let detail = "The innings is still developing.";

  const recentWickets = Number(
    broadcast?.phase?.wickets || 0
  );

  if (
    Number(currentInnings) === 2 &&
    chaseRunsNeeded !== null &&
    Number(ballsLeft) > 0
  ) {
    const rrr = Number(requiredRate || 0);
    const crr = Number(currentRate || 0);
    const rateGap = rrr - crr;

    score =
      38 +
      Math.max(-15, Math.min(30, rateGap * 9)) +
      (Number(ballsLeft) <= 36 ? 8 : 0) +
      (Number(ballsLeft) <= 18 ? 12 : 0) +
      (Number(ballsLeft) <= 6 ? 12 : 0) +
      recentWickets * 6;

    if (score >= 82) {
      label = "Extreme";
      tone = "extreme";
    } else if (score >= 65) {
      label = "High";
      tone = "high";
    } else if (score >= 45) {
      label = "Rising";
      tone = "rising";
    } else {
      label = "Controlled";
      tone = "controlled";
    }

    detail =
      `Need ${chaseRunsNeeded} from ${ballsLeft} balls · ` +
      `RRR ${requiredRate || "—"} vs CRR ${currentRate || "—"}`;
  } else {
    const wickets = Number(latestInnings?.wickets || 0);
    const phaseRuns = Number(broadcast?.phase?.runs || 0);
    const phaseBalls = Number(broadcast?.phase?.legalBalls || 0);

    score =
      30 +
      Math.min(28, wickets * 4) +
      Math.min(18, recentWickets * 8) +
      (phaseBalls >= 12 && phaseRuns < 12 ? 10 : 0);

    if (score >= 72) {
      label = "High";
      tone = "high";
    } else if (score >= 50) {
      label = "Building";
      tone = "rising";
    } else {
      label = "Settled";
      tone = "controlled";
    }

    detail = broadcast?.phase?.label
      ? `${broadcast.phase.label} · ${phaseRuns} runs, ${recentWickets} wickets in recent phase`
      : "First-innings pressure updates with wickets and recent scoring.";
  }

  const normalized = Math.max(
    8,
    Math.min(96, Math.round(score))
  );

  return {
    score: normalized,
    label,
    tone,
    detail,
  };
}

function TvMetric({
  label,
  value,
  detail,
  accent = false,
}) {
  return (
    <article
      className={`tv2-metric ${
        accent ? "is-accent" : ""
      }`}
    >
      <small>{label}</small>
      <strong>{value}</strong>
      {detail ? <span>{detail}</span> : null}
    </article>
  );
}

function SpectatorTvMode({
  scoreboard,
  latestInnings,
  recentBalls,
  chaseRunsNeeded,
  ballsLeft,
  requiredRate,
  currentRate,
  strikerValue,
  nonStrikerValue,
  bowlerValue,
  liveStatusText,
  pressure,
  event,
  onExit,
}) {
  const broadcast = scoreboard?.broadcast || {};
  const partnership = broadcast?.partnership;
  const matchup = broadcast?.matchup;
  const milestone = broadcast?.milestone;
  const currentState = scoreboard?.currentState || {};

  const orderedBalls = [...(recentBalls || [])].reverse();

  const spotlightName =
    milestone?.playerName ||
    currentState?.strikerName ||
    currentState?.bowlerName ||
    "Player";

  const spotlightDetail =
    milestone
      ? `${milestone.icon || "✨"} ${milestone.remaining} to ${milestone.label}`
      : currentState?.strikerName
        ? `${strikerValue || "At the crease"} · striker`
        : bowlerValue || "Live player";

  const scoreText = latestInnings
    ? `${latestInnings.runs}/${latestInnings.wickets}`
    : "—";

  const oversText =
    latestInnings?.oversDisplay || "0.0";

  const renderBallStrip = () => (
    <div className="tv2-ball-strip">
      {orderedBalls.length ? (
        orderedBalls.map((ball, index) => {
          const display = getBallDisplay(ball.label);

          return (
            <b
              key={ball.id || index}
              className={`tv2-ball is-${display.type}`}
            >
              {display.text}
            </b>
          );
        })
      ) : (
        <span className="tv2-no-balls">
          Waiting for the first delivery
        </span>
      )}
    </div>
  );

  return (
    <>
      {/* =========================================================
          DESKTOP / LAPTOP TV MODE
          Completely separate structure from mobile so desktop sizing
          cannot be affected by the mobile stacked dashboard rules.
      ========================================================= */}
      <section
        className="tv2-desktop"
        aria-label="Cric4All Spectator TV Mode desktop"
      >
        <header className="tv2d-header">
          <div className="tv2d-brand">
            <span className="tv2-live-dot" />
            <strong>CRIC4ALL LIVE</strong>
            <small>TV MODE 2.0</small>
          </div>

          <div className="tv2d-match">
            {scoreboard?.match?.teamAName || "Team A"}
            <span>vs</span>
            {scoreboard?.match?.teamBName || "Team B"}
          </div>

          <button
            type="button"
            className="tv2d-exit"
            onClick={onExit}
          >
            ✕ Exit TV
          </button>
        </header>

        <section className="tv2d-score-row">
          <div className="tv2d-team">
            <small>BATTING</small>
            <strong>
              {latestInnings?.teamName || "Current innings"}
            </strong>
            <span>{liveStatusText}</span>
          </div>

          <div className="tv2d-score">
            <strong>{scoreText}</strong>
            <span>{oversText} OV</span>
          </div>

          <div className="tv2d-equation">
            {scoreboard?.currentInnings === 2 &&
            chaseRunsNeeded !== null ? (
              <>
                <small>CHASE</small>
                <strong>
                  {chaseRunsNeeded} off {ballsLeft ?? "—"}
                </strong>
                <span>
                  Required rate {requiredRate || "—"}
                </span>
              </>
            ) : (
              <>
                <small>CURRENT RATE</small>
                <strong>{currentRate || "0.00"}</strong>
                <span>
                  Target {scoreboard?.summary?.target || "—"}
                </span>
              </>
            )}
          </div>
        </section>

        <section className="tv2d-players">
          <article className="is-striker">
            <small>🏏 STRIKER</small>
            <strong>
              {currentState?.strikerName || "—"}
            </strong>
            <span>{strikerValue || "—"}</span>
          </article>

          <article>
            <small>🏃 NON-STRIKER</small>
            <strong>
              {currentState?.nonStrikerName || "—"}
            </strong>
            <span>{nonStrikerValue || "—"}</span>
          </article>

          <article className="is-bowler">
            <small>🎯 BOWLER</small>
            <strong>
              {currentState?.bowlerName || "—"}
            </strong>
            <span>{bowlerValue || "—"}</span>
          </article>
        </section>

        <section className="tv2d-intel">
          <article>
            <small>🤝 CURRENT PARTNERSHIP</small>
            <strong>
              {partnership
                ? `${partnership.runs} runs`
                : "Building"}
            </strong>
            <span>
              {partnership
                ? `${partnership.batter1} & ${partnership.batter2} · ${partnership.balls} balls`
                : "Partnership data will appear after play develops"}
            </span>
          </article>

          <article>
            <small>⚔ BATTER VS BOWLER</small>
            <strong>
              {matchup
                ? `${matchup.runs} off ${matchup.balls}`
                : "Building"}
            </strong>
            <span>
              {matchup
                ? `${matchup.batterName} vs ${matchup.bowlerName} · SR ${matchup.strikeRate}`
                : "Matchup data is building"}
            </span>
          </article>

          <article className={milestone ? "is-milestone" : ""}>
            <small>✨ MILESTONE WATCH</small>
            <strong>
              {milestone
                ? `${milestone.remaining} to go`
                : "No milestone imminent"}
            </strong>
            <span>
              {milestone
                ? `${milestone.playerName} → ${milestone.label}`
                : "Watching 50/100 scores and 3/5-wicket marks"}
            </span>
          </article>

          <article className={`tv2d-pressure is-${pressure.tone}`}>
            <div>
              <small>⚡ MATCH PRESSURE</small>
              <strong>{pressure.label}</strong>
            </div>

            <div className="tv2d-pressure-track">
              <span
                style={{
                  width: `${pressure.score}%`,
                }}
              />
            </div>

            <span>{pressure.detail}</span>
          </article>
        </section>

        <section className="tv2d-secondary">
          <article className="tv2d-spotlight">
            <div className="tv2d-avatar">
              {String(spotlightName)
                .trim()
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <small>🌟 PLAYER SPOTLIGHT</small>
              <strong>{spotlightName}</strong>
              <span>{spotlightDetail}</span>
            </div>
          </article>

          <article className="tv2d-phase">
            <div>
              <small>📡 LIVE PHASE</small>
              <strong>
                {broadcast?.phase?.label ||
                  "Match building"}
              </strong>
            </div>

            <div className="tv2d-phase-stats">
              <span>
                <b>{broadcast?.phase?.runs ?? 0}</b>
                Runs
              </span>
              <span>
                <b>{broadcast?.phase?.wickets ?? 0}</b>
                Wkts
              </span>
              <span>
                <b>{broadcast?.phase?.boundaries ?? 0}</b>
                Boundaries
              </span>
            </div>
          </article>
        </section>

        <footer className="tv2d-balls">
          <div>
            <small>LAST 12 BALLS</small>
            <strong>Latest →</strong>
          </div>
          {renderBallStrip()}
        </footer>
      </section>

      {/* =========================================================
          MOBILE / TABLET TV MODE
          Existing stacked mobile structure is preserved.
      ========================================================= */}
      <section
        className="tv2-shell tv2-mobile"
        aria-label="Cric4All Spectator TV Mode mobile"
      >
        <header className="tv2-topbar">
          <div>
            <span className="tv2-live-dot" />
            <strong>CRIC4ALL LIVE</strong>
            <small>TV MODE 2.0</small>
          </div>

          <div className="tv2-match-name">
            {scoreboard?.match?.teamAName || "Team A"}
            <span>vs</span>
            {scoreboard?.match?.teamBName || "Team B"}
          </div>

          <button
            type="button"
            onClick={onExit}
            className="tv2-exit"
          >
            ✕ Exit TV
          </button>
        </header>

        <div className="tv2-score-hero">
          <div className="tv2-team-block">
            <small>BATTING</small>
            <strong>
              {latestInnings?.teamName || "Current innings"}
            </strong>
            <span>{liveStatusText}</span>
          </div>

          <div className="tv2-score-block">
            <strong>{scoreText}</strong>
            <span>{oversText} OV</span>
          </div>

          <div className="tv2-equation-block">
            {scoreboard?.currentInnings === 2 &&
            chaseRunsNeeded !== null ? (
              <>
                <small>CHASE</small>
                <strong>
                  {chaseRunsNeeded} off {ballsLeft ?? "—"}
                </strong>
                <span>
                  Required rate {requiredRate || "—"}
                </span>
              </>
            ) : (
              <>
                <small>CURRENT RATE</small>
                <strong>{currentRate || "0.00"}</strong>
                <span>
                  Target {scoreboard?.summary?.target || "—"}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="tv2-main-grid">
          <div className="tv2-left-column">
            <section className="tv2-current-players">
              <article className="tv2-player is-striker">
                <small>🏏 STRIKER</small>
                <strong>
                  {currentState?.strikerName || "—"}
                </strong>
                <span>{strikerValue || "—"}</span>
              </article>

              <article className="tv2-player">
                <small>🏃 NON-STRIKER</small>
                <strong>
                  {currentState?.nonStrikerName || "—"}
                </strong>
                <span>{nonStrikerValue || "—"}</span>
              </article>

              <article className="tv2-player is-bowler">
                <small>🎯 BOWLER</small>
                <strong>
                  {currentState?.bowlerName || "—"}
                </strong>
                <span>{bowlerValue || "—"}</span>
              </article>
            </section>

            <section className="tv2-broadcast-grid">
              <TvMetric
                label="🤝 Current partnership"
                value={
                  partnership
                    ? `${partnership.runs} runs`
                    : "Building"
                }
                detail={
                  partnership
                    ? `${partnership.batter1} & ${partnership.batter2} · ${partnership.balls} balls`
                    : "Partnership data will appear after play develops"
                }
              />

              <TvMetric
                label="⚔ Batter vs bowler"
                value={
                  matchup
                    ? `${matchup.runs} off ${matchup.balls}`
                    : "Building"
                }
                detail={
                  matchup
                    ? `${matchup.batterName} vs ${matchup.bowlerName} · SR ${matchup.strikeRate}`
                    : "Matchup data is building"
                }
              />

              <TvMetric
                label="✨ Milestone watch"
                value={
                  milestone
                    ? `${milestone.remaining} to go`
                    : "No milestone imminent"
                }
                detail={
                  milestone
                    ? `${milestone.playerName} → ${milestone.label}`
                    : "Watching 50/100 scores and 3/5-wicket marks"
                }
                accent={Boolean(milestone)}
              />

              <article
                className={`tv2-pressure is-${pressure.tone}`}
              >
                <div className="tv2-pressure-head">
                  <small>⚡ MATCH PRESSURE</small>
                  <strong>{pressure.label}</strong>
                </div>

                <div className="tv2-pressure-track">
                  <span
                    style={{
                      width: `${pressure.score}%`,
                    }}
                  />
                </div>

                <p>{pressure.detail}</p>
              </article>
            </section>
          </div>

          <aside className="tv2-right-column">
            <section className="tv2-spotlight">
              <small>🌟 PLAYER SPOTLIGHT</small>
              <div className="tv2-spotlight-avatar">
                {String(spotlightName)
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
              </div>
              <strong>{spotlightName}</strong>
              <span>{spotlightDetail}</span>
            </section>

            <section className="tv2-phase">
              <small>📡 LIVE PHASE</small>
              <strong>
                {broadcast?.phase?.label ||
                  "Match building"}
              </strong>
              <div>
                <span>
                  <b>{broadcast?.phase?.runs ?? 0}</b>
                  Runs
                </span>
                <span>
                  <b>{broadcast?.phase?.wickets ?? 0}</b>
                  Wkts
                </span>
                <span>
                  <b>{broadcast?.phase?.boundaries ?? 0}</b>
                  Boundaries
                </span>
              </div>
            </section>
          </aside>
        </div>

        <footer className="tv2-ball-footer">
          <div className="tv2-ball-label">
            <small>LAST 12 BALLS</small>
            <strong>Latest →</strong>
          </div>
          {renderBallStrip()}
        </footer>
      </section>

      {event ? (
        <div
          className={`tv2-event-overlay is-${event.type}`}
          key={event.key}
          role="status"
        >
          <span>{event.icon}</span>
          <strong>{event.title}</strong>
          <p>{event.detail}</p>
        </div>
      ) : null}
    </>
  );
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
  const [tvEvent, setTvEvent] =
    useState(null);

  const tvLastBallRef = useRef(null);
  const tvPreviousStatsRef = useRef(null);
  const tvEventTimerRef = useRef(null);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const finalViewInitializedRef = useRef(false);
  const spectatorViewTrackedRef = useRef(false);

  /*
   * Phase 3 acquisition:
   * Track one spectator view for this mounted public scorecard after the API
   * resolves the real numeric match ID / league ID. Analytics failure must
   * never affect the live score experience.
   */
  useEffect(() => {
    const resolvedMatchId = Number(scoreboard?.match?.id);

    if (
      spectatorViewTrackedRef.current ||
      !Number.isInteger(resolvedMatchId) ||
      resolvedMatchId <= 0
    ) {
      return;
    }

    const storageKey =
      `cric4all_spectator_view_${resolvedMatchId}`;

    try {
      if (sessionStorage.getItem(storageKey)) {
        spectatorViewTrackedRef.current = true;
        return;
      }

      sessionStorage.setItem(storageKey, "1");
    } catch {
      // sessionStorage can be unavailable in privacy-restricted browsers.
    }

    spectatorViewTrackedRef.current = true;

    trackGrowthEvent("SPECTATOR_VIEW", {
      source: "LIVE_SCORECARD",
      matchId: resolvedMatchId,
      leagueId: scoreboard?.match?.leagueId,
      metadata: {
        shareCode: scoreboard?.match?.shareCode || null,
        publicRouteId: String(matchId || ""),
      },
    });
  }, [
    matchId,
    scoreboard?.match?.id,
    scoreboard?.match?.leagueId,
    scoreboard?.match?.shareCode,
  ]);

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

const loadedSuperOver = data?.superOver || null;

const loadedHasFinalResult =
  Boolean(
    loadedSuperOver?.completed ||
    data?.summary?.resultText ||
    data?.resultText ||
    data?.match?.resultText
  );

const loadedStatusText = String(
  data?.summary?.statusText ||
  data?.match?.statusText ||
  ""
).toLowerCase();

const loadedTieStillNeedsResolution =
  normalizeMatchStatus(loadedRawStatus) === "COMPLETED" &&
  !loadedSuperOver?.completed &&
  (
    loadedSuperOver?.active ||
    loadedSuperOver?.tied ||
    loadedStatusText.includes("tied") ||
    loadedStatusText.includes("super over")
  );

const loadedMatchIsFinal =
  Boolean(loadedSuperOver?.completed) ||
  (
    (isFinalMatchStatus(loadedRawStatus) || loadedHasFinalResult) &&
    !loadedTieStillNeedsResolution
  );

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

  useEffect(() => {
    function handleFullscreenChange() {
      if (
        tvMode &&
        !document.fullscreenElement
      ) {
        setTvMode(false);
      }
    }

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
    };
  }, [tvMode]);

  useEffect(() => {
    if (!tvMode || !scoreboard) {
      return;
    }

    const liveBalls =
      scoreboard?.recentBalls || [];

    /*
     * /api/liveview returns recentBalls newest-first today. Keep a fallback
     * that also works if a future API version returns oldest-first.
     */
    const newestBall =
      liveBalls.length > 0
        ? liveBalls.reduce((latest, ball) => {
            if (!latest) {
              return ball;
            }

            const latestId = Number(latest?.id);
            const ballId = Number(ball?.id);

            if (
              Number.isFinite(latestId) &&
              Number.isFinite(ballId)
            ) {
              return ballId > latestId
                ? ball
                : latest;
            }

            return latest;
          }, null)
        : null;

    const currentStats = {
      strikerId:
        scoreboard?.currentState?.strikerId || null,
      strikerName:
        scoreboard?.currentState?.strikerName || "",
      strikerRuns: Number(
        scoreboard?.currentState?.strikerStats?.runs || 0
      ),
      bowlerId:
        scoreboard?.currentState?.bowlerId || null,
      bowlerName:
        scoreboard?.currentState?.bowlerName || "",
      bowlerWickets: Number(
        scoreboard?.currentState?.bowlerStats?.wickets || 0
      ),
    };

    const previous =
      tvPreviousStatsRef.current;

    let nextEvent = null;

    if (
      previous &&
      previous.strikerId === currentStats.strikerId
    ) {
      const battingMarks = [50, 100, 150, 200];

      const crossed = battingMarks.find(
        (mark) =>
          previous.strikerRuns < mark &&
          currentStats.strikerRuns >= mark
      );

      if (crossed) {
        nextEvent = {
          key: `bat-${currentStats.strikerId}-${crossed}-${Date.now()}`,
          type: "milestone",
          icon: crossed >= 100 ? "💯" : "✨",
          title: `${crossed} RUN MILESTONE`,
          detail: `${currentStats.strikerName} reaches ${crossed}`,
        };
      }
    }

    if (
      !nextEvent &&
      previous &&
      previous.bowlerId === currentStats.bowlerId
    ) {
      const bowlingMarks = [3, 5];

      const crossed = bowlingMarks.find(
        (mark) =>
          previous.bowlerWickets < mark &&
          currentStats.bowlerWickets >= mark
      );

      if (crossed) {
        nextEvent = {
          key: `bowl-${currentStats.bowlerId}-${crossed}-${Date.now()}`,
          type: "milestone",
          icon: crossed >= 5 ? "🔥" : "🎯",
          title: `${crossed}-WICKET MILESTONE`,
          detail: `${currentStats.bowlerName} reaches ${crossed} wickets`,
        };
      }
    }

    if (
      !nextEvent &&
      newestBall?.id &&
      tvLastBallRef.current &&
      String(newestBall.id) !==
        String(tvLastBallRef.current)
    ) {
      const display = getBallDisplay(
        newestBall.label
      );

      const newestBallText = String(
        newestBall?.label || ""
      ).toUpperCase();

      const isWicketBall =
        display.type === "wicket" ||
        (
          newestBallText.includes("W") &&
          !newestBallText.includes("WD")
        ) ||
        newestBallText.includes("WICKET");

      const isSixBall =
        display.type === "six" ||
        /(^|\s|\()6(\s|\)|$)/.test(
          newestBallText
        );

      if (isWicketBall) {
        nextEvent = {
          key: `wicket-${newestBall.id}-${Date.now()}`,
          type: "wicket",
          icon: "☝️",
          title: "WICKET!",
          detail:
            newestBall.label ||
            "A wicket has fallen",
        };
      } else if (isSixBall) {
        nextEvent = {
          key: `six-${newestBall.id}-${Date.now()}`,
          type: "boundary",
          icon: "🚀",
          title: "SIX!",
          detail:
            scoreboard?.currentState?.strikerName ||
            "Maximum",
        };
      }
    }

    if (newestBall?.id) {
      tvLastBallRef.current =
        newestBall.id;
    }

    tvPreviousStatsRef.current =
      currentStats;

    if (nextEvent) {
      setTvEvent(nextEvent);

      if (tvEventTimerRef.current) {
        window.clearTimeout(
          tvEventTimerRef.current
        );
      }

      tvEventTimerRef.current =
        window.setTimeout(() => {
          setTvEvent(null);
        }, 4200);
    }
  }, [scoreboard, tvMode]);

  useEffect(() => {
    return () => {
      if (tvEventTimerRef.current) {
        window.clearTimeout(
          tvEventTimerRef.current
        );
      }
    };
  }, []);


  if (error && !scoreboard) {
    return (
      <main className="live-page-shell live-score-final">
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
      <main className="live-page-shell live-score-final">
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

const superOver = scoreboard?.superOver || null;

const hasRecordedFinalResult =
  Boolean(
    superOver?.completed ||
    scoreboard?.summary?.resultText ||
    scoreboard?.resultText ||
    scoreboard?.match?.resultText
  );

const regulationTieStillNeedsResolution =
  matchStatus === "COMPLETED" &&
  !superOver?.completed &&
  (
    superOver?.active ||
    superOver?.tied ||
    String(scoreboard?.summary?.statusText || "")
      .toLowerCase()
      .includes("tied") ||
    String(scoreboard?.summary?.statusText || "")
      .toLowerCase()
      .includes("super over")
  );

const isMatchFinished =
  Boolean(superOver?.completed) ||
  (
    (isFinalMatchStatus(matchStatus) || hasRecordedFinalResult) &&
    !regulationTieStillNeedsResolution
  );
  
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
  superOver?.resultText ||
  scoreboard?.summary?.resultText ||
  scoreboard?.resultText ||
  scoreboard?.match?.resultText ||
  matchInsights?.resultText ||
  scoreboard?.summary?.statusText ||
  (matchStatus === "ABANDONED"
    ? "The match was abandoned."
    : "Match completed.");

const liveDls =
  scoreboard?.summary?.dls ||
  scoreboard?.match?.dls ||
  null;

const liveDlsActive =
  Boolean(
    liveDls?.active
  );

const liveDlsMethodLabel =
  liveDls?.methodLabel ||
  (
    liveDlsActive
      ? "D/L Standard"
      : ""
  );

const liveStatusText =
  isMatchFinished &&
  matchStatus !== "ABANDONED" &&
  finalResultText
    ? (
        String(finalResultText)
          .trim()
          .startsWith("🏆")
          ? finalResultText
          : `🏆 ${finalResultText}`
      )
    : (
        scoreboard?.summary
          ?.statusText ||
        scoreboard?.match
          ?.statusText ||
        "Match in progress"
      );

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

  const spectatorScoreNowHref = (() => {
    const params = new URLSearchParams();

    params.set("source", "spectator");

    if (scoreboard?.match?.id) {
      params.set(
        "originMatchId",
        String(scoreboard.match.id)
      );
    }

    if (scoreboard?.match?.leagueId) {
      params.set(
        "originLeagueId",
        String(scoreboard.match.leagueId)
      );
    }

    if (scoreboard?.match?.shareCode) {
      params.set(
        "originShareCode",
        String(scoreboard.match.shareCode)
      );
    }

    params.set(
      "originState",
      isMatchFinished ? "completed" : "live"
    );

    return `/score-now?${params.toString()}`;
  })();

  function openSpectatorScoreNow() {
    trackGrowthEvent(
      "SPECTATOR_CTA_CLICKED",
      {
        source: isMatchFinished
          ? "COMPLETED_SCORECARD_CTA"
          : "LIVE_SCORECARD_CTA",
        matchId:
          scoreboard?.match?.id,
        leagueId:
          scoreboard?.match?.leagueId,
        metadata: {
          shareCode:
            scoreboard?.match?.shareCode || null,
          matchState:
            isMatchFinished
              ? "completed"
              : "live",
          cta:
            "SCORE_YOUR_MATCH_FREE",
        },
      }
    );
  }

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

  const recentBalls =
    scoreboard?.recentBalls?.slice(-12) || [];

  const tvPressure = getTvPressureModel({
    currentInnings: scoreboard?.currentInnings,
    chaseRunsNeeded,
    ballsLeft,
    requiredRate,
    currentRate: rateTrend.crr,
    latestInnings,
    broadcast: scoreboard?.broadcast,
  });

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

  function openFullScorecard() {
    setShowScorecard(true);

    window.requestAnimationFrame(() => {
      document
        .getElementById("full-scorecard-panel")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  }

  async function openTvMode() {
    setTvMode(true);

    try {
      if (
        document.documentElement?.requestFullscreen &&
        !document.fullscreenElement
      ) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /*
       * Fullscreen can be blocked by browser/embedded WebView policy.
       * TV Mode still works as an in-page full-screen fixed layout.
       */
    }
  }

  async function closeTvMode() {
    setTvMode(false);
    setTvEvent(null);

    try {
      if (
        document.fullscreenElement &&
        document.exitFullscreen
      ) {
        await document.exitFullscreen();
      }
    } catch {
      // Safe fallback: leaving TV state still restores normal live view.
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
      className={`live-page-shell live-score-final ${
        tvMode ? "live-tv-mode" : ""
      }`}
    >
{tvMode && !isMatchFinished ? (
      <SpectatorTvMode
        scoreboard={scoreboard}
        latestInnings={latestInnings}
        recentBalls={recentBalls}
        chaseRunsNeeded={chaseRunsNeeded}
        ballsLeft={ballsLeft}
        requiredRate={requiredRate}
        currentRate={rateTrend.crr}
        strikerValue={strikerValue}
        nonStrikerValue={nonStrikerValue}
        bowlerValue={bowlerValue}
        liveStatusText={liveStatusText}
        pressure={tvPressure}
        event={tvEvent}
        onExit={closeTvMode}
      />
) : !isMatchFinished ? (
      <section
        className="live-primary-card live-primary-card-compact"
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

  <div className="live-primary-utilities">
    <span className="live-refresh-copy">
      {isMatchFinished
        ? "Final scorecard"
        : "Updates every 5 seconds"}
    </span>

    {!tvMode && !isMatchFinished ? (
      <nav
        className="live-inline-actions"
        aria-label="Live score actions"
      >
        <button
          type="button"
          onClick={shareLiveScore}
          className="live-inline-action"
          aria-label="Share live score"
          title="Share live score"
        >
          <span
            className="live-inline-action-icon"
            aria-hidden="true"
          >
            ↗
          </span>

          <span className="live-inline-action-label">
            Share
          </span>
        </button>

        <button
          type="button"
          onClick={openTvMode}
          className="live-inline-action"
          aria-label="Open TV mode"
          title="Open TV mode"
        >
          <span
            className="live-inline-action-icon"
            aria-hidden="true"
          >
            ▣
          </span>

          <span className="live-inline-action-label">
            TV mode
          </span>
        </button>

        <button
          type="button"
          onClick={refreshNow}
          disabled={isRefreshing}
          className={`live-inline-action ${
            isRefreshing ? "is-refreshing" : ""
          }`}
          aria-label={
            isRefreshing
              ? "Refreshing live score"
              : "Refresh live score"
          }
          title="Refresh live score"
        >
          <span
            className="live-inline-action-icon"
            aria-hidden="true"
          >
            ↻
          </span>

          <span className="live-inline-action-label">
            {isRefreshing
              ? "Refreshing"
              : "Refresh"}
          </span>
        </button>
      </nav>
    ) : null}
  </div>
</div>

        <div className="live-match-title">
          {scoreboard?.match?.teamAName}

          <span>vs</span>

          {scoreboard?.match?.teamBName}
        </div>

        <div className="live-score-focus live-score-focus-compact">
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
          {liveStatusText}
        </p>

        {liveDlsActive &&
        !superOver?.active &&
        !superOver?.tied ? (
          <div
            className="live-chase-card"
            style={{
              borderColor:
                "rgba(56, 189, 248, 0.38)",
              background:
                "rgba(14, 116, 144, 0.10)",
            }}
          >
            <span>
              🌧 {liveDlsMethodLabel}
            </span>

            <strong>
              {scoreboard?.currentInnings === 2 &&
              scoreboard?.summary?.target
                ? `Revised target ${scoreboard.summary.target}`
                : "Rain-adjusted match"}
            </strong>

            <small>
              {scoreboard?.currentInnings === 2 &&
              Number(
                liveDls?.innings2Allocation ||
                0
              ) > 0
                ? `${liveDls.innings2Allocation} over${
                    Number(
                      liveDls.innings2Allocation
                    ) === 1
                      ? ""
                      : "s"
                  } allocation`
                : Number(
                    liveDls?.revisedOvers ||
                    0
                  ) > 0
                  ? `${liveDls.revisedOvers} revised over${
                      Number(
                        liveDls.revisedOvers
                      ) === 1
                        ? ""
                        : "s"
                    }`
                  : "DLS adjustment active"}
            </small>
          </div>
        ) : null}

        {superOver?.exists && !isMatchFinished ? (
          <div
            className="live-chase-card"
            style={{ borderColor: "rgba(245, 158, 11, 0.55)" }}
          >
            <span>⚡ SUPER OVER {superOver.round}</span>
            {(superOver.history || []).slice(-1).map((round) => (
              <div key={`active-super-over-${round.round}`}>
                <strong>
                  {round.first.teamName} {round.first.runs}/{round.first.wickets}
                  {" • "}
                  {round.second.teamName} {round.second.runs}/{round.second.wickets}
                </strong>
                <small>
                  {superOver.active
                    ? (superOver.currentSuperInnings === 2 && superOver.target
                        ? `Target ${superOver.target}`
                        : "Tie-breaker in progress")
                    : (superOver.resultText || "Super Over round complete")}
                </small>
              </div>
            ))}
          </div>
        ) : null}

        {superOver?.exists && !isMatchFinished ? (
          <SuperOverLiveDetails superOver={superOver} compact />
        ) : null}

        {(scoreboard?.match?.venueName ||
          scoreboard?.match?.venueAddress) ? (
          <div
            className="live-chase-card"
            style={{
              borderColor:
                "rgba(148, 163, 184, 0.25)",
              background:
                "rgba(15, 23, 42, 0.22)",
            }}
          >
            <span>
              📍 VENUE
            </span>

            <strong>
              {scoreboard?.match?.venueName ||
                scoreboard?.match?.venueAddress}
            </strong>

            {scoreboard?.match?.venueName &&
            scoreboard?.match?.venueAddress ? (
              <small>
                {scoreboard.match.venueAddress}
              </small>
            ) : null}
          </div>
        ) : null}

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

        <div className="live-key-metrics live-key-metrics-compact">
          <InfoPill
            label="CRR"
            value={rateTrend.crr}
            emphasis
          />

          <InfoPill
            label={
              liveDlsActive &&
              scoreboard?.currentInnings ===
                2
                ? "DLS Target"
                : "Target"
            }
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
          className="live-current-grid live-current-grid-compact"
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

        {!isMatchFinished ? (
          <LiveBroadcastIntelligence
            broadcast={scoreboard?.broadcast}
            currentInnings={scoreboard?.currentInnings}
            chaseRunsNeeded={chaseRunsNeeded}
            ballsLeft={ballsLeft}
            requiredRate={requiredRate}
            currentRate={rateTrend.crr}
          />
        ) : null}

        {recentBalls.length > 0 ? (
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
              {recentBalls.map((ball, index) => {
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
        ) : null}

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

    <SuperOverLiveDetails superOver={superOver} />

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
          {(isMatchFinished
            ? finalResultText
            : matchInsights?.resultText) ? (
            <div className="insight-result">
              <span>
                🏆 Match Result
              </span>

              <strong>
                {isMatchFinished
                  ? finalResultText
                  : matchInsights.resultText}
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
            <SuperOverLiveDetails superOver={superOver} />

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

                        <MobileBattingCards
                          rows={innings?.battingStats || []}
                        />

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

                        <MobileBowlingCards
                          rows={innings?.bowlingStats || []}
                        />

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

                        <MobilePartnershipCards
                          rows={innings?.partnerships || []}
                        />

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

                        <MobileWicketCards
                          rows={innings?.fallOfWickets || []}
                        />

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

      {!tvMode ? (
        <section
          className="spectator-growth-card"
          aria-label="Score your own cricket match with Cric4All"
        >
          <div className="spectator-growth-copy">
            <span className="spectator-growth-kicker">
              🏏 CRIC4ALL
            </span>

            <strong>
              {isMatchFinished
                ? "Want a scorecard like this for your team?"
                : "Enjoying the live score?"}
            </strong>

            <p>
              {isMatchFinished
                ? "Set up your own match and start ball-by-ball scoring in about a minute."
                : "Create your own match and share a live scorecard with your players and spectators."}
            </p>
          </div>

          <a
            href={spectatorScoreNowHref}
            className="spectator-growth-cta"
            onClick={openSpectatorScoreNow}
          >
            <span>
              Score Your Match Free
            </span>

            <b aria-hidden="true">
              →
            </b>
          </a>
        </section>
      ) : null}

      <style jsx>{`
        .spectator-growth-card {
          width: 100%;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin: 18px 0 4px;
          padding: 18px;
          border: 1px solid rgba(56, 189, 248, 0.24);
          border-radius: 18px;
          background:
            linear-gradient(
              135deg,
              rgba(14, 116, 144, 0.15),
              rgba(30, 64, 175, 0.13)
            );
          overflow: hidden;
        }

        .spectator-growth-copy {
          min-width: 0;
          flex: 1 1 auto;
        }

        .spectator-growth-kicker {
          display: block;
          margin-bottom: 5px;
          color: #7dd3fc;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }

        .spectator-growth-copy strong {
          display: block;
          color: #f8fafc;
          font-size: clamp(16px, 2vw, 20px);
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .spectator-growth-copy p {
          max-width: 680px;
          margin: 6px 0 0;
          color: #b8c7db;
          font-size: 13px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .spectator-growth-cta {
          flex: 0 0 auto;
          min-height: 46px;
          box-sizing: border-box;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 11px 16px;
          border: 1px solid rgba(125, 211, 252, 0.65);
          border-radius: 12px;
          background:
            linear-gradient(
              135deg,
              #2563eb,
              #22b8cf
            );
          color: #ffffff;
          font-size: 13px;
          font-weight: 900;
          line-height: 1.2;
          text-align: center;
          text-decoration: none;
          box-shadow:
            0 10px 24px rgba(2, 132, 199, 0.16);
          transition:
            transform 0.16s ease,
            filter 0.16s ease;
        }

        .spectator-growth-cta:hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }

        .spectator-growth-cta:focus-visible {
          outline: 3px solid rgba(125, 211, 252, 0.38);
          outline-offset: 3px;
        }

        .spectator-growth-cta b {
          font-size: 17px;
          line-height: 1;
        }

        @media (max-width: 680px) {
          .spectator-growth-card {
            align-items: stretch;
            flex-direction: column;
            gap: 13px;
            margin-top: 14px;
            padding: 14px;
            border-radius: 15px;
          }

          .spectator-growth-copy strong {
            font-size: 16px;
          }

          .spectator-growth-copy p {
            font-size: 12.5px;
            line-height: 1.45;
          }

          .spectator-growth-cta {
            width: 100%;
            min-height: 48px;
            padding: 12px 14px;
            white-space: normal;
          }
        }

        @media (max-width: 390px) {
          .spectator-growth-card {
            padding: 12px;
          }

          .spectator-growth-cta {
            font-size: 12.5px;
          }
        }
      `}</style>

      {error ? (
        <p className="live-inline-error">
          {error}
        </p>
      ) : null}
    </main>
  );
}