import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(req, { params }) {
  try {
    const { token } = await params;

    await prisma.teamAvailabilityPoll.delete({
      where: { token },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete poll failed:", error);
    return NextResponse.json(
      { error: "Failed to delete poll." },
      { status: 500 }
    );
  }
}