import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { ROLES } from "@/lib/roles";
import { isSuperAdmin } from "@/lib/superAdmin";

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const leagueId = Number(id);

    if (isNaN(leagueId)) {
      return NextResponse.json(
        { error: "Invalid league id" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const league = await prisma.league.findUnique({
      where: {
        id: leagueId
      }
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    const superAdmin = isSuperAdmin(session);

if (!superAdmin) {
  const membership =
    await prisma.leagueMember.findFirst({
      where: {
        leagueId,
        userId: user.id,
        role: "OWNER"
      }
    });

  if (!membership) {
    return NextResponse.json(
      {
        error:
          "Only league owners can delete leagues"
      },
      {
        status: 403
      }
    );
  }
}

    await prisma.leagueMember.deleteMany({
      where: {
        leagueId
      }
    });

    await prisma.team.deleteMany({
      where: {
        leagueId
      }
    });

    await prisma.match.deleteMany({
      where: {
        leagueId
      }
    });

    await prisma.league.delete({
      where: {
        id: leagueId
      }
    });

    return NextResponse.json({
      success: true,
      message: "League deleted successfully"
    });
  } catch (error) {
    console.error("Delete league error:", error);

    return NextResponse.json(
      {
        error: "Failed to delete league"
      },
      {
        status: 500
      }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        {
          error: "Unauthorized"
        },
        {
          status: 401
        }
      );
    }

    const { id } = await params;
    const leagueId = Number(id);

    if (isNaN(leagueId)) {
      return NextResponse.json(
        {
          error: "Invalid league id"
        },
        {
          status: 400
        }
      );
    }

    const currentUser =
      await prisma.user.findUnique({
        where: {
          email: session.user.email
        }
      });

    if (!currentUser) {
      return NextResponse.json(
        {
          error: "User not found"
        },
        {
          status: 404
        }
      );
    }

    const league =
      await prisma.league.findUnique({
        where: {
          id: leagueId
        }
      });

    if (!league) {
      return NextResponse.json(
        {
          error: "League not found"
        },
        {
          status: 404
        }
      );
    }

    if (league.ownerId !== currentUser.id) {
      return NextResponse.json(
        {
          error:
            "Only league owner can change roles"
        },
        {
          status: 403
        }
      );
    }

    const body =
      await request.json();

    const permissions =
      ROLES[body.role];

    if (!permissions) {
      return NextResponse.json(
        {
          error: "Invalid role"
        },
        {
          status: 400
        }
      );
    }

    const member =
      await prisma.leagueMember.update({
        where: {
          id: Number(body.memberId)
        },
        data: {
          role: body.role,
          ...permissions
        }
      });

    return NextResponse.json(
      member
    );
  } catch (error) {
    console.error(
      "Role update error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update role"
      },
      {
        status: 500
      }
    );
  }
}