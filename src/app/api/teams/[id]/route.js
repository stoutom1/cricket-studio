import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const teamId = Number(id);

  if (Number.isNaN(teamId) || teamId <= 0) {
    return NextResponse.json(
      { error: "Invalid team id" },
      { status: 400 }
    );
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      _count: {
        select: {
          matchesA: true,
          matchesB: true,
          players: true,
        },
      },
    },
  });

  if (!team) {
    return NextResponse.json(
      { error: "Team not found" },
      { status: 404 }
    );
  }

  const totalMatches =
    team._count.matchesA + team._count.matchesB;

  if (totalMatches > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete team because it is used in one or more matches. Delete those matches first.",
      },
      { status: 400 }
    );
  }

  await prisma.team.delete({
    where: { id: teamId },
  });

  return NextResponse.json({
    success: true,
    message: "Team deleted successfully",
  });
}