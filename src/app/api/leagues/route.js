import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superAdmin";
export const dynamic = "force-dynamic";

export async function GET() {
  const session =
    await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email: session.user.email
      }
    });

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }
const superAdmin = isSuperAdmin(session);
//console.log("SESSION USER:", session?.user);
//console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);
//console.log("superAdmin", superAdmin);

const leagues = await prisma.league.findMany({
  where: superAdmin
    ? {}
    : {
        members: {
          some: {
            userId: user.id
          }
        }
      },

  include: {
    teams: {
      include: {
        players: true
      }
    },

    members: {
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    }
  },

  orderBy: {
    name: "asc"
  }
});

  return NextResponse.json(
    leagues
  );
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
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

if (!user) {
  return NextResponse.json(
    { error: "User not found" },
    { status: 404 }
  );
}

    const body = await req.json();

    const name = body?.name?.trim();

    if (!name) {
      return NextResponse.json(
        { error: "League name is required" },
        { status: 400 }
      );
    }

    const existingLeague = await prisma.league.findUnique({
      where: { name },
    });

    if (existingLeague) {
      return NextResponse.json(
        {
          error: `League "${name}" already exists`,
        },
        { status: 409 }
      );
    }

const league = await prisma.league.create({
  data: {
    name: body.name.trim(),
    ownerId: user.id
  }
});

await prisma.leagueMember.create({
  data: {
    userId: user.id,
    leagueId: league.id,
    role: "OWNER",

    canViewDashboard: true,
    canViewManagement: true,
    canViewMatches: true,
    canViewScoring: true,
    canViewStats: true,

    canCreateTeam: true,
    canCreatePlayer: true,
    canCreateMatch: true,
    canEditLeague: true,
    canEditTeam: true,
    canEditPlayer: true,
    canEditMatch: true,

    canDeleteTeam: true,
    canDeletePlayer: true,
    canDeleteMatch: true,
    canDeleteLeague: true,

    canManageMembers: true,
    canManagePermissions: true,

    canScoreMatch: true,
    canEditScore: true,
    canUndoBall: true,

    canSwapStrike: true,
    canRetirePlayer: true,

    canExportStats: true,
    canViewAuditLogs: true
  }
});

    await prisma.user.update({
  where: {
    id: user.id
  },
  data: {
    activeLeagueId: league.id
  }
});

    return NextResponse.json(league, { status: 201 });
  } catch (error) {
    console.error("League creation error:", error);

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "League already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create league" },
      { status: 500 }
    );
  }
}