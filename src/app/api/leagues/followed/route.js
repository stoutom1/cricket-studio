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

export const runtime =
  "nodejs";

export async function GET() {
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
    return NextResponse.json({
      leagues: [],
    });
  }

  const rows =
    await prisma.leagueFollower.findMany({
      where: {
        userId:
          user.id,
        league: {
          visibility: {
            in: [
              "PUBLIC",
              "UNLISTED",
            ],
          },
        },
      },
      orderBy: {
        updatedAt:
          "desc",
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        alertsEnabled: true,
        alertMatchStart: true,
        alertMatchResult: true,

        league: {
          select: {
            id: true,
            name: true,
            slug: true,
            visibility: true,

            _count: {
              select: {
                teams: true,
                matches: true,
              },
            },

            matches: {
              where: {
                status: {
                  in: [
                    "LIVE",
                    "IN_PROGRESS",
                    "STARTED",
                  ],
                },
              },
              take:
                3,
              orderBy: {
                scheduledAt:
                  "desc",
              },
              select: {
                id: true,
                shareCode: true,
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
            },
          },
        },
      },
    });

  return NextResponse.json({
    leagues:
      rows.map(
        (row) => ({
          followerId:
            row.id,
          followedAt:
            row.createdAt,
          alertsEnabled:
            row.alertsEnabled,
          alertMatchStart:
            row.alertMatchStart,
          alertMatchResult:
            row.alertMatchResult,

          id:
            row.league.id,
          name:
            row.league.name,
          slug:
            row.league.slug,
          visibility:
            row.league.visibility,
          teamCount:
            row.league
              ._count
              .teams,
          matchCount:
            row.league
              ._count
              .matches,
          liveMatches:
            row.league.matches,
        })
      ),
  });
}
