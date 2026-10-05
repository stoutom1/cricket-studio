"use client";

import { useEffect, useMemo, useState } from "react";
import "@/app/stream-overlay.css";

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
    return { text: "4", tone: "four" };
  }

  if (raw === "6") {
    return { text: "6", tone: "six" };
  }

  if (
    upper.includes("W") &&
    !upper.includes("WD")
  ) {
    return { text: "W", tone: "wicket" };
  }

  if (
    upper.includes("WD") ||
    upper.includes("NB") ||
    upper.includes("LB") ||
    upper === "B" ||
    upper.startsWith("B")
  ) {
    return { text: raw, tone: "extra" };
  }

  return { text: raw, tone: "normal" };
}

function formatPlayerStat(
  name,
  stats
) {
  if (!name) {
    return "—";
  }

  if (!stats) {
    return name;
  }

  return `${name} ${stats.runs ?? 0} (${stats.balls ?? 0})`;
}

function buildLatestInnings(scoreboard) {
  const innings =
    Array.isArray(scoreboard?.innings)
      ? scoreboard.innings
      : [];

  const current =
    Number(scoreboard?.currentInnings || 1);

  return (
    innings[current - 1] ||
    innings[innings.length - 1] ||
    null
  );
}

export default function StreamOverlayClient({
  matchId,
}) {
  const [scoreboard, setScoreboard] =
    useState(null);
  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function load() {
      try {
        const response = await fetch(
          `/api/liveview/${encodeURIComponent(
            matchId
          )}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load live score."
          );
        }

        const data =
          await response.json();

        if (cancelled) {
          return;
        }

        setScoreboard(data);
        setError("");
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError?.message ||
              "Unable to load live score."
          );
        }
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(
            load,
            3000
          );
        }
      }
    }

    load();

    return () => {
      cancelled = true;

      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [matchId]);

  const latestInnings =
    useMemo(
      () =>
        buildLatestInnings(
          scoreboard
        ),
      [scoreboard]
    );

  const currentState =
    scoreboard?.currentState || {};

  const recentBalls =
    Array.isArray(
      scoreboard?.recentBalls
    )
      ? scoreboard.recentBalls
      : [];

  const score =
    latestInnings
      ? `${latestInnings.runs}/${latestInnings.wickets}`
      : "—";

  const overs =
    latestInnings?.oversDisplay ||
    "0.0";

  const striker =
    formatPlayerStat(
      currentState.strikerName,
      currentState.strikerStats
    );

  const nonStriker =
    formatPlayerStat(
      currentState.nonStrikerName,
      currentState.nonStrikerStats
    );

  const bowlerStats =
    currentState.bowlerStats;

  const bowler =
    currentState.bowlerName
      ? `${currentState.bowlerName} ${
          bowlerStats?.wickets ?? 0
        }/${bowlerStats?.runs ?? 0} (${
          bowlerStats?.overs ?? "0.0"
        })`
      : "—";

  const dlsTarget =
    Number(
      scoreboard?.summary?.target || 0
    ) > 0
      ? ` · Target ${scoreboard.summary.target}`
      : "";

  const status =
    scoreboard?.match?.statusText ||
    "LIVE";

  return (
    <main className="stream-overlay-root">
      <div className="stream-overlay-scorebar">
        <div className="stream-overlay-brand">
          <span>🏏</span>
          <strong>CRIC4ALL</strong>
          <em>LIVE</em>
        </div>

        <div className="stream-overlay-teams">
          <span>
            {scoreboard?.match?.teamAName ||
              "Team A"}
          </span>

          <b>vs</b>

          <span>
            {scoreboard?.match?.teamBName ||
              "Team B"}
          </span>
        </div>

        <div className="stream-overlay-main-score">
          <strong>{score}</strong>
          <span>
            {overs} ov{dlsTarget}
          </span>
        </div>
      </div>

      <div className="stream-overlay-details">
        <article>
          <small>🏏 STRIKER</small>
          <strong>{striker}</strong>
        </article>

        <article>
          <small>🏃 NON-STRIKER</small>
          <strong>{nonStriker}</strong>
        </article>

        <article>
          <small>🎯 BOWLER</small>
          <strong>{bowler}</strong>
        </article>

        <div className="stream-overlay-balls">
          <small>LAST BALLS</small>

          <div>
            {recentBalls.length ? (
              [...recentBalls]
                .reverse()
                .slice(-8)
                .map((ball, index) => {
                  const item =
                    getBallDisplay(
                      ball.label
                    );

                  return (
                    <b
                      key={
                        ball.id ||
                        index
                      }
                      className={`is-${item.tone}`}
                    >
                      {item.text}
                    </b>
                  );
                })
            ) : (
              <span>Waiting</span>
            )}
          </div>
        </div>
      </div>

      <div className="stream-overlay-status">
        <span>
          {status}
        </span>

        <span>
          Cric4All Live Score
        </span>
      </div>

      {error ? (
        <div className="stream-overlay-error">
          {error}
        </div>
      ) : null}
    </main>
  );
}
