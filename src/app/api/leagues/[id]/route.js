import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { ROLES } from "@/lib/roles";
import { isSuperAdmin } from "@/lib/superAdmin";
import { logAudit } from "@/lib/audit";
import { slugify } from "@/lib/slug";

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
await prisma.user.updateMany({
  where: {
    activeLeagueId: leagueId
  },
  data: {
    activeLeagueId: null
  }
});
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
await prisma.leagueInvite.deleteMany({
  where: {
    leagueId
  }
});
    await prisma.league.delete({
      where: {
        id: leagueId
      }
    });
await logAudit({
    action: "LEAGUE_DELETED",
    entityType: "LEAGUE",
    entityId: league.id,
    leagueId: league.id,
    actor: session?.user,
    description: `League "${league.name}" was deleted.`,
    //beforeData: beforeLeague,
    //afterData: updatedLeague,
    request,
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
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const leagueId = Number(id);

    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      return NextResponse.json(
        { error: "Invalid league id" },
        { status: 400 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId }
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    /*
     * LEAGUE SETTINGS UPDATE
     * ----------------------
     * Keep this payload explicitly separated from the existing member-role
     * PATCH behavior below. This preserves backward compatibility for the
     * permissions UI while allowing an existing league to change name and
     * visibility.
     */
    if (body?.action === "UPDATE_LEAGUE") {
      const superAdmin = isSuperAdmin(session);

      const membership = superAdmin
        ? null
        : await prisma.leagueMember.findFirst({
            where: {
              leagueId,
              userId: currentUser.id
            },
            select: {
              role: true,
              canEditLeague: true
            }
          });

      const canEditLeague =
        superAdmin ||
        Number(league.ownerId) === Number(currentUser.id) ||
        membership?.role === "OWNER" ||
        membership?.canEditLeague === true;

      if (!canEditLeague) {
        return NextResponse.json(
          { error: "You do not have permission to edit this league" },
          { status: 403 }
        );
      }

      const name = String(body?.name || "").trim();
      const visibility = String(body?.visibility || "PRIVATE")
        .trim()
        .toUpperCase();

      if (!name) {
        return NextResponse.json(
          { error: "League name is required" },
          { status: 400 }
        );
      }

      if (!["PRIVATE", "UNLISTED", "PUBLIC"].includes(visibility)) {
        return NextResponse.json(
          { error: "Invalid league visibility" },
          { status: 400 }
        );
      }

      const duplicateLeague = await prisma.league.findFirst({
        where: {
          name,
          NOT: { id: leagueId }
        },
        select: { id: true }
      });

      if (duplicateLeague) {
        return NextResponse.json(
          { error: `League "${name}" already exists` },
          { status: 409 }
        );
      }

      const beforeLeague = {
        id: league.id,
        name: league.name,
        visibility: league.visibility,
        slug: league.slug
      };

      const updatedLeague = await prisma.league.update({
        where: { id: leagueId },
        data: {
          name,
          visibility,
          // Preserve existing public links when a league is renamed.
          // Only create a slug when an older league does not have one yet.
          ...(league.slug ? {} : { slug: slugify(name) })
        }
      });

      await logAudit({
        action: "LEAGUE_UPDATED",
        entityType: "LEAGUE",
        entityId: updatedLeague.id,
        leagueId: updatedLeague.id,
        actor: session?.user,
        description: `League "${updatedLeague.name}" settings were updated.`,
        beforeData: beforeLeague,
        afterData: {
          id: updatedLeague.id,
          name: updatedLeague.name,
          visibility: updatedLeague.visibility,
          slug: updatedLeague.slug
        },
        request
      });

      return NextResponse.json({
        success: true,
        league: updatedLeague
      });
    }

    /*
     * EXISTING MEMBER ROLE UPDATE
     * ---------------------------
     * Do not change the contract used by the current permissions screen.
     */
    if (league.ownerId !== currentUser.id) {
      return NextResponse.json(
        { error: "Only league owner can change roles" },
        { status: 403 }
      );
    }

    const permissions = ROLES[body.role];

    if (!permissions) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    const memberId = Number(body.memberId);

    if (!Number.isInteger(memberId) || memberId <= 0) {
      return NextResponse.json(
        { error: "Invalid member id" },
        { status: 400 }
      );
    }

    const member = await prisma.leagueMember.update({
      where: { id: memberId },
      data: {
        role: body.role,
        ...permissions
      }
    });

    return NextResponse.json(member);
  } catch (error) {
    console.error("League PATCH error:", error);

    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "League name or public link already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update league" },
      { status: 500 }
    );
  }
}

