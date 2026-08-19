import { ImageResponse } from "next/og";
import prisma from "@/lib/prisma";
import {
  buildPublicMatchResult,
  summarizePublicInnings,
} from "@/lib/public-match-result";

export const alt = "Cric4All cricket match result";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }) {
  const { slug, matchId } = await params;
  const id = Number(matchId);

  const league = await prisma.league.findFirst({
    where: {
      slug,
      visibility: { in: ["PUBLIC", "UNLISTED"] },
    },
    select: {
      name: true,
      matches: {
        where: { id },
        take: 1,
        select: {
          status: true,
          statusText: true,
          battingFirstTeamId: true,
          maxWicketsPerInnings: true,
          teamAId: true,
          teamBId: true,
          venueName: true,
          venueAddress: true,
          teamA: { select: { name: true } },
          teamB: { select: { name: true } },
          balls: {
            select: {
              inningsNo: true,
              totalRuns: true,
              isWicket: true,
              wicketType: true,
              legalDelivery: true,
            },
          },
        },
      },
    },
  });

  const match = league?.matches?.[0];

  if (!match) {
    return new ImageResponse(
      <div style={{
        width: "100%", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "#07111f", color: "white",
        fontSize: 56, fontWeight: 800,
      }}>
        🏏 Cric4All
      </div>,
      size
    );
  }

  const first =
    summarizePublicInnings(
      match.balls,
      1
    );

  const second =
    summarizePublicInnings(
      match.balls,
      2
    );

  const result =
    buildPublicMatchResult(
      match
    );
  const venue = String(match.venueName || match.venueAddress || "").trim();

  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", display: "flex",
      flexDirection: "column", padding: "52px 60px",
      background: "linear-gradient(135deg,#07111f 0%,#0b1930 58%,#0b3a4b 100%)",
      color: "white", fontFamily: "Arial, sans-serif",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>
          🏏 Cric4All
        </div>
        <div style={{
          display: "flex", padding: "9px 16px",
          border: "1px solid rgba(255,255,255,.22)",
          borderRadius: 999, fontSize: 20,
        }}>
          {league.name}
        </div>
      </div>

      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 30, marginTop: 70,
      }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 24, color: "#93c5fd" }}>
            {match.teamA?.name || "Team A"}
          </div>
          <div style={{ fontSize: 72, fontWeight: 900, marginTop: 10 }}>
            {`${first.runs}/${first.wickets}`}
          </div>
          <div style={{ fontSize: 21, color: "#cbd5e1" }}>
            {`${first.overs} overs`}
          </div>
        </div>

        <div style={{
          display: "flex", width: 86, height: 86,
          alignItems: "center", justifyContent: "center",
          borderRadius: 999, border: "2px solid rgba(255,255,255,.18)",
          color: "#7dd3fc", fontSize: 24, fontWeight: 900,
        }}>
          VS
        </div>

        <div style={{
          display: "flex", flexDirection: "column", flex: 1, alignItems: "flex-end",
        }}>
          <div style={{ fontSize: 24, color: "#93c5fd", textAlign: "right" }}>
            {match.teamB?.name || "Team B"}
          </div>
          <div style={{ fontSize: 72, fontWeight: 900, marginTop: 10 }}>
            {`${second.runs}/${second.wickets}`}
          </div>
          <div style={{ fontSize: 21, color: "#cbd5e1" }}>
            {`${second.overs} overs`}
          </div>
        </div>
      </div>

      <div style={{
        display: "flex", marginTop: 46, padding: "18px 22px",
        borderRadius: 18, background: "rgba(5,150,105,.16)",
        border: "1px solid rgba(52,211,153,.28)",
        fontSize: 28, fontWeight: 800,
      }}>
        {`🏆 ${result}`}
      </div>

      <div style={{
        marginTop: "auto", display: "flex",
        justifyContent: "space-between", color: "#94a3b8", fontSize: 19,
      }}>
        <div style={{ display: "flex" }}>
          {venue ? `📍 ${venue}` : "Cricket scorecard"}
        </div>
        <div style={{ display: "flex", color: "#7dd3fc", fontWeight: 800 }}>
          cric4all.app
        </div>
      </div>
    </div>,
    size
  );
}
