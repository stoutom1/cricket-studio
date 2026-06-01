import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
const leagues = await prisma.league.findMany({
  include: {
    teams: {
      include: {
        players: true
      }
    }
  },
  orderBy: {
    name: "asc"
  }
});

/*
const leagues =
  await prisma.league.findMany({
    where: {
      members: {
        some: {
          userId: session.user.id
        }
      }
    },
    include: {
      teams: true
    }
  });
  */
return NextResponse.json(leagues);
}

export async function POST(req) {
  const body = await req.json();

  const league = await prisma.league.create({
    data: {
      name: body.name.trim()
    }
  });

  return NextResponse.json(league);
}