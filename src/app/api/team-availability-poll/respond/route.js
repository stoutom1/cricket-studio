import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const {
      token,
      playerKey,
      playerName,
      responses,
      displayName,
      comment,
    } = await req.json();

    if (!token || !playerKey || !playerName || !Array.isArray(responses)) {
      return NextResponse.json(
        { error: "Player and date responses are required." },
        { status: 400 }
      );
    }

    const poll = await prisma.teamAvailabilityPoll.findUnique({
      where: { token },
      include: { options: true },
    });

    if (!poll) {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }

    if (poll.status !== "OPEN") {
      return NextResponse.json(
        { error: "This poll is closed." },
        { status: 400 }
      );
    }

    const validOptionIds = new Set(poll.options.map((o) => Number(o.id)));

    for (const item of responses) {
      const optionId = Number(item.optionId);

      if (!validOptionIds.has(optionId)) continue;

      if (!["YES", "MAYBE", "NO"].includes(item.response)) continue;

      await prisma.teamAvailabilityResponse.upsert({
        where: {
          pollId_optionId_playerKey: {
            pollId: poll.id,
            optionId,
            playerKey,
          },
        },
        update: {
          response: item.response,
          playerName,
          displayName: displayName || null,
          comment: comment || null,
        },
        create: {
          pollId: poll.id,
          optionId,
          playerKey,
          playerName,
          response: item.response,
          displayName: displayName || null,
          comment: comment || null,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Submit availability failed:", error);
    return NextResponse.json(
      { error: "Failed to submit response." },
      { status: 500 }
    );
  }
}