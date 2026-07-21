import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

function parsePositiveInteger(value) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }

  return number;
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const leagueId = parsePositiveInteger(id);

    console.log("Birthday GET route params:", {
      id,
      leagueId,
    });

    if (!leagueId) {
      return NextResponse.json(
        {
          error: "Invalid league ID.",
          receivedValue: id,
        },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const league = await prisma.league.findUnique({
      where: {
        id: leagueId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!league) {
      return NextResponse.json(
        { error: `League ${leagueId} was not found.` },
        { status: 404 }
      );
    }

    const birthdays = await prisma.leagueBirthday.findMany({
      where: {
        leagueId,
      },
      orderBy: [
        {
          birthMonth: "asc",
        },
        {
          birthDay: "asc",
        },
        {
          name: "asc",
        },
      ],
    });

    return NextResponse.json({
      league,
      birthdays,
    });
  } catch (error) {
    console.error("GET birthdays error:", error);

    return NextResponse.json(
      {
        error: "Unable to load birthdays.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const leagueId = Number(id);

    console.log("params:", await params);
    console.log("Birthday POST route params:", {
      id,
      leagueId,
    });

    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      return NextResponse.json(
        { error: "Invalid league ID." },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const playerId = Number(body.playerId);
    const birthMonth = Number(body.birthMonth);
    const birthDay = Number(body.birthDay);

    const notes =
      typeof body.notes === "string"
        ? body.notes.trim()
        : "";

    const whatsappNumber =
  typeof body.whatsappNumber === "string"
    ? body.whatsappNumber.replace(/\D/g, "")
    : "";

const whatsappOptIn =
  body.whatsappOptIn === true;
  
  if (
  whatsappOptIn &&
  (whatsappNumber.length < 10 ||
    whatsappNumber.length > 15)
) {
  return NextResponse.json(
    {
      error:
        "Enter a valid WhatsApp number with country code when WhatsApp consent is enabled.",
    },
    { status: 400 }
  );
}

    if (!Number.isInteger(playerId) || playerId <= 0) {
      return NextResponse.json(
        { error: "Please select a valid player." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(birthMonth) ||
      birthMonth < 1 ||
      birthMonth > 12
    ) {
      return NextResponse.json(
        { error: "Please select a valid birth month." },
        { status: 400 }
      );
    }

    const daysByMonth = {
      1: 31,
      2: 29,
      3: 31,
      4: 30,
      5: 31,
      6: 30,
      7: 31,
      8: 31,
      9: 30,
      10: 31,
      11: 30,
      12: 31,
    };

    if (
      !Number.isInteger(birthDay) ||
      birthDay < 1 ||
      birthDay > daysByMonth[birthMonth]
    ) {
      return NextResponse.json(
        { error: "Please select a valid birth day." },
        { status: 400 }
      );
    }

    const league = await prisma.league.findUnique({
      where: {
        id: leagueId,
      },
      select: {
        id: true,
      },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found." },
        { status: 404 }
      );
    }

    const teams = await prisma.team.findMany({
      where: {
        leagueId,
        players: {
          some: {
            id: playerId,
          },
        },
      },
      select: {
        id: true,
        players: {
          where: {
            id: playerId,
          },
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const player = teams
      .flatMap((team) => team.players)
      .find((currentPlayer) => currentPlayer.id === playerId);

    if (!player) {
      return NextResponse.json(
        {
          error:
            "The selected player does not belong to this league.",
        },
        { status: 400 }
      );
    }

    const existingBirthday =
  await prisma.leagueBirthday.findFirst({
    where: {
      leagueId,
      playerId: player.id,
    },
    select: {
      id: true,
    },
  });

if (existingBirthday) {
  return NextResponse.json(
    {
      error:
        "A birthday entry already exists for this player.",
    },
    { status: 409 }
  );
}

const sessionUserId = session?.user?.id;

if (!sessionUserId) {
  return NextResponse.json(
    {
      error:
        "Your login session does not contain a user ID. Please sign out and sign in again.",
    },
    { status: 401 }
  );
}

const sessionEmail = session?.user?.email;

if (!sessionEmail) {
  return NextResponse.json(
    { error: "Unauthorized." },
    { status: 401 }
  );
}

const currentUser = await prisma.user.findUnique({
  where: {
    email: sessionEmail.toLowerCase(),
  },
  select: {
    id: true,
  },
});

if (!currentUser) {
  return NextResponse.json(
    { error: "Logged-in user was not found." },
    { status: 404 }
  );
}

const birthday =
  await prisma.leagueBirthday.create({
    data: {
      league: {
        connect: {
          id: leagueId,
        },
      },

      createdBy: {
        connect: {
          id: currentUser.id,
        },
      },

      player: {
        connect: {
          id: player.id,
        },
      },

      name: player.name,
      birthMonth,
      birthDay,
      notes: notes || null,
      isActive: true,

      whatsappNumber:
        whatsappNumber || null,

      whatsappOptIn,
    },
  });

    return NextResponse.json(
      {
        message: "Birthday added successfully.",
        birthday,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST birthday error:", error);

    return NextResponse.json(
      {
        error: "Unable to add birthday.",
      },
      { status: 500 }
    );
  }
}