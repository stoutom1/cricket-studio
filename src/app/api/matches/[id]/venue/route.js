import {
  NextResponse,
} from "next/server";
import {
  getServerSession,
} from "next-auth";
import prisma from "@/lib/prisma";
import {
  authOptions,
} from "@/lib/auth";
import {
  isSuperAdmin,
} from "@/lib/superAdmin";
import {
  logAudit,
} from "@/lib/audit";

export const runtime =
  "nodejs";

function cleanVenueValue(
  value,
  maxLength
) {
  return (
    String(
      value ||
      ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim()
      .slice(
        0,
        maxLength
      ) ||
    null
  );
}

/*
 * Venue is administrative match metadata, not a scoring event.
 *
 * This dedicated endpoint intentionally supports SCHEDULED, IN_PROGRESS,
 * COMPLETED and LOCKED matches so an authorized league administrator can
 * correct/add a real historical venue without reopening or changing scoring.
 */
export async function PATCH(
  request,
  {
    params,
  }
) {
  const session =
    await getServerSession(
      authOptions
    );

  if (
    !session?.user?.email
  ) {
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

  const {
    id,
  } = await params;

  const matchId =
    Number(id);

  if (
    !Number.isInteger(
      matchId
    ) ||
    matchId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid match id.",
      },
      {
        status:
          400,
      }
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email:
          session.user.email,
      },
      select: {
        id: true,
      },
    });

  if (!user) {
    return NextResponse.json(
      {
        error:
          "User not found.",
      },
      {
        status:
          404,
      }
    );
  }

  const match =
    await prisma.match.findUnique({
      where: {
        id:
          matchId,
      },
      include: {
        league: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
        teamA: {
          select: {
            name: true,
          },
        },
        teamB: {
          select: {
            name: true,
          },
        },
      },
    });

  if (!match) {
    return NextResponse.json(
      {
        error:
          "Match not found.",
      },
      {
        status:
          404,
      }
    );
  }

  const superAdmin =
    isSuperAdmin(
      session
    );

  let allowed =
    superAdmin ||
    (
      match.league?.ownerId &&
      String(
        match.league.ownerId
      ) ===
        String(
          user.id
        )
    );

  if (
    !allowed &&
    match.leagueId
  ) {
    const membership =
      await prisma.leagueMember.findUnique({
        where: {
          userId_leagueId: {
            userId:
              user.id,
            leagueId:
              Number(
                match.leagueId
              ),
          },
        },
        select: {
          role: true,
          canEditMatch:
            true,
          canManagePermissions:
            true,
        },
      });

    allowed =
      Boolean(
        membership &&
        (
          [
            "OWNER",
            "ADMIN",
          ].includes(
            String(
              membership.role ||
              ""
            ).toUpperCase()
          ) ||
          membership
            .canEditMatch ===
            true ||
          membership
            .canManagePermissions ===
            true
        )
      );
  }

  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "You do not have permission to edit this match venue.",
      },
      {
        status:
          403,
      }
    );
  }

  const body =
    await request.json();

  const venueName =
    cleanVenueValue(
      body?.venueName,
      160
    );

  const venueAddress =
    cleanVenueValue(
      body?.venueAddress,
      300
    );

  /*
   * A ground name may legitimately be unknown while a real address is known,
   * and vice versa. We allow either/both in Cric4All.
   *
   * Google SportsEvent markup is emitted only when venueAddress exists,
   * because Google's Event documentation requires a physical location/address.
   */
  const beforeData = {
    venueName:
      match.venueName ||
      null,
    venueAddress:
      match.venueAddress ||
      null,
  };

  const updated =
    await prisma.match.update({
      where: {
        id:
          matchId,
      },
      data: {
        venueName,
        venueAddress,
      },
      select: {
        id: true,
        venueName: true,
        venueAddress: true,
        status: true,
        lockedAt: true,
      },
    });

  try {
    await logAudit({
      action:
        "MATCH_VENUE_UPDATED",
      entityType:
        "MATCH",
      entityId:
        matchId,
      leagueId:
        match.leagueId ||
        null,
      matchId,
      actor:
        session.user,
      description:
        `Venue updated for ${match.teamA?.name || "Team A"} vs ${match.teamB?.name || "Team B"}.`,
      beforeData,
      afterData: {
        venueName:
          updated.venueName ||
          null,
        venueAddress:
          updated.venueAddress ||
          null,
      },
      request,
    });
  } catch (
    auditError
  ) {
    console.error(
      "[MATCH_VENUE_AUDIT_FAILED]",
      auditError
    );
  }

  return NextResponse.json({
    success:
      true,
    ...updated,
  });
}
