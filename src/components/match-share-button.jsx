"use client";

import { useState } from "react";

export default function MatchShareButton({
  leagueId,
  matchId,
  teamAName,
  teamBName,
  resultText,
  shareUrl,
  className = "",
}) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const teamA = String(teamAName || "Team A");
    const teamB = String(teamBName || "Team B");
    const result = String(resultText || "").trim();

    const text =
      result &&
      !["LIVE", "SCHEDULED", "MATCH COMPLETED"].includes(result.toUpperCase())
        ? `🏏 ${teamA} vs ${teamB}\n🏆 ${result}\n\nView the Cric4All scorecard:`
        : `🏏 ${teamA} vs ${teamB}\n\nView the Cric4All scorecard:`;

    fetch("/api/growth/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        eventType: "SHARE_SCORECARD",
        leagueId: Number(leagueId) || null,
        matchId: Number(matchId) || null,
        source: "PUBLIC_MATCH_CENTER",
        path: window.location.pathname,
      }),
    }).catch(() => {});

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${teamA} vs ${teamB} | Cric4All`,
          text,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleShare}
      aria-label={`Share ${teamAName || "match"} vs ${teamBName || "match"} result`}
    >
      {copied ? "✅ Link copied" : "📤 Share result"}
    </button>
  );
}
