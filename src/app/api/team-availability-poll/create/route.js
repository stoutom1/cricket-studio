import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { leagueId, title, matchText, options } = await req.json();

    const cleanOptions = Array.isArray(options)
      ? options.filter((o) => o?.label || o?.startTime)
      : [];

    if (!cleanOptions.length) {
      return NextResponse.json(
        { error: "Please add at least one date option." },
        { status: 400 }
      );
    }

    const token = crypto.randomBytes(12).toString("hex");

    const poll = await prisma.teamAvailabilityPoll.create({
      data: {
        token,
        leagueId: leagueId ? Number(leagueId) : null,
        title: title || "Surprise Match Availability",
        matchText: matchText || null,
        options: {
          create: cleanOptions.map((option, index) => ({
            label: option.label || `Option ${index + 1}`,
            startTime: option.startTime ? new Date(option.startTime) : null,
            sortOrder: index,
          })),
        },
      },
      include: {
        options: {
          orderBy: { sortOrder: "asc" },
        },
        responses: true,
      },
    });

    return NextResponse.json({
      ok: true,
      poll,
    });
  } catch (error) {
    console.error("Create availability poll failed:", error);
    return NextResponse.json(
      { error: "Failed to create poll." },
      { status: 500 }
    );
  }
}