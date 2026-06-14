import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superAdmin";
export const runtime = "nodejs";
import crypto from "crypto";

/*function formatOvers(legalBalls) {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}*/
export function formatOversFromBalls(legalBalls) {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

function countsAsWicket(ball) {
  return (
    ball.isWicket &&
    ball.wicketType !== "RETIRED_HURT"
  );
}


function formatOversFromLegalBalls(legalBalls) {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

function getInningsSummary(match, inningsNo) {
  const balls = match.balls.filter(
    (b) => Number(b.inningsNo) === Number(inningsNo)
  );

  const runs = balls.reduce(
    (sum, b) => sum + Number(b.totalRuns || 0),
    0
  );

  const wickets = balls.reduce(
    (sum, b) =>
      sum +
      (b.isWicket && b.wicketType !== "RETIRED_HURT" ? 1 : 0),
    0
  );

  const legalBalls = balls.filter((b) => b.legalDelivery).length;

  return {
    runs,
    wickets,
    legalBalls,
    overs: formatOversFromLegalBalls(legalBalls)
  };
}

function buildResultText(match, innings1, innings2) {
  if (match.status === "ABANDONED") {
    return match.statusText || "Match abandoned";
  }

  const firstTeamName =
    match.battingFirstTeamId === match.teamAId
      ? match.teamA.name
      : match.teamB.name;

  const secondTeamName =
    match.battingFirstTeamId === match.teamAId
      ? match.teamB.name
      : match.teamA.name;

  if (innings1.runs > innings2.runs) {
    return `${firstTeamName} won by ${innings1.runs - innings2.runs} runs`;
  }

  if (innings2.runs > innings1.runs) {
    const maxWickets = match.maxWicketsPerInnings || 10;
    return `${secondTeamName} won by ${maxWickets - innings2.wickets} wickets`;
  }

  if (innings1.legalBalls > 0 && innings2.legalBalls > 0) {
    return "Match tied";
  }

  return match.statusText || match.status;
}

export async function GET(request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);

  const requestedLeagueId = Number(
    searchParams.get("leagueId")
  );

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  const superAdmin = isSuperAdmin(session);

  const leagueId =
    !Number.isNaN(requestedLeagueId) &&
    requestedLeagueId > 0
      ? requestedLeagueId
      : user.activeLeagueId;

  if (!leagueId) {
    return NextResponse.json([]);
  }

  const where = {
    leagueId,
  };

  if (!superAdmin) {
    where.league = {
      members: {
        some: {
          userId: user.id,
        },
      },
    };
  }

  const matches = await prisma.match.findMany({
    where,
    include: {
      league: true,
      teamA: true,
      teamB: true,
      battingFirstTeam: true,
      balls: {
        orderBy: [
          { inningsNo: "asc" },
          { sequence: "asc" },
        ],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  for (const match of matches) {
    const innings1 = getInningsSummary(match, 1);
    const innings2 = getInningsSummary(match, 2);

    const target = innings1.runs + 1;

    const innings2Completed =
      innings2.runs >= target ||
      innings2.legalBalls >= match.oversPerInnings * 6;

    const shouldComplete =
      innings1.legalBalls > 0 &&
      innings2Completed;

    if (
      match.status !== "COMPLETED_LOCKED" &&
      match.status !== "ABANDONED" &&
      shouldComplete &&
      match.status !== "COMPLETED"
    ) {
      await prisma.match.update({
        where: { id: match.id },
        data: {
          status: "COMPLETED",
        },
      });

      match.status = "COMPLETED";
    }
  }

  const formatted = matches.map((m) => {
    const innings1 = getInningsSummary(m, 1);
    const innings2 = getInningsSummary(m, 2);

    const firstInningsTeamName =
      m.battingFirstTeamId === m.teamAId
        ? m.teamA.name
        : m.battingFirstTeamId === m.teamBId
          ? m.teamB.name
          : "Not decided yet";

    const secondInningsTeamName =
      m.battingFirstTeamId === m.teamAId
        ? m.teamB.name
        : m.battingFirstTeamId === m.teamBId
          ? m.teamA.name
          : "Not decided yet";

    const resultText = buildResultText(m, innings1, innings2);

    const firstInningsScore =
      `${firstInningsTeamName}: ${innings1.runs}/${innings1.wickets} (${innings1.overs})`;

    const secondInningsScore =
      innings2.legalBalls > 0 || innings2.runs > 0 || innings2.wickets > 0
        ? `${secondInningsTeamName}: ${innings2.runs}/${innings2.wickets} (${innings2.overs})`
        : `${secondInningsTeamName}: Yet to bat`;

    return {
      id: m.id,
      leagueId: m.leagueId,
      leagueName: m.league?.name,

      teamAId: m.teamAId,
      teamBId: m.teamBId,
      teamAName: m.teamA.name,
      teamBName: m.teamB.name,

      battingFirstTeamId: m.battingFirstTeamId,
      battingFirstTeamName:
        m.battingFirstTeam?.name || "Not decided yet",

      oversPerInnings: m.oversPerInnings,
      powerplayOversInnings: m.powerplayOversInnings,
      maxWicketsPerInnings: m.maxWicketsPerInnings,
      maxOversPerBowler: m.maxOversPerBowler,

      status: m.status,
      statusText: m.statusText,
      createdAt: m.createdAt,
      scheduledAt: m.scheduledAt,

      firstInningsTeamName,
      firstInningsRuns: innings1.runs,
      firstInningsWickets: innings1.wickets,
      firstInningsOvers: innings1.overs,

      secondInningsTeamName,
      secondInningsRuns: innings2.runs,
      secondInningsWickets: innings2.wickets,
      secondInningsOvers: innings2.overs,

      firstInningsScore,
      secondInningsScore,

      scoreSummary: `${firstInningsScore} • ${secondInningsScore}`,
      finalScore: `${firstInningsScore} • ${secondInningsScore}`,
      resultText,
    };
  });

  return NextResponse.json(formatted);
}

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email
    }
  });

const activeLeagueId = user?.activeLeagueId;

  const body = await request.json();

  const teamAId = Number(body.teamAId);
  const teamBId = Number(body.teamBId);
  const battingFirstTeamId = Number(body.battingFirstTeamId);
  const oversPerInnings = Number(body.oversPerInnings);
  const powerplayOversInnings = Number(body.powerplayOversInnings || 0);
  const scheduledAt = body.scheduledAt || null;

  if (!teamAId || !teamBId) {
    return NextResponse.json({ error: "Teams and batting first team are required" }, { status: 400 });
  }

  if (teamAId === teamBId) {
    return NextResponse.json({ error: "Teams must be different" }, { status: 400 });
  }
/*
  if (![teamAId, teamBId].includes(battingFirstTeamId)) {
    return NextResponse.json(
      { error: "Batting first team must be Team A or Team B" },
      { status: 400 }
    );
  }
*/
  if (!Number.isInteger(oversPerInnings) || oversPerInnings < 1) {
    return NextResponse.json({ error: "Overs per innings must be at least 1" }, { status: 400 });
  }

  if (!Number.isInteger(powerplayOversInnings) || powerplayOversInnings < 0) {
    return NextResponse.json({ error: "Powerplay overs cannot be negative" }, { status: 400 });
  }

  if (powerplayOversInnings > oversPerInnings) {
    return NextResponse.json(
      { error: "Powerplay overs cannot exceed total overs" },
      { status: 400 }
    );
  }

 const superAdmin = isSuperAdmin(session);

const teams = await prisma.team.findMany({
  where: {
    id: {
      in: [teamAId, teamBId]
    }
  },

  include: {
    players: true
  }
});

if (teams[0].leagueId !== teams[1].leagueId) {
  return NextResponse.json(
    {
      error: "Teams must belong to the same league"
    },
    {
      status: 400
    }
  );
}

if (teams.length !== 2) {
  return NextResponse.json(
    {
      error:
        "One or both teams do not exist"
    },
    {
      status: 404
    }
  );
}



  for (const team of teams) {
    if (team.players.length === 0) {
      return NextResponse.json(
        { error: `Team ${team.name} must have at least one player` },
        { status: 400 }
      );
    }
  }

if (!activeLeagueId) {
  return NextResponse.json(
    { error: "No active league selected" },
    { status: 400 }
  );
}

const league = await prisma.league.findUnique({
  where: {
    id: activeLeagueId
  }
});

if (!league) {
  return NextResponse.json(
    { error: "League not found" },
    { status: 404 }
  );
}

if (teams[0].leagueId !== activeLeagueId) {
  return NextResponse.json(
    {
      error:
        "Selected teams are not in active league"
    },
    {
      status: 400
    }
  );
}

const leagueId = activeLeagueId;
const shareCode =
  crypto.randomBytes(5).toString("base64url");  
const match = await prisma.match.create({
    data: {
      leagueId,
      teamAId,
      teamBId,
      battingFirstTeamId: battingFirstTeamId? Number(battingFirstTeamId) : null,
      oversPerInnings,
      powerplayOversInnings: Number(
      body.powerplayOversInnings
    ),

    maxWicketsPerInnings:
      body.maxWicketsPerInnings
        ? Number(body.maxWicketsPerInnings)
        : null,

    maxOversPerBowler:
      body.maxOversPerBowler
        ? Number(body.maxOversPerBowler)
        : null,
        
      status: "SCHEDULED",
      scheduledAt: scheduledAt
        ? new Date(scheduledAt)
        : null,
      shareCode
    }
  });

  return NextResponse.json(match, { status: 201 });
}