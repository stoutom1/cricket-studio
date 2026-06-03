import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superAdmin";
export const runtime = "nodejs";

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


export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
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

const superAdmin = isSuperAdmin(session);
if (!user) {
  return NextResponse.json(
    { error: "User not found" },
    { status: 404 }
  );
}
const where = {};

if (!superAdmin) {
  where.leagueId = activeLeagueId;

  where.league = {
    members: {
      some: {
        userId: user.id
      }
    }
  };
} else if (activeLeagueId) {
  where.leagueId = activeLeagueId;
}

const matches = await prisma.match.findMany({
  where,
  include: {
    league: true,
    teamA: true,
    teamB: true,
    battingFirstTeam: true,
    balls: true
  },
  orderBy: {
    createdAt: "desc"
  }
});
  // AUTO UPDATE MATCH STATUS
  for (const match of matches) {
    const innings1Balls = match.balls.filter(
      (b) => b.inningsNo === 1
    );

    const innings2Balls = match.balls.filter(
      (b) => b.inningsNo === 2
    );

    const innings1Runs = innings1Balls.reduce(
      (sum, b) => sum + b.totalRuns,
      0
    );

    const innings2Runs = innings2Balls.reduce(
      (sum, b) => sum + b.totalRuns,
      0
    );

    const innings1LegalBalls = innings1Balls.filter(
      (b) => b.legalDelivery
    ).length;

    const innings2LegalBalls = innings2Balls.filter(
      (b) => b.legalDelivery
    ).length;

    const innings2Wickets = innings2Balls.reduce(
      (sum, b) =>
        sum + (countsAsWicket(b) ? 1 : 0),
      0
    );

    const target = innings1Runs + 1;

    const innings2Completed =
      innings2Runs >= target ||
      innings2LegalBalls >=
        match.oversPerInnings * 6
//         || innings2Wickets >= 10;

    const shouldComplete =
      innings1LegalBalls > 0 &&
      innings2Completed;

    if (
      shouldComplete &&
      match.status !== "completed"
    ) {
      await prisma.match.update({
        where: { id: match.id },

        data: {
          status: "completed"
        }
      });

      match.status = "completed";
    }
  }

  const formatted = matches.map((m) => ({
    id: m.id,
    leagueId: m.leagueId,
    leagueName: m.league?.name,
    teamAId: m.teamAId,
    teamBId: m.teamBId,
    teamAName: m.teamA.name,
    teamBName: m.teamB.name,
    battingFirstTeamId: m.battingFirstTeamId,
    battingFirstTeamName: m.battingFirstTeam.name,
    oversPerInnings: m.oversPerInnings,
    powerplayOversInnings: m.powerplayOversInnings,
    maxWicketsPerInnings: m.maxWicketsPerInnings,
    maxOversPerBowler: m.maxOversPerBowler,
    status: m.status,
    createdAt: m.createdAt
  }));

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

  if (!teamAId || !teamBId || !battingFirstTeamId) {
    return NextResponse.json({ error: "Teams and batting first team are required" }, { status: 400 });
  }

  if (teamAId === teamBId) {
    return NextResponse.json({ error: "Teams must be different" }, { status: 400 });
  }

  if (![teamAId, teamBId].includes(battingFirstTeamId)) {
    return NextResponse.json(
      { error: "Batting first team must be Team A or Team B" },
      { status: 400 }
    );
  }

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
  
const match = await prisma.match.create({
    data: {
      leagueId,
      teamAId,
      teamBId,
      battingFirstTeamId,
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
        
      status: "in_progress"
    }
  });
console.log("Match",match);
  return NextResponse.json(match, { status: 201 });
}