import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  calculateStandardInterruption,
  calculateTermination,
  currentAllocation,
  inningsSnapshot,
  latestDlsState,
  resourceAvailableForInnings,
} from "@/lib/dls-standard";

export const runtime = "nodejs";

function validId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function loadMatch(matchId) {
  return prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: true,
      teamB: true,
      battingFirstTeam: true,
      balls: {
        orderBy: [
          { inningsNo: "asc" },
          { sequence: "asc" },
          { id: "asc" },
        ],
      },
      events: {
        orderBy: { id: "asc" },
      },
    },
  });
}

function teamNames(match) {
  const first =
    match.battingFirstTeamId === match.teamAId
      ? match.teamA
      : match.teamB;

  const second =
    first?.id === match.teamAId
      ? match.teamB
      : match.teamA;

  return {
    first: first?.name || "Team 1",
    second: second?.name || "Team 2",
  };
}

function publicState(match) {
  const latest = latestDlsState(match);
  const first = inningsSnapshot(match, 1);
  const second = inningsSnapshot(match, 2);

  return {
    active: Boolean(latest),
    latest,
    originalOvers: Number(match.oversPerInnings || 0),
    innings1: first,
    innings2: second,
    innings1Allocation: currentAllocation(match, 1),
    innings2Allocation: currentAllocation(match, 2),
    r1: resourceAvailableForInnings(match, 1),
    r2: resourceAvailableForInnings(match, 2),
    teams: teamNames(match),
  };
}

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const matchId = validId(id);

  if (!matchId) {
    return NextResponse.json({ error: "Invalid match id" }, { status: 400 });
  }

  const match = await loadMatch(matchId);

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json(publicState(match));
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const matchId = validId(id);

  if (!matchId) {
    return NextResponse.json({ error: "Invalid match id" }, { status: 400 });
  }

  const body = await request.json();
  const action = String(body?.action || "STANDARD_INTERRUPTION").toUpperCase();
  const match = await loadMatch(matchId);

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const status = String(match.status || "").toUpperCase();
  if (["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED", "ABANDONED"].includes(status)) {
    return NextResponse.json(
      { error: "DLS cannot be changed after this match is completed/abandoned." },
      { status: 409 }
    );
  }

  let payload;
  let eventType;
  let inningsNo = Number(body?.inningsNo || 2);

  if (action === "OFFICIAL_OVERRIDE") {
    const target = Number(body?.target);
    const revisedOvers = Number(body?.revisedOvers);
    const par = body?.par === "" || body?.par == null
      ? target - 1
      : Number(body.par);

    if (!Number.isInteger(target) || target <= 0) {
      return NextResponse.json(
        { error: "Enter a valid official DLS target." },
        { status: 400 }
      );
    }

    if (!(revisedOvers > 0 && revisedOvers <= Number(match.oversPerInnings))) {
      return NextResponse.json(
        { error: "Enter a valid revised over allocation." },
        { status: 400 }
      );
    }

    payload = {
      mode: "OFFICIAL_OVERRIDE",
      inningsNo,
      revisedOvers,
      target,
      par,
      source: "OFFICIAL_DLS_CALCULATOR",
      note: String(body?.note || "").trim(),
    };
    eventType = "DLS_OFFICIAL_OVERRIDE";
  } else if (action === "TERMINATE") {
    const latest = latestDlsState(match);

    if (latest?.mode === "OFFICIAL_OVERRIDE" && Number(latest.par) >= 0) {
      const second = inningsSnapshot(match, 2);
      const par = Number(latest.par);
      const score = second.runs;
      const names = teamNames(match);

      let resultText;
      if (score > par) {
        resultText = `${names.second} won by ${score - par} runs (DLS)`;
      } else if (score === par) {
        resultText = "Match tied (DLS)";
      } else {
        resultText = `${names.first} won by ${par - score} runs (DLS)`;
      }

      const difference = score - par;

      payload = {
        ...latest,
        mode: "OFFICIAL_OVERRIDE",
        methodLabel: "Official DLS",
        inningsNo: 2,
        terminated: true,

        /*
         * Persist the evidence used for the DLS decision. This is deliberately
         * stored in MatchEvent so Match History can explain the result later
         * without trying to reconstruct it from the final raw innings totals.
         */
        score,
        scoreAtTermination: score,
        wicketsAtTermination: second.wickets,
        legalBallsAtTermination: second.legalBalls,
        oversAtTermination:
          `${Math.floor(second.legalBalls / 6)}.${second.legalBalls % 6}`,
        par,
        parScore: par,
        target: par + 1,
        difference,
        decision:
          difference > 0
            ? "SECOND_TEAM_AHEAD_OF_PAR"
            : difference < 0
              ? "FIRST_TEAM_AHEAD_OF_PAR"
              : "TIED_ON_PAR",
        resultText,
      };
    } else {
      const calc = calculateTermination({ match });
      const names = teamNames(match);

      let resultText;
      if (calc.score > calc.par) {
        resultText = `${names.second} won by ${calc.score - calc.par} runs (D/L Standard)`;
      } else if (calc.score === calc.par) {
        resultText = "Match tied (D/L Standard)";
      } else {
        resultText = `${names.first} won by ${calc.par - calc.score} runs (D/L Standard)`;
      }

      const difference =
        Number(calc.score) - Number(calc.par);

      payload = {
        ...calc,
        mode: "STANDARD",
        methodLabel: "D/L Standard",
        inningsNo: 2,
        terminated: true,
        scoreAtTermination: calc.score,
        wicketsAtTermination: calc.wickets,
        legalBallsAtTermination: calc.legalBalls,
        oversAtTermination:
          `${Math.floor(Number(calc.legalBalls || 0) / 6)}.${Number(calc.legalBalls || 0) % 6}`,
        parScore: calc.par,
        difference,
        decision:
          difference > 0
            ? "SECOND_TEAM_AHEAD_OF_PAR"
            : difference < 0
              ? "FIRST_TEAM_AHEAD_OF_PAR"
              : "TIED_ON_PAR",
        resultText,
      };
    }

    eventType = "DLS_RESULT";
  } else {
    payload = calculateStandardInterruption({
      match,
      inningsNo,
      revisedOvers: Number(body?.revisedOvers),
    });
    eventType = "DLS_INTERRUPTION";
  }

  await prisma.matchEvent.create({
    data: {
      matchId,
      inningsNo,
      eventType,
      note: JSON.stringify(payload),
    },
  });

  const refreshed = await loadMatch(matchId);

  return NextResponse.json({
    success: true,
    event: payload,
    state: publicState(refreshed),
  });
}
