import {
  getServerSession,
} from "next-auth";
import {
  NextResponse,
} from "next/server";
import prisma from "@/lib/prisma";
import {
  authOptions,
} from "@/lib/auth";
import {
  analyzeMatchRepair,
} from "@/lib/match-repair";

export const runtime =
  "nodejs";
export const dynamic =
  "force-dynamic";

async function getAuthorizedMatch({
  matchId,
  email,
}) {
  const user =
    await prisma.user
      .findUnique({
        where: {
          email,
        },

        select: {
          id: true,
        },
      });

  if (!user) {
    return {
      error:
        "User not found.",
      status: 404,
    };
  }

  const match =
    await prisma.match
      .findUnique({
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
              id: true,
              name: true,
            },
          },

          teamB: {
            select: {
              id: true,
              name: true,
            },
          },

          balls: {
            orderBy: [
              {
                inningsNo:
                  "asc",
              },

              {
                sequence:
                  "asc",
              },

              {
                id:
                  "asc",
              },
            ],
          },
        },
      });

  if (!match) {
    return {
      error:
        "Match not found.",
      status: 404,
    };
  }

  const isOwner =
    match.league
      ?.ownerId ===
    user.id;

  const membership =
    isOwner
      ? null
      : await prisma
          .leagueMember
          .findUnique({
            where: {
              userId_leagueId: {
                userId:
                  user.id,

                leagueId:
                  match.leagueId,
              },
            },

            select: {
              role: true,
              canScoreMatch:
                true,
              canEditMatch:
                true,
              canManagePermissions:
                true,
            },
          });

  const role =
    String(
      membership?.role ||
      ""
    ).toUpperCase();

  const authorized =
    isOwner ||
    role === "ADMIN" ||
    membership
      ?.canScoreMatch ===
      true ||
    membership
      ?.canEditMatch ===
      true ||
    membership
      ?.canManagePermissions ===
      true;

  if (!authorized) {
    return {
      error:
        "You do not have permission to repair this match.",
      status: 403,
    };
  }

  return {
    user,
    match,
    isOwner,
    membership,
  };
}

function parseMatchId(
  value
) {
  const matchId =
    Number(value);

  return Number.isInteger(
    matchId
  ) &&
    matchId > 0
    ? matchId
    : null;
}

export async function GET(
  request,
  { params }
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
        status: 401,
      }
    );
  }

  const {
    id,
  } = await params;

  const matchId =
    parseMatchId(id);

  if (!matchId) {
    return NextResponse.json(
      {
        error:
          "Invalid match id.",
      },
      {
        status: 400,
      }
    );
  }

  const access =
    await getAuthorizedMatch({
      matchId,
      email:
        session.user.email,
    });

  if (access.error) {
    return NextResponse.json(
      {
        error:
          access.error,
      },
      {
        status:
          access.status,
      }
    );
  }

  const analysis =
    analyzeMatchRepair(
      access.match.balls
    );

  return NextResponse.json({
    success: true,

    mode:
      "PREVIEW",

    match: {
      id:
        access.match.id,

      status:
        access.match.status,

      leagueId:
        access.match.leagueId,

      leagueName:
        access.match.league
          ?.name ||
        "",

      teamA:
        access.match.teamA
          ?.name ||
        "Team A",

      teamB:
        access.match.teamB
          ?.name ||
        "Team B",

      ballCount:
        access.match.balls
          .length,
    },

    analysis,
  });
}

export async function POST(
  request,
  { params }
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
        status: 401,
      }
    );
  }

  const {
    id,
  } = await params;

  const matchId =
    parseMatchId(id);

  if (!matchId) {
    return NextResponse.json(
      {
        error:
          "Invalid match id.",
      },
      {
        status: 400,
      }
    );
  }

  const body =
    await request
      .json()
      .catch(
        () => ({})
      );

  if (
    body.action !==
      "APPLY_SAFE_REPAIR" ||
    Number(
      body.confirmMatchId
    ) !==
      matchId
  ) {
    return NextResponse.json(
      {
        error:
          "Repair confirmation is invalid.",
      },
      {
        status: 400,
      }
    );
  }

  const access =
    await getAuthorizedMatch({
      matchId,
      email:
        session.user.email,
    });

  if (access.error) {
    return NextResponse.json(
      {
        error:
          access.error,
      },
      {
        status:
          access.status,
      }
    );
  }

  const analysis =
    analyzeMatchRepair(
      access.match.balls
    );

  if (
    !analysis.canApply
  ) {
    return NextResponse.json({
      success: true,

      applied: 0,

      message:
        "No high-confidence repairs were found.",

      analysis,
    });
  }

  const result =
    await prisma
      .$transaction(
        async (
          transaction
        ) => {
          for (
            const change of
            analysis.safeChanges
          ) {
            await transaction
              .ball.update({
                where: {
                  id:
                    change.id,
                },

                data:
                  change.data,
              });
          }

          /*
           * The old review may contain statistics generated from corrupted
           * delivery state. Clear only this match's cache.
           */
          await transaction
            .match.update({
              where: {
                id:
                  matchId,
              },

              data: {
                aiAnalysis:
                  null,

                aiAnalysisAt:
                  null,
              },
            });

          return {
            applied:
              analysis
                .safeChanges
                .length,
          };
        }
      );

  const repairedBalls =
    await prisma.ball
      .findMany({
        where: {
          matchId,
        },

        orderBy: [
          {
            inningsNo:
              "asc",
          },

          {
            sequence:
              "asc",
          },

          {
            id:
              "asc",
          },
        ],
      });

  const after =
    analyzeMatchRepair(
      repairedBalls
    );

  return NextResponse.json({
    success: true,

    applied:
      result.applied,

    clearedAiReview:
      true,

    message:
      `${result.applied} high-confidence repair(s) applied. The AI Review cache was cleared for this match.`,

    before:
      analysis,

    after,
  });
}
