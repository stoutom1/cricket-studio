import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

function parsePositiveInteger(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function normalizeWhatsAppNumber(value) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return "";
  }

  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (
    digits.length === 11 &&
    digits.startsWith("1")
  ) {
    return `+${digits}`;
  }

  if (
    raw.startsWith("+") &&
    digits.length >= 8 &&
    digits.length <= 15
  ) {
    return `+${digits}`;
  }

  return raw;
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const leagueId = parsePositiveInteger(id);

    if (!leagueId) {
      return NextResponse.json(
        { error: "Invalid league ID." },
        { status: 400 }
      );
    }

    const session =
      await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const league =
      await prisma.league.findUnique({
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
        { error: "League not found." },
        { status: 404 }
      );
    }

    const teams = await prisma.team.findMany({
      where: {
        leagueId,
      },

      select: {
        id: true,
        name: true,

        players: {
          select: {
            id: true,
            name: true,

            whatsappNumber: true,
            whatsappOptIn: true,
          },

          orderBy: {
            name: "asc",
          },
        },
      },

      orderBy: {
        name: "asc",
      },
    });

    const uniquePlayers = new Map();

    for (const team of teams) {
      for (const player of team.players) {
        const playerId = Number(player.id);

        const playerWhatsAppNumber =
          normalizeWhatsAppNumber(
            player.whatsappNumber
          );

        if (!uniquePlayers.has(playerId)) {
          uniquePlayers.set(playerId, {
            id: playerId,
            name: player.name,

            whatsappNumber:
              playerWhatsAppNumber,

            whatsappOptIn:
              Boolean(player.whatsappOptIn),

            teamIds: [],
            teamNames: [],
          });
        }

        const existingPlayer =
          uniquePlayers.get(playerId);

        /*
         * Prefer a record containing a WhatsApp
         * number if the same player is returned
         * through multiple teams.
         */
        if (
          !existingPlayer.whatsappNumber &&
          playerWhatsAppNumber
        ) {
          existingPlayer.whatsappNumber =
            playerWhatsAppNumber;
        }

        /*
         * If any returned player record has consent
         * enabled, keep consent enabled.
         */
        if (player.whatsappOptIn === true) {
          existingPlayer.whatsappOptIn = true;
        }

        if (
          !existingPlayer.teamIds.includes(team.id)
        ) {
          existingPlayer.teamIds.push(team.id);
        }

        if (
          !existingPlayer.teamNames.includes(
            team.name
          )
        ) {
          existingPlayer.teamNames.push(
            team.name
          );
        }
      }
    }

    const players =
      Array.from(uniquePlayers.values()).sort(
        (firstPlayer, secondPlayer) =>
          firstPlayer.name.localeCompare(
            secondPlayer.name,
            undefined,
            {
              sensitivity: "base",
            }
          )
      );

    return NextResponse.json({
      league,
      players,
      totalPlayers: players.length,
    });
  } catch (error) {
    console.error(
      "GET league players error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load league players.",
      },
      { status: 500 }
    );
  }
}