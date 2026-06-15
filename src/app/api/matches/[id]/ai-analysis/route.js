import { NextResponse } from "next/server";
import OpenAI from "openai";
import prisma from "@/lib/prisma";
import {
  summarizeInningsDetailed,
  buildMatchStats
} from "@/lib/scoring";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const matchId = Number(id);

    if (!matchId || Number.isNaN(matchId)) {
      return NextResponse.json(
        { error: "Invalid match id" },
        { status: 400 }
      );
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        teamA: { include: { players: true } },
        teamB: { include: { players: true } },
        battingFirstTeam: true,
        balls: {
          orderBy: [
            { inningsNo: "asc" },
            { sequence: "asc" }
          ]
        }
      }
    });

    if (!match) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      );
    }

const status = String(match.status || "").toUpperCase();

    if (!["COMPLETED", "COMPLETED_LOCKED"].includes(status)) {
      return NextResponse.json(
        { error: "AI analysis is available only after match completion." },
        { status: 400 }
      );
    }

    if (match.aiAnalysis) {
  return NextResponse.json({
    analysis: match.aiAnalysis,
    cached: true
  });
}

const allPlayers = [
  ...(match.teamA?.players || []),
  ...(match.teamB?.players || [])
];

const playerMap = new Map(
  allPlayers.map((p) => [Number(p.id), p])
);

const innings1Balls = (match.balls || []).filter(
  (b) => Number(b.inningsNo) === 1
);

const innings2Balls = (match.balls || []).filter(
  (b) => Number(b.inningsNo) === 2
);

const innings1 = summarizeInningsDetailed(
  innings1Balls,
  playerMap,
  match.oversPerInnings
);

const innings2 = summarizeInningsDetailed(
  innings2Balls,
  playerMap,
  match.oversPerInnings
);
    const stats = buildMatchStats(match);

    const promptData = {
      match: {
        teamA: match.teamA?.name,
        teamB: match.teamB?.name,
        battingFirst: match.battingFirstTeam?.name,
        status: match.status,
        oversPerInnings: match.oversPerInnings
      },
      innings: [
        {
          innings: 1,
          team: innings1.teamName || innings1.battingTeamName,
          runs: innings1.runs,
          wickets: innings1.wickets,
          overs: innings1.oversDisplay,
          runRate: innings1.runRate,
          partnerships: innings1.partnerships,
          fallOfWickets: innings1.fallOfWickets
        },
        {
          innings: 2,
          team: innings2.teamName || innings2.battingTeamName,
          runs: innings2.runs,
          wickets: innings2.wickets,
          overs: innings2.oversDisplay,
          runRate: innings2.runRate,
          partnerships: innings2.partnerships,
          fallOfWickets: innings2.fallOfWickets
        }
      ],
      batting: stats.battingRows || stats.batting || [],
      bowling: stats.bowlingRows || stats.bowling || []
    };

    const response = await openai.responses.create({
      model: "gpt-5.4-mini",
      input: [
        {
          role: "system",
          content:
            "You are a professional cricket analyst. Write concise, insightful post-match analysis for an amateur cricket scoring app. Use cricket language but keep it easy to understand."
        },
        {
          role: "user",
          content: `Analyze this completed cricket match. Return markdown with these sections:
🏆 Match Summary
🔑 Turning Point
🏏 Best Batting Performances
🎯 Best Bowling Performances
🤝 Key Partnerships
💥 Pressure Moments
📊 Team Takeaways

Match data:
${JSON.stringify(promptData, null, 2)}`
        }
      ]
    });

const savedMatch = await prisma.match.update({
  where: { id: matchId },
  data: {
    aiAnalysis: response.output_text,
    aiAnalysisAt: new Date()
  }
});

return NextResponse.json({
  analysis: savedMatch.aiAnalysis,
  cached: false
});
  } catch (error) {
    console.error("AI analysis failed:", error);

    return NextResponse.json(
      { error: "Failed to generate AI analysis" },
      { status: 500 }
    );
  }
}