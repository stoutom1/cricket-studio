import { NextResponse } from "next/server";
import OpenAI from "openai";
import prisma from "@/lib/prisma";
import {
  summarizeInningsDetailed,
  buildMatchStats,
} from "@/lib/scoring";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const REVIEW_VERSION = 3;
const CACHE_PREFIX = "CRIC4ALL_AI_REVIEW_V3:";

function cleanStatus(value) {
  return String(value || "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(number(value) * factor) / factor;
}

function safeText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function getTeamForInnings(match, inningsNo) {
  const firstId = Number(match.battingFirstTeamId);
  const teamAId = Number(match.teamAId);

  if (inningsNo === 1) {
    return firstId === teamAId ? match.teamA : match.teamB;
  }

  return firstId === teamAId ? match.teamB : match.teamA;
}

function buildResultText(match, innings1, innings2) {
  const firstTeam =
    getTeamForInnings(match, 1)?.name ||
    "First innings team";

  const secondTeam =
    getTeamForInnings(match, 2)?.name ||
    "Second innings team";

  const firstRuns =
    number(innings1.runs);

  const secondRuns =
    number(innings2.runs);

  if (firstRuns === secondRuns) {
    return "Match tied";
  }

  if (secondRuns > firstRuns) {
    const maxWickets =
      Number(match.maxWicketsPerInnings);

    if (
      Number.isInteger(maxWickets) &&
      maxWickets > 0
    ) {
      const wicketsRemaining =
        Math.max(
          0,
          maxWickets -
            number(innings2.wickets)
        );

      return `${secondTeam} won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? "" : "s"}`;
    }

    return `${secondTeam} completed the chase`;
  }

  const margin =
    firstRuns - secondRuns;

  return `${firstTeam} won by ${margin} run${margin === 1 ? "" : "s"}`;
}

function buildOverSummaries(balls = []) {
  const map = new Map();

  for (const ball of balls) {
    const inningsNo = number(ball.inningsNo);
    const overNo = number(ball.overNo);
    const key = `${inningsNo}:${overNo}`;

    if (!map.has(key)) {
      map.set(key, {
        inningsNo,
        overNo,
        runs: 0,
        wickets: 0,
        legalBalls: 0,
        dots: 0,
        boundaries: 0,
      });
    }

    const row = map.get(key);
    row.runs += number(ball.totalRuns);
    row.wickets +=
      ball.isWicket &&
      !["RETIRED_HURT"].includes(cleanStatus(ball.wicketType))
        ? 1
        : 0;
    row.legalBalls += ball.legalDelivery ? 1 : 0;
    row.dots += ball.legalDelivery && number(ball.totalRuns) === 0 ? 1 : 0;
    row.boundaries += [4, 6].includes(number(ball.runsOffBat)) ? 1 : 0;
  }

  return Array.from(map.values()).sort(
    (a, b) => a.inningsNo - b.inningsNo || a.overNo - b.overNo
  );
}

function topRows(rows, comparator, limit = 4) {
  return [...(rows || [])]
    .filter(Boolean)
    .sort(comparator)
    .slice(0, limit);
}

function buildPlayerOfMatch(stats) {
  const batting = stats.battingRows || stats.batting || [];
  const bowling = stats.bowlingRows || stats.bowling || [];
  const candidates = new Map();

  function ensure(row) {
    const key = Number(row.playerId);
    if (!candidates.has(key)) {
      candidates.set(key, {
        playerId: key,
        playerName: row.playerName || "Unknown player",
        teamName: row.teamName || "",
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        wickets: 0,
        bowlingRuns: 0,
        bowlingBalls: 0,
        dots: 0,
      });
    }
    return candidates.get(key);
  }

  for (const row of batting) {
    const candidate = ensure(row);
    candidate.runs += number(row.runs);
    candidate.balls += number(row.balls);
    candidate.fours += number(row.fours);
    candidate.sixes += number(row.sixes);
  }

  for (const row of bowling) {
    const candidate = ensure(row);
    candidate.wickets += number(row.wickets);
    candidate.bowlingRuns += number(row.runs);
    candidate.bowlingBalls += number(row.balls);
    candidate.dots += number(row.dots);
  }

  const ranked = Array.from(candidates.values())
    .map((candidate) => {
      const strikeRate = candidate.balls
        ? (candidate.runs / candidate.balls) * 100
        : 0;
      const economy = candidate.bowlingBalls
        ? (candidate.bowlingRuns / candidate.bowlingBalls) * 6
        : 0;
      const score =
        candidate.runs +
        candidate.wickets * 24 +
        candidate.sixes * 2 +
        candidate.fours * 0.5 +
        candidate.dots * 0.35 +
        (candidate.runs >= 50 ? 10 : 0) +
        (candidate.wickets >= 3 ? 12 : 0) +
        (candidate.bowlingBalls >= 6 && economy > 0 && economy <= 5 ? 8 : 0) +
        (candidate.balls >= 10 && strikeRate >= 150 ? 6 : 0);

      return {
        ...candidate,
        strikeRate: round(strikeRate, 1),
        economy: round(economy, 2),
        impactScore: round(score, 1),
      };
    })
    .sort((a, b) => b.impactScore - a.impactScore);

  const winner = ranked[0] || null;
  const runnerUp = ranked[1] || null;
  const confidence = winner
    ? Math.max(
        55,
        Math.min(
          98,
          Math.round(
            64 +
              Math.max(0, winner.impactScore - number(runnerUp?.impactScore)) * 1.4
          )
        )
      )
    : 50;

  return { winner, runnerUp, confidence };
}

function buildTurningPointFacts(overSummaries, match) {
  const facts = [];

  for (const over of overSummaries) {
    const team = getTeamForInnings(match, over.inningsNo);
    const phase = over.overNo < 6 ? "powerplay" : "middle/death phase";

    if (over.wickets >= 2) {
      facts.push({
        score: over.wickets * 18 - over.runs,
        inningsNo: over.inningsNo,
        overLabel: `${over.overNo + 1}`,
        title: `${over.wickets}-wicket over`,
        detail: `${team?.name || "The batting side"} lost ${over.wickets} wickets for ${over.runs} runs in over ${over.overNo + 1}.`,
        metric: `${over.runs} runs · ${over.wickets} wickets`,
      });
    } else if (over.runs >= 15) {
      facts.push({
        score: over.runs,
        inningsNo: over.inningsNo,
        overLabel: `${over.overNo + 1}`,
        title: `Momentum over`,
        detail: `${team?.name || "The batting side"} scored ${over.runs} runs in over ${over.overNo + 1} during the ${phase}.`,
        metric: `${over.runs} runs`,
      });
    } else if (over.legalBalls >= 6 && over.runs <= 2) {
      facts.push({
        score: 8 - over.runs,
        inningsNo: over.inningsNo,
        overLabel: `${over.overNo + 1}`,
        title: `Pressure over`,
        detail: `Only ${over.runs} runs came from over ${over.overNo + 1}, increasing pressure on ${team?.name || "the batting side"}.`,
        metric: `${over.runs} runs · ${over.dots} dots`,
      });
    }
  }

  return facts.sort((a, b) => b.score - a.score).slice(0, 4);
}

function buildVerifiedContext(match, innings1, innings2, stats) {
  const batting = stats.battingRows || stats.batting || [];
  const bowling = stats.bowlingRows || stats.bowling || [];
  const overSummaries = buildOverSummaries(match.balls || []);
  const playerOfMatch = buildPlayerOfMatch(stats);

  const innings = [
    {
      inningsNo: 1,
      teamName: getTeamForInnings(match, 1)?.name || "First innings",
      runs: number(innings1.runs),
      wickets: number(innings1.wickets),
      overs: innings1.oversDisplay || "0.0",
      runRate: safeText(innings1.runRate, "0.00"),
      powerplayRuns: number(innings1.powerplay?.runs),
      powerplayWickets: number(innings1.powerplay?.wickets),
      partnerships: innings1.partnerships || [],
      fallOfWickets: innings1.fallOfWickets || [],
    },
    {
      inningsNo: 2,
      teamName: getTeamForInnings(match, 2)?.name || "Second innings",
      runs: number(innings2.runs),
      wickets: number(innings2.wickets),
      overs: innings2.oversDisplay || "0.0",
      runRate: safeText(innings2.runRate, "0.00"),
      powerplayRuns: number(innings2.powerplay?.runs),
      powerplayWickets: number(innings2.powerplay?.wickets),
      partnerships: innings2.partnerships || [],
      fallOfWickets: innings2.fallOfWickets || [],
    },
  ];

  const topBatting = topRows(
    batting,
    (a, b) => number(b.runs) - number(a.runs) || number(a.balls) - number(b.balls),
    5
  ).map((row) => ({
    playerName: row.playerName || "Unknown player",
    teamName: row.teamName || "",
    runs: number(row.runs),
    balls: number(row.balls),
    fours: number(row.fours),
    sixes: number(row.sixes),
    strikeRate: number(row.balls)
      ? round((number(row.runs) / number(row.balls)) * 100, 1)
      : 0,
    dismissal: row.dismissal || "",
  }));

  const topBowling = topRows(
    bowling,
    (a, b) =>
      number(b.wickets) - number(a.wickets) ||
      number(a.runs) - number(b.runs) ||
      number(b.dots) - number(a.dots),
    5
  ).map((row) => ({
    playerName: row.playerName || "Unknown player",
    teamName: row.teamName || "",
    wickets: number(row.wickets),
    runs: number(row.runs),
    balls: number(row.balls),
    overs: row.overs || `${Math.floor(number(row.balls) / 6)}.${number(row.balls) % 6}`,
    economy: number(row.balls)
      ? round((number(row.runs) / number(row.balls)) * 6, 2)
      : 0,
    dots: number(row.dots),
  }));

  const bestPartnerships = innings
    .flatMap((item) =>
      (item.partnerships || []).map((partnership) => ({
        inningsNo: item.inningsNo,
        teamName: item.teamName,
        runs: number(partnership.runs),
        balls: number(partnership.balls),
        batter1: partnership.batter1 || "",
        batter2: partnership.batter2 || "",
      }))
    )
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 4);

  return {
    match: {
      id: match.id,
      leagueName: match.league?.name || "",
      teamA: match.teamA?.name || "Team A",
      teamB: match.teamB?.name || "Team B",
      battingFirst: match.battingFirstTeam?.name || "",
      status: match.status,
      /*
       * IMPORTANT: completed-match statusText is authoritative.
       * It already contains any revised DLS result produced by the scoring
       * engine. Never re-decide a completed DLS winner from the raw innings
       * totals because the second innings may have chased a revised target.
       */
      resultText:
        safeText(match.statusText) ||
        buildResultText(
          match,
          innings1,
          innings2
        ),
      dls: {
        active: /\b(?:DLS|D\/L Standard)\b/i.test(
          safeText(match.statusText)
        ),
        method: /D\/L Standard/i.test(safeText(match.statusText))
          ? "D/L Standard"
          : /\bDLS\b/i.test(safeText(match.statusText))
            ? "Official DLS"
            : "",
      },
      oversPerInnings: number(match.oversPerInnings),
      startedAt: match.startedAt,
      endedAt: match.endedAt,
    },
    innings,
    topBatting,
    topBowling,
    bestPartnerships,
    overSummaries,
    turningPointFacts: buildTurningPointFacts(overSummaries, match),
    playerOfMatch,
  };
}

function fallbackReview(context) {
  const [first, second] = context.innings;
  const potm = context.playerOfMatch.winner;
  const bestBat = context.topBatting[0];
  const bestBowl = context.topBowling[0];
  const result = safeText(context.match.resultText, `${first.teamName} ${first.runs}/${first.wickets}; ${second.teamName} ${second.runs}/${second.wickets}.`);

  return {
    version: REVIEW_VERSION,
    generatedAt: new Date().toISOString(),
    match: context.match,
    scoreSummary: context.innings,
    executiveSummary: {
      headline: result,
      summary: `${first.teamName} made ${first.runs}/${first.wickets} in ${first.overs} overs before ${second.teamName} replied with ${second.runs}/${second.wickets} in ${second.overs} overs.`,
      result,
    },
    playerOfTheMatch: {
      playerName: potm?.playerName || bestBat?.playerName || bestBowl?.playerName || "Not available",
      teamName: potm?.teamName || "",
      confidence: context.playerOfMatch.confidence,
      reason: potm
        ? `${potm.runs} runs and ${potm.wickets} wickets produced the strongest verified impact score in the match.`
        : "Insufficient player data for a confident recommendation.",
      statLines: potm
        ? [
            potm.runs ? `${potm.runs} runs` : "",
            potm.wickets ? `${potm.wickets} wickets` : "",
            potm.balls ? `SR ${potm.strikeRate}` : "",
            potm.bowlingBalls ? `Econ ${potm.economy}` : "",
          ].filter(Boolean)
        : [],
    },
    turningPoints: context.turningPointFacts.map((fact) => ({
      over: `Over ${fact.overLabel}`,
      title: fact.title,
      detail: fact.detail,
      impact: fact.metric,
    })),
    battingInsights: context.topBatting.slice(0, 3).map((row) => ({
      title: row.playerName,
      detail: `${row.runs} from ${row.balls} balls with ${row.fours} fours and ${row.sixes} sixes.`,
      metric: `${row.runs} (${row.balls}) · SR ${row.strikeRate}`,
    })),
    bowlingInsights: context.topBowling.slice(0, 3).map((row) => ({
      title: row.playerName,
      detail: `${row.wickets} wickets for ${row.runs} runs from ${row.overs} overs, including ${row.dots} dot balls.`,
      metric: `${row.wickets}/${row.runs} · Econ ${row.economy}`,
    })),
    recordsAndMilestones: [
      bestBat ? `${bestBat.playerName} made the match's highest score: ${bestBat.runs}.` : "",
      bestBowl ? `${bestBowl.playerName} produced the match's best figures: ${bestBowl.wickets}/${bestBowl.runs}.` : "",
      context.bestPartnerships[0]
        ? `${context.bestPartnerships[0].batter1} and ${context.bestPartnerships[0].batter2} added the match's best partnership of ${context.bestPartnerships[0].runs}.`
        : "",
    ].filter(Boolean),
    teamTakeaways: [
      {
        teamName: first.teamName,
        takeaway: `Scored at ${first.runRate} runs per over and reached ${first.runs}/${first.wickets}.`,
      },
      {
        teamName: second.teamName,
        takeaway: `Scored at ${second.runRate} runs per over and reached ${second.runs}/${second.wickets}.`,
      },
    ],
    matchStory: `${first.teamName} posted ${first.runs}/${first.wickets} before ${second.teamName} responded with ${second.runs}/${second.wickets}. ${result}`,
    shareContent: {
      whatsapp: `🏏 ${context.match.teamA} vs ${context.match.teamB}\n🏆 ${result}${potm ? `\n⭐ Player of the Match: ${potm.playerName}` : ""}\n\nPowered by Cric4All`,
      social: `${result}${potm ? ` ⭐ ${potm.playerName}` : ""} #Cric4All #Cricket`,
    },
  };
}

const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "executiveSummary",
    "playerOfTheMatch",
    "turningPoints",
    "battingInsights",
    "bowlingInsights",
    "recordsAndMilestones",
    "teamTakeaways",
    "matchStory",
    "shareContent",
  ],
  properties: {
    executiveSummary: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "summary", "result"],
      properties: {
        headline: { type: "string" },
        summary: { type: "string" },
        result: { type: "string" },
      },
    },
    playerOfTheMatch: {
      type: "object",
      additionalProperties: false,
      required: ["playerName", "teamName", "confidence", "reason", "statLines"],
      properties: {
        playerName: { type: "string" },
        teamName: { type: "string" },
        confidence: { type: "integer" },
        reason: { type: "string" },
        statLines: { type: "array", items: { type: "string" } },
      },
    },
    turningPoints: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["over", "title", "detail", "impact"],
        properties: {
          over: { type: "string" },
          title: { type: "string" },
          detail: { type: "string" },
          impact: { type: "string" },
        },
      },
    },
    battingInsights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "metric"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          metric: { type: "string" },
        },
      },
    },
    bowlingInsights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "metric"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          metric: { type: "string" },
        },
      },
    },
    recordsAndMilestones: {
      type: "array",
      items: { type: "string" },
    },
    teamTakeaways: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["teamName", "takeaway"],
        properties: {
          teamName: { type: "string" },
          takeaway: { type: "string" },
        },
      },
    },
    matchStory: { type: "string" },
    shareContent: {
      type: "object",
      additionalProperties: false,
      required: ["whatsapp", "social"],
      properties: {
        whatsapp: { type: "string" },
        social: { type: "string" },
      },
    },
  },
};

function normalizeGeneratedReview(generated, fallback, context) {
  const potm = context.playerOfMatch.winner;

  return {
    ...fallback,
    ...generated,
    version: REVIEW_VERSION,
    generatedAt: new Date().toISOString(),
    match: context.match,
    scoreSummary: context.innings,
    executiveSummary: {
      ...fallback.executiveSummary,
      ...(generated?.executiveSummary || {}),
      // The scoring engine, not the language model, owns the final result.
      headline: context.match.resultText,
      result: context.match.resultText,
    },
    playerOfTheMatch: {
      ...fallback.playerOfTheMatch,
      ...(generated?.playerOfTheMatch || {}),
      playerName: potm?.playerName || fallback.playerOfTheMatch.playerName,
      teamName: potm?.teamName || fallback.playerOfTheMatch.teamName,
      confidence: context.playerOfMatch.confidence,
      statLines: fallback.playerOfTheMatch.statLines,
    },
    turningPoints:
      Array.isArray(generated?.turningPoints) && generated.turningPoints.length
        ? generated.turningPoints.slice(0, 4)
        : fallback.turningPoints,
    battingInsights:
      Array.isArray(generated?.battingInsights) && generated.battingInsights.length
        ? generated.battingInsights.slice(0, 4)
        : fallback.battingInsights,
    bowlingInsights:
      Array.isArray(generated?.bowlingInsights) && generated.bowlingInsights.length
        ? generated.bowlingInsights.slice(0, 4)
        : fallback.bowlingInsights,
    recordsAndMilestones: Array.isArray(generated?.recordsAndMilestones)
      ? generated.recordsAndMilestones.slice(0, 5)
      : fallback.recordsAndMilestones,
    teamTakeaways:
      Array.isArray(generated?.teamTakeaways) && generated.teamTakeaways.length
        ? generated.teamTakeaways.slice(0, 2)
        : fallback.teamTakeaways,
    shareContent: {
      ...fallback.shareContent,
      ...(generated?.shareContent || {}),
    },
  };
}

function parseCachedReview(value) {
  if (
    !value ||
    !String(value).startsWith(
      CACHE_PREFIX
    )
  ) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(
        String(value).slice(
          CACHE_PREFIX.length
        )
      );

    if (
      !parsed ||
      typeof parsed !==
        "object"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function cacheMatchesCurrentMatch({
  cachedReview,
  match,
}) {
  if (!cachedReview) {
    return false;
  }

  const cachedVersion =
    Number(
      cachedReview
        ?.cacheMetadata
        ?.reviewVersion
    );

  const cachedMatchUpdatedAt =
    String(
      cachedReview
        ?.cacheMetadata
        ?.matchUpdatedAt ||
      ""
    );

  const currentMatchUpdatedAt =
    match.updatedAt instanceof
      Date
      ? match.updatedAt
          .toISOString()
      : String(
          match.updatedAt ||
          ""
        );

  return (
    cachedVersion ===
      REVIEW_VERSION &&
    cachedMatchUpdatedAt ===
      currentMatchUpdatedAt
  );
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const matchId = Number(id);
    const refresh = new URL(request.url).searchParams.get("refresh") === "1";

    if (!Number.isInteger(matchId) || matchId <= 0) {
      return NextResponse.json({ error: "Invalid match id" }, { status: 400 });
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        league: { select: { id: true, name: true } },
        teamA: {
          include: {
            players: { include: { team: true } },
          },
        },
        teamB: {
          include: {
            players: { include: { team: true } },
          },
        },
        battingFirstTeam: true,
        balls: {
          orderBy: [{ inningsNo: "asc" }, { sequence: "asc" }],
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const status = cleanStatus(match.status);
    if (!["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED"].includes(status)) {
      return NextResponse.json(
        { error: "AI analysis is available only after match completion." },
        { status: 400 }
      );
    }

    const cachedReview =
      parseCachedReview(
        match.aiAnalysis
      );

    const cacheIsCurrent =
      cacheMatchesCurrentMatch({
        cachedReview,
        match,
      });

    /*
     * Normal AI Review clicks return the database copy immediately.
     * OpenAI is called only when:
     * - no V2 review exists;
     * - the match changed after the review was generated; or
     * - refresh=1 is explicitly requested.
     */
    if (
      cacheIsCurrent &&
      !refresh
    ) {
      return NextResponse.json({
        analysis:
          cachedReview
            .executiveSummary
            ?.summary ||
          "",

        review:
          cachedReview,

        cached:
          true,

        generatedAt:
          cachedReview
            ?.cacheMetadata
            ?.generatedAt ||
          match.aiAnalysisAt ||
          null,

        version:
          REVIEW_VERSION,
      });
    }

    const allPlayers = [
      ...(match.teamA?.players || []),
      ...(match.teamB?.players || []),
    ];
    const playerMap = new Map(allPlayers.map((player) => [Number(player.id), player]));
    const innings1Balls = (match.balls || []).filter((ball) => Number(ball.inningsNo) === 1);
    const innings2Balls = (match.balls || []).filter((ball) => Number(ball.inningsNo) === 2);
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
    const context = buildVerifiedContext(match, innings1, innings2, stats);
    const fallback = fallbackReview(context);

    let generated = null;

    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await openai.responses.create({
          model: process.env.OPENAI_MATCH_REVIEW_MODEL || "gpt-5-mini",
          store: false,
          text: {
            format: {
              type: "json_schema",
              name: "cric4all_match_review",
              description: "A compact, structured post-match cricket review grounded only in supplied verified match data.",
              strict: true,
              schema: REVIEW_SCHEMA,
            },
          },
          input: [
            {
              role: "system",
              content:
                "You are Cric4All's post-match cricket analyst. Use only the verified data supplied. Never invent a player, score, wicket, over, record, milestone, percentage, or event. The supplied match.resultText is the authoritative final result from Cric4All and MUST be treated as fact; never recalculate the winner from raw innings totals. If match.dls.active is true, explicitly describe the match as decided under the supplied DLS method and do not compare the chase against the original first-innings target. Keep every field concise, useful, and suitable for a compact mobile dashboard. Records and milestones must refer only to this match unless league-history data is explicitly supplied. Player of the Match identity and verified stat lines are enforced by the server; explain the recommendation without changing the player.",
            },
            {
              role: "user",
              content: `Create a structured Match Intelligence review from this verified data.\n\n${JSON.stringify(context, null, 2)}`,
            },
          ],
        });

        generated = JSON.parse(response.output_text);
      } catch (aiError) {
        console.error("Structured AI review generation failed; using verified fallback:", aiError);
      }
    }

    const generatedAt =
      new Date();

    const review = {
      ...normalizeGeneratedReview(
        generated,
        fallback,
        context
      ),

      cacheMetadata: {
        reviewVersion:
          REVIEW_VERSION,

        generatedAt:
          generatedAt
            .toISOString(),

        matchUpdatedAt:
          match.updatedAt instanceof
            Date
            ? match.updatedAt
                .toISOString()
            : String(
                match.updatedAt ||
                ""
              ),

        generationSource:
          generated
            ? "OPENAI"
            : "VERIFIED_FALLBACK",
      },
    };

    const serialized =
      `${CACHE_PREFIX}${JSON.stringify(
        review
      )}`;

    await prisma.match.update({
      where: {
        id:
          matchId,
      },

      data: {
        aiAnalysis:
          serialized,

        aiAnalysisAt:
          generatedAt,
      },
    });

    return NextResponse.json({
      analysis:
        review.executiveSummary
          .summary,

      review,

      cached:
        false,

      generatedAt:
        generatedAt
          .toISOString(),

      version:
        REVIEW_VERSION,
    });
  } catch (error) {
    console.error("AI analysis failed:", error);
    return NextResponse.json(
      { error: "Failed to generate AI match intelligence." },
      { status: 500 }
    );
  }
}
