import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const seriesId = Number(id);

  if (!seriesId || Number.isNaN(seriesId)) {
    return NextResponse.json({ error: "Invalid series id" }, { status: 400 });
  }

  const body = await request.json();

  const updated = await prisma.series.update({
    where: { id: seriesId },
    data: {
      name: body.name,
      year: body.year ? Number(body.year) : null,
      status: body.status || "ACTIVE",
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const seriesId = Number(id);

  if (!seriesId || Number.isNaN(seriesId)) {
    return NextResponse.json({ error: "Invalid series id" }, { status: 400 });
  }

  const linkedMatchCount = await prisma.match.count({
    where: {
      seriesId,
      status: {
        in: [
          "SCHEDULED",
          "ACTIVE",
          "ABANDONED",
          "COMPLETED",
          "COMPLETED_LOCKED",
          "COMPLETED_CORRECTED",
        ],
      },
    },
  });

  if (linkedMatchCount > 0) {
    return NextResponse.json(
      {
        error:
          "This series cannot be deleted because matches already exist under it.",
      },
      { status: 400 }
    );
  }

  await prisma.series.delete({
    where: { id: seriesId },
  });

  return NextResponse.json({ ok: true });
}