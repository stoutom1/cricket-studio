import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      matchId,
      replacementPlayerId,
      retiredPlayerType
    } = body;

    const match =
      await prisma.match.findUnique({
        where: {
          id: Number(matchId)
        }
      });

    if (!match) {
      return NextResponse.json(
        {
          error: "Match not found"
        },
        {
          status: 404
        }
      );
    }

    const state =
      await prisma.matchState.findUnique({
        where: {
          matchId:
            Number(matchId)
        }
      });

    if (!state) {
      return NextResponse.json(
        {
          error:
            "Match state not found"
        },
        {
          status: 404
        }
      );
    }

    await prisma.matchState.update({
      where: {
        matchId:
          Number(matchId)
      },
      data: {
        strikerId:
          retiredPlayerType ===
          "STRIKER"
            ? Number(
                replacementPlayerId
              )
            : state.strikerId,

        nonStrikerId:
          retiredPlayerType ===
          "NON_STRIKER"
            ? Number(
                replacementPlayerId
              )
            : state.nonStrikerId
      }
    });

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          "Failed to process retired hurt"
      },
      {
        status: 500
      }
    );
  }
}