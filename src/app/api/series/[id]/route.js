import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(request, { params }) {
  const { id } = await params;
  const seriesId = Number(id);

  if (!seriesId || Number.isNaN(seriesId)) {
    return NextResponse.json(
      { error: "Invalid series id" },
      { status: 400 }
    );
  }

  const matchesCount = await prisma.match.count({
    where: { seriesId }
  });

  if (matchesCount > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete this series because matches are assigned to it. Move or delete those matches first."
      },
      { status: 400 }
    );
  }

  await prisma.series.delete({
    where: { id: seriesId }
  });

  return NextResponse.json({ success: true });
}