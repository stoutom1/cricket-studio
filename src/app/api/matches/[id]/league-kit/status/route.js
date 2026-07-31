import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";

export const runtime =
  "nodejs";

const SUPPORTED_ACTIONS =
  new Set([
    "COORDINATED",
    "HANDED_OVER",
    "AT_VENUE",
    "RESET_COORDINATION",
  ]);

function validPositiveInteger(
  value
) {
  const parsed =
    Number(value);

  return (
    Number.isInteger(parsed) &&
    parsed > 0
  );
}

export async function PATCH(
  request,
  {
    params,
  }
) {
  try {
    const {
      id,
    } = await params;

    const matchId =
      Number(id);

    if (
      !validPositiveInteger(
        matchId
      )
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

    let body;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid request body.",
        },
        {
          status:
            400,
        }
      );
    }

    const action =
      String(
        body?.action ||
          ""
      )
        .trim()
        .toUpperCase();

    if (
      !SUPPORTED_ACTIONS.has(
        action
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported league-kit status action.",
        },
        {
          status:
            400,
        }
      );
    }

    const assignment =
      await prisma
        .kitAssignment
        .findFirst({
          where: {
            matchId,

            leagueKitId: {
              not:
                null,
            },

            status: {
              not:
                "CANCELLED",
            },
          },

          orderBy: [
            {
              assignedAt:
                "desc",
            },
            {
              id:
                "desc",
            },
          ],

          select: {
            id:
              true,

            leagueId:
              true,

            leagueKitId:
              true,

            leagueKit: {
              select: {
                id:
                  true,

                status:
                  true,

                handoverStatus:
                  true,

                venueConfirmedAt:
                  true,
              },
            },
          },
        });

    if (
      !assignment
        ?.leagueKitId
    ) {
      return NextResponse.json(
        {
          error:
            "No shared league kit is assigned to this match.",
        },
        {
          status:
            404,
        }
      );
    }

    const now =
      new Date();

    let data;
    let message;

    if (
      action ===
      "COORDINATED"
    ) {
      data = {
        status:
          "AWAITING_COORDINATION",

        handoverStatus:
          "COORDINATED",

        handoverConfirmedAt:
          now,

        venueConfirmedAt:
          null,
      };

      message =
        "Kit coordination has been confirmed.";
    } else if (
      action ===
      "HANDED_OVER"
    ) {
      data = {
        status:
          "HANDOVER_CONFIRMED",

        handoverStatus:
          "HANDED_OVER",

        handoverConfirmedAt:
          now,

        venueConfirmedAt:
          null,
      };

      message =
        "Kit handover has been confirmed.";
    } else if (
      action ===
      "AT_VENUE"
    ) {
      data = {
        status:
          "AT_VENUE",

        handoverStatus:
          assignment
            .leagueKit
            ?.handoverStatus ===
          "NOT_REQUIRED"
            ? "NOT_REQUIRED"
            : "HANDED_OVER",

        handoverConfirmedAt:
          assignment
            .leagueKit
            ?.handoverStatus ===
          "NOT_REQUIRED"
            ? assignment
                .leagueKit
                ?.venueConfirmedAt ||
              null
            : now,

        venueConfirmedAt:
          now,
      };

      message =
        "The league kit is confirmed at the match venue.";
    } else {
      data = {
        status:
          assignment
            .leagueKit
            ?.status ===
          "UNASSIGNED"
            ? "UNASSIGNED"
            : "AWAITING_COORDINATION",

        handoverStatus:
          "PENDING",

        handoverConfirmedAt:
          null,

        venueConfirmedAt:
          null,
      };

      message =
        "Kit coordination and venue status have been reset.";
    }

    const eventTypeByAction = {
      COORDINATED:
        "COORDINATION_CONFIRMED",

      HANDED_OVER:
        "HANDOVER_CONFIRMED",

      AT_VENUE:
        "VENUE_CONFIRMED",

      RESET_COORDINATION:
        "STATUS_RESET",
    };

    const leagueKit =
      await prisma
        .$transaction(
          async (tx) => {
            const updated =
              await tx
                .leagueKit
                .update({
                  where: {
                    id:
                      assignment
                        .leagueKitId,
                  },

                  data,

                  include: {
                    currentHolderRotationMember:
                      {
                        select: {
                          id:
                            true,

                          displayName:
                            true,
                        },
                      },

                    previousHolderRotationMember:
                      {
                        select: {
                          id:
                            true,

                          displayName:
                            true,
                        },
                      },
                  },
                });

            await tx
              .leagueKitEvent
              .create({
                data: {
                  leagueKitId:
                    updated.id,

                  leagueId:
                    assignment
                      .leagueId,

                  matchId,

                  assignmentId:
                    assignment.id,

                  eventType:
                    eventTypeByAction[
                      action
                    ],

                  fromHolderRotationMemberId:
                    updated
                      .currentHolderRotationMember
                      ?.id ||
                    null,

                  toHolderRotationMemberId:
                    updated
                      .currentHolderRotationMember
                      ?.id ||
                    null,

                  fromHolderName:
                    updated
                      .currentHolderRotationMember
                      ?.displayName ||
                    null,

                  toHolderName:
                    updated
                      .currentHolderRotationMember
                      ?.displayName ||
                    null,

                  description:
                    message,

                  metadata: {
                    action,

                    statusBefore:
                      assignment
                        .leagueKit
                        ?.status ||
                      null,

                    statusAfter:
                      updated.status,

                    handoverStatusBefore:
                      assignment
                        .leagueKit
                        ?.handoverStatus ||
                      null,

                    handoverStatusAfter:
                      updated
                        .handoverStatus,

                    venueConfirmedAt:
                      updated
                        .venueConfirmedAt,
                  },

                  occurredAt:
                    now,
                },
              });

            return updated;
          }
        );

    return NextResponse.json({
      success:
        true,

      message,

      action,

      leagueKit,
    });
  } catch (error) {
    console.error(
      "[LEAGUE_KIT_STATUS_UPDATE_FAILED]",
      {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      }
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update the league-kit status.",
      },
      {
        status:
          500,
      }
    );
  }
}
