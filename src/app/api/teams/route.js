import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: {
      players: {
        orderBy: { name: "asc" }
      }
    }
  });

  return NextResponse.json(teams);
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

const body = await request.json();

const name = String(body.name || "").trim();
const leagueId = Number(body.leagueId);

  if (!name) {
    return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  }

  if (!leagueId) {
  return NextResponse.json(
    { error: "League is required" },
    { status: 400 }
  );
  }
  try {
const user = await prisma.user.findUnique({
  where: {
    email: session.user.email
  }
});

const league = await prisma.league.findUnique({
  where: {
    id: Number(leagueId)
  }
});

if (!league) {
  return NextResponse.json(
    { error: "League not found" },
    { status: 404 }
  );
}
if (league.ownerId !== user.id) {
  return NextResponse.json(
    { error: "Only league owner can perform this action" },
    { status: 403 }
  );
}
const membership = await prisma.leagueMember.findFirst({
  where: {
    userId: user.id,
    leagueId: league.id
  }
});

const isMember =
  league.ownerId === user.id || membership;

if (!isMember) {
  return NextResponse.json(
    { error: "Forbidden" },
    { status: 403 }
  );
}
        
    const team = await prisma.team.create({
        data: {
          name,
          leagueId
        }
      });
    return NextResponse.json(team, { status: 201 });
  } catch (error) {
  console.error(error);
        if (
          //error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
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
            error: error.message
          },
          {
            status: 500
          }
        );
      }
}