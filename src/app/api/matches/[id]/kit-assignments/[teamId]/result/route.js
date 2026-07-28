import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const ALLOWED_RESULTS = new Set([
  "COMPLETED",
  "MISSED",
]);

function normalizeResult(value) {
  return String(value || "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

export async function PATCH(
  request,
  { params }
) {
  try {
    const {
      id,
      teamId: teamIdParam,
    } = await params;

    const matchId = Number(id);
    const teamId = Number(teamIdParam);

    if (
      !Number.isInteger(matchId) ||
      matchId <= 0
    ) {
      return NextResponse.json(
        {
          error: "Invalid match id.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isInteger(teamId) ||
      teamId <= 0
    ) {
      return NextResponse.json(
        {
          error: "Invalid team id.",
        },
        {
          status: 400,
        }
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid request body.",
        },
        {
          status: 400,
        }
      );
    }

    const result = normalizeResult(
      body?.result || body?.status
    );

    if (!ALLOWED_RESULTS.has(result)) {
      return NextResponse.json(
        {
          error:
            'Result must be either "COMPLETED" or "MISSED".',
        },
        {
          status: 400,
        }
      );
    }

    const ownerNote = String(
      body?.ownerNote || ""
    ).trim();

    const match =
      await prisma.match.findUnique({
        where: {
          id: matchId,
        },

        select: {
          id: true,
          status: true,
          teamAId: true,
          teamBId: true,

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
        },
      });

    if (!match) {
      return NextResponse.json(
        {
          error: "Match not found.",
        },
        {
          status: 404,
        }
      );
    }

    const permittedTeamIds = new Set([
      Number(match.teamAId),
      Number(match.teamBId),
    ]);

    if (!permittedTeamIds.has(teamId)) {
      return NextResponse.json(
        {
          error:
            "The selected team is not playing in this match.",
        },
        {
          status: 400,
        }
      );
    }

    const resultTimestamp = new Date();

    const transactionResult =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Locking the row directly is database-specific.
           * Instead, read and update within one transaction,
           * while making the operation idempotent.
           */
          const assignment =
            await tx.kitAssignment.findUnique({
              where: {
                matchId_teamId: {
                  matchId,
                  teamId,
                },
              },

              select: {
                id: true,
                leagueId: true,
                matchId: true,
                teamId: true,
                status: true,
                rotationMemberId: true,
                matchKitPlayerId: true,
                completedAt: true,
                missedAt: true,

                rotationMember: {
                  select: {
                    id: true,
                    displayName: true,
                    normalizedName: true,
                    completedCount: true,
                    lastCompletedAt: true,
                    rotationKey: true,
                  },
                },

                team: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            });

          if (!assignment) {
            throw new Error(
              "Kit assignment was not found for this team."
            );
          }

          /*
           * Already completed:
           *
           * Return safely without incrementing the person's
           * completed count a second time.
           */
          if (
            assignment.status ===
              "COMPLETED" &&
            result === "COMPLETED"
          ) {
            return {
              assignment,
              alreadyProcessed: true,
              message:
                "This kit responsibility was already marked as completed.",
            };
          }

          /*
           * Already missed:
           *
           * Return safely when the same MISSED action is
           * submitted again.
           */
          if (
            assignment.status ===
              "MISSED" &&
            result === "MISSED"
          ) {
            return {
              assignment,
              alreadyProcessed: true,
              message:
                "This kit responsibility was already marked as missed.",
            };
          }

          /*
           * Correction:
           * COMPLETED -> MISSED
           *
           * Because completion previously incremented the
           * rotation history, reverse that increment.
           */
          if (
            assignment.status ===
              "COMPLETED" &&
            result === "MISSED"
          ) {
            await tx.kitRotationMember.update({
              where: {
                id:
                  assignment.rotationMemberId,
              },

              data: {
                completedCount: {
                  decrement: 1,
                },

                /*
                 * We cannot safely infer the previous completed
                 * assignment date without querying history.
                 * It is recalculated below.
                 */
                lastCompletedAt: null,
              },
            });

            await tx.kitAssignment.update({
              where: {
                id: assignment.id,
              },

              data: {
                status: "MISSED",
                completedAt: null,
                missedAt:
                  resultTimestamp,

                ...(ownerNote
                  ? {
                      ownerNote,
                    }
                  : {}),
              },
            });

            /*
             * Recalculate the most recent valid completed
             * assignment for this person.
             */
            const previousCompletion =
              await tx.kitAssignment.findFirst({
                where: {
                  rotationMemberId:
                    assignment.rotationMemberId,

                  status: "COMPLETED",

                  id: {
                    not: assignment.id,
                  },
                },

                orderBy: [
                  {
                    completedAt: "desc",
                  },
                  {
                    id: "desc",
                  },
                ],

                select: {
                  completedAt: true,
                },
              });

            /*
             * Protect completedCount from becoming negative.
             */
            const refreshedMember =
              await tx.kitRotationMember.findUnique({
                where: {
                  id:
                    assignment.rotationMemberId,
                },

                select: {
                  completedCount: true,
                },
              });

            await tx.kitRotationMember.update({
              where: {
                id:
                  assignment.rotationMemberId,
              },

              data: {
                completedCount: Math.max(
                  0,
                  refreshedMember?.completedCount ||
                    0
                ),

                lastCompletedAt:
                  previousCompletion?.completedAt ||
                  null,
              },
            });

            const updatedAssignment =
              await tx.kitAssignment.findUnique({
                where: {
                  id: assignment.id,
                },

                include: {
                  team: true,
                  rotationMember: true,
                },
              });

            return {
              assignment:
                updatedAssignment,

              alreadyProcessed: false,

              message:
                "Kit responsibility changed from completed to missed.",
            };
          }

          /*
           * New completion or correction:
           * MISSED -> COMPLETED
           *
           * Both cases must increment the person's completed
           * history exactly once.
           */
          if (result === "COMPLETED") {
            await tx.kitAssignment.update({
              where: {
                id: assignment.id,
              },

              data: {
                status: "COMPLETED",
                completedAt:
                  resultTimestamp,
                missedAt: null,

                ...(ownerNote
                  ? {
                      ownerNote,
                    }
                  : {}),
              },
            });

            await tx.kitRotationMember.update({
              where: {
                id:
                  assignment.rotationMemberId,
              },

              data: {
                completedCount: {
                  increment: 1,
                },

                lastCompletedAt:
                  resultTimestamp,
              },
            });

            const updatedAssignment =
              await tx.kitAssignment.findUnique({
                where: {
                  id: assignment.id,
                },

                include: {
                  team: true,
                  rotationMember: true,
                },
              });

            return {
              assignment:
                updatedAssignment,

              alreadyProcessed: false,

              message:
                "Kit responsibility marked as completed.",
            };
          }

          /*
           * New MISSED result.
           *
           * A missed responsibility does not increment the
           * person's completed rotation count.
           */
          await tx.kitAssignment.update({
            where: {
              id: assignment.id,
            },

            data: {
              status: "MISSED",
              completedAt: null,
              missedAt: resultTimestamp,

              ...(ownerNote
                ? {
                    ownerNote,
                  }
                : {}),
            },
          });

          const updatedAssignment =
            await tx.kitAssignment.findUnique({
              where: {
                id: assignment.id,
              },

              include: {
                team: true,
                rotationMember: true,
              },
            });

          return {
            assignment:
              updatedAssignment,

            alreadyProcessed: false,

            message:
              "Kit responsibility marked as missed.",
          };
        }
      );

    return NextResponse.json({
      success: true,

      alreadyProcessed:
        transactionResult.alreadyProcessed,

      message:
        transactionResult.message,

      assignment:
        transactionResult.assignment,
    });
  } catch (error) {
    console.error(
      "Unable to update kit assignment result:",
      error
    );

    if (
      error?.message ===
      "Kit assignment was not found for this team."
    ) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to update the kit assignment result.",
      },
      {
        status: 500,
      }
    );
  }
}