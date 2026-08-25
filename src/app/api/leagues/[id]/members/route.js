import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superAdmin";
import {
  getAllowedInviteRoles,
  getRolePermissionDefaults,
  normalizeLeagueRole,
} from "@/lib/league-role-permissions";

export async function GET(
  request,
  { params }
) {
  const session =
    await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const leagueId = Number(id);

  const members =
    await prisma.leagueMember.findMany({
      where: {
        leagueId
      },

      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },

      orderBy: {
        joinedAt: "asc"
      }
    });

  return NextResponse.json(members);
}

export async function POST(
  request,
  { params }
) {
  const session =
    await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const leagueId = Number(id);

  const currentUser =
    await prisma.user.findUnique({
      where: {
        email: session.user.email
      }
    });

  if (!currentUser) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
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
      { error: "League not found" },
      { status: 404 }
    );
  }

  const membership =
    await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId: currentUser.id,
          leagueId
        }
      }
    });

  const canManageMembers =
    league.ownerId === currentUser.id ||
    membership?.canManageMembers;

  if (!canManageMembers) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const body = await request.json();

  const email =
    body.email?.trim()?.toLowerCase();

  const role =
    normalizeLeagueRole(body.role || "VIEWER");

  const isSuperAdmin =
    String(currentUser.email || "").toLowerCase() ===
    "surprisecricket11@gmail.com";

  const effectiveRole =
    league.ownerId === currentUser.id
      ? "OWNER"
      : membership?.role || "VIEWER";

  const allowedRoles = getAllowedInviteRoles({
    role: effectiveRole,
    permissions: membership,
    isSuperAdmin,
  });

  if (!allowedRoles.includes(role)) {
    return NextResponse.json(
      { error: "Your current league access cannot assign that role." },
      { status: 403 }
    );
  }

  const rolePermissions =
    getRolePermissionDefaults(role);

  if (!email) {
    return NextResponse.json(
      { error: "Email required" },
      { status: 400 }
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email
      }
    });

  if (!user) {
    return NextResponse.json(
      {
        error:
          "User must register before being added"
      },
      { status: 404 }
    );
  }

  const existing =
    await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId: user.id,
          leagueId
        }
      }
    });

  if (existing) {
    return NextResponse.json(
      {
        error:
          "User is already a member"
      },
      { status: 400 }
    );
  }

  const member =
    await prisma.leagueMember.create({
      data: {
        userId: user.id,
        leagueId,
        role,
        ...rolePermissions,
      }
    });

  return NextResponse.json(member);
}

export async function DELETE(
  request,
  { params }
) {
  try {
    const session =
      await getServerSession(
        authOptions
      );

    if (!session?.user?.email) {
      return NextResponse.json(
        {
          error:
            "Unauthorized",
        },
        {
          status:
            401,
        }
      );
    }

    const { id } =
      await params;

    const leagueId =
      Number(
        id
      );

    if (
      !Number.isInteger(
        leagueId
      ) ||
      leagueId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid league id",
        },
        {
          status:
            400,
        }
      );
    }

    const currentUser =
      await prisma.user.findUnique({
        where: {
          email:
            session.user.email,
        },
        select: {
          id:
            true,
          email:
            true,
          name:
            true,
        },
      });

    if (!currentUser) {
      return NextResponse.json(
        {
          error:
            "User not found",
        },
        {
          status:
            404,
        }
      );
    }

    const league =
      await prisma.league.findUnique({
        where: {
          id:
            leagueId,
        },
        select: {
          id:
            true,
          name:
            true,
          ownerId:
            true,
        },
      });

    if (!league) {
      return NextResponse.json(
        {
          error:
            "League not found",
        },
        {
          status:
            404,
        }
      );
    }

    const currentMembership =
      await prisma.leagueMember.findUnique({
        where: {
          userId_leagueId: {
            userId:
              currentUser.id,
            leagueId,
          },
        },
        select: {
          role:
            true,
        },
      });

    const superAdmin =
      isSuperAdmin(
        session
      );

    const owner =
      String(
        league.ownerId ||
          ""
      ) ===
        String(
          currentUser.id
        ) ||
      String(
        currentMembership?.role ||
          ""
      ).toUpperCase() ===
        "OWNER";

    if (
      !superAdmin &&
      !owner
    ) {
      return NextResponse.json(
        {
          error:
            "Only the Cric4All Super Admin or a league Owner can unregister league members.",
        },
        {
          status:
            403,
        }
      );
    }

    const { searchParams } =
      new URL(
        request.url
      );

    const userId =
      String(
        searchParams.get(
          "userId"
        ) ||
          ""
      ).trim();

    if (!userId) {
      return NextResponse.json(
        {
          error:
            "userId required",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      userId ===
      String(
        league.ownerId ||
          ""
      )
    ) {
      return NextResponse.json(
        {
          error:
            "The primary league owner cannot be unregistered. Transfer league ownership first.",
        },
        {
          status:
            409,
        }
      );
    }

    if (
      userId ===
      String(
        currentUser.id
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot unregister your own membership from this administrative action.",
        },
        {
          status:
            409,
        }
      );
    }

    const targetMembership =
      await prisma.leagueMember.findUnique({
        where: {
          userId_leagueId: {
            userId,
            leagueId,
          },
        },
        include: {
          user: {
            select: {
              id:
                true,
              name:
                true,
              email:
                true,
            },
          },
        },
      });

    if (!targetMembership) {
      return NextResponse.json(
        {
          error:
            "This user is not currently registered in the selected league.",
        },
        {
          status:
            404,
        }
      );
    }

    await prisma.leagueMember.delete({
      where: {
        userId_leagueId: {
          userId,
          leagueId,
        },
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          action:
            "LEAGUE_MEMBER_UNREGISTERED",
          entityType:
            "LEAGUE_MEMBER",
          entityId:
            targetMembership.id,
          leagueId,
          actorName:
            currentUser.name ||
            null,
          actorEmail:
            currentUser.email ||
            null,
          description:
            `${targetMembership.user?.name || targetMembership.user?.email || "User"} was unregistered from ${league.name}.`,
          beforeData: {
            memberId:
              targetMembership.id,
            userId:
              targetMembership.userId,
            role:
              targetMembership.role,
            name:
              targetMembership.user?.name ||
              null,
            email:
              targetMembership.user?.email ||
              null,
          },
          afterData: {
            registeredInLeague:
              false,
            historicalDataPreserved:
              true,
            accountPreserved:
              true,
          },
        },
      });
    } catch (
      auditError
    ) {
      /*
       * Membership removal must not be rolled back merely because a legacy
       * AuditLog schema differs. Keep the unregister operation successful.
       */
      console.warn(
        "[LEAGUE_MEMBER_UNREGISTER_AUDIT_FAILED]",
        auditError
      );
    }

    return NextResponse.json({
      success:
        true,
      leagueId,
      userId,
      memberId:
        targetMembership.id,
      accountPreserved:
        true,
      historicalDataPreserved:
        true,
      message:
        `${targetMembership.user?.name || targetMembership.user?.email || "User"} was unregistered from ${league.name}.`,
    });
  } catch (
    error
  ) {
    console.error(
      "[LEAGUE_MEMBER_UNREGISTER_FAILED]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to unregister league member.",
      },
      {
        status:
          500,
      }
    );
  }
}
