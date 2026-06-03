import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superAdmin";

export const runtime = "nodejs";

export async function GET() {
  try {
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

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const superAdmin = isSuperAdmin(session);

    const teams = await prisma.team.findMany({
      where: superAdmin
        ? {}
        : {
            league: {
              members: {
                some: {
                  userId: user.id
                }
              }
            }
          },
      include: {
        players: true,
        league: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        name: "asc"
      }
    });

    return NextResponse.json(teams);
  } catch (error) {
    console.error("GET teams error:", error);

    return NextResponse.json(
      {
        error: "Failed to load teams"
      },
      {
        status: 500
      }
    );
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const name = String(body.name || "").trim();
    const leagueId = Number(body.leagueId);

    if (!name) {
      return NextResponse.json(
        {
          error: "Team name is required"
        },
        {
          status: 400
        }
      );
    }

    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      return NextResponse.json(
        {
          error: "Valid league is required"
        },
        {
          status: 400
        }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email
      }
    });

    if (!user) {
      return NextResponse.json(
        {
          error: "User not found"
        },
        {
          status: 404
        }
      );
    }

    const league = await prisma.league.findUnique({
      where: {
        id: leagueId
      }
    });

    if (!league) {
      return NextResponse.json(
        {
          error: "League not found"
        },
        {
          status: 404
        }
      );
    }

    const superAdmin = isSuperAdmin(session);

    if (!superAdmin) {
      const membership =
        await prisma.leagueMember.findFirst({
          where: {
            userId: user.id,
            leagueId
          }
        });

      if (!membership) {
        return NextResponse.json(
          {
            error:
              "You are not a member of this league"
          },
          {
            status: 403
          }
        );
      }

      if (
        membership.canCreateTeam === false
      ) {
        return NextResponse.json(
          {
            error:
              "You do not have permission to create teams"
          },
          {
            status: 403
          }
        );
      }
    }

    const existingTeam =
      await prisma.team.findFirst({
        where: {
          leagueId,
          name
        }
      });

    if (existingTeam) {
      return NextResponse.json(
        {
          error:
            "A team with this name already exists in the league"
        },
        {
          status: 409
        }
      );
    }

    const team = await prisma.team.create({
      data: {
        name,
        leagueId
      }
    });

    return NextResponse.json(
      team,
      {
        status: 201
      }
    );
  } catch (error) {
    console.error(
      "Create team error:",
      error
    );

    if (error?.code === "P2002") {
      return NextResponse.json(
        {
          error: "Team already exists"
        },
        {
          status: 409
        }
      );
    }

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to create team"
      },
      {
        status: 500
      }
    );
  }
}