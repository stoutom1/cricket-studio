import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";

import {
  normalizeKitPlayerName,
} from "@/lib/kit/name-normalization";

export const runtime =
  "nodejs";

function optionalPositiveInteger(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsedValue =
    Number(value);

  return (
    Number.isInteger(
      parsedValue
    ) &&
    parsedValue > 0
      ? parsedValue
      : null
  );
}

async function refreshRotationMemberStats(
  tx,
  rotationMemberId
) {
  if (!rotationMemberId) {
    return;
  }

  const [
    completedCount,
    latestPickup,
  ] = await Promise.all([
    tx.kitAssignment.count({
      where: {
        pickupStatus:
          "TOOK_KIT",

        actualRotationMemberId:
          rotationMemberId,
      },
    }),

    tx.kitAssignment.findFirst({
      where: {
        pickupStatus:
          "TOOK_KIT",

        actualRotationMemberId:
          rotationMemberId,
      },

      orderBy: [
        {
          pickupRecordedAt:
            "desc",
        },
        {
          id:
            "desc",
        },
      ],

      select: {
        pickupRecordedAt:
          true,
      },
    }),
  ]);

  await tx
    .kitRotationMember
    .update({
      where: {
        id:
          rotationMemberId,
      },

      data: {
        completedCount,

        lastCompletedAt:
          latestPickup
            ?.pickupRecordedAt ||
          null,
      },
    });
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
      teamId:
        teamIdParam,
    } = await params;

    const matchId =
      Number(id);

    const teamId =
      Number(teamIdParam);

    if (
      !Number.isInteger(
        matchId
      ) ||
      matchId <= 0 ||
      !Number.isInteger(
        teamId
      ) ||
      teamId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid match or team id.",
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

    const pickupStatus =
      String(
        body?.pickupStatus ||
          ""
      )
        .trim()
        .toUpperCase();

    if (
      ![
        "TOOK_KIT",
        "DID_NOT_TAKE_KIT",
      ].includes(
        pickupStatus
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Select whether someone took the kit.",
        },
        {
          status:
            400,
        }
      );
    }

    const requestedMatchKitPlayerId =
      optionalPositiveInteger(
        body
          ?.actualMatchKitPlayerId
      );

    const requestedDisplayName =
      String(
        body
          ?.actualDisplayName ||
          ""
      ).trim();

    const assignment =
      await prisma
        .kitAssignment
        .findFirst({
          where: {
            matchId,
            teamId,

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

          include: {
            league: {
              select: {
                id:
                  true,

                kitRotationMode:
                  true,
              },
            },

            leagueKit: {
              select: {
                id:
                  true,

                currentHolderRotationMemberId:
                  true,

                previousHolderRotationMemberId:
                  true,
              },
            },

            rotationMember: {
              select: {
                id:
                  true,

                displayName:
                  true,
              },
            },
          },
        });

    if (!assignment) {
      return NextResponse.json(
        {
          error:
            "No active kit assignment was found.",
        },
        {
          status:
            404,
        }
      );
    }

    if (
      pickupStatus ===
        "TOOK_KIT" &&
      !requestedDisplayName
    ) {
      return NextResponse.json(
        {
          error:
            "Enter the name of the person who actually took the kit.",
        },
        {
          status:
            400,
        }
      );
    }

    let selectedMatchKitPlayer =
      null;

    if (
      pickupStatus ===
        "TOOK_KIT" &&
      requestedMatchKitPlayerId
    ) {
      selectedMatchKitPlayer =
        await prisma
          .matchKitPlayer
          .findFirst({
            where: {
              id:
                requestedMatchKitPlayerId,

              matchId,

              isConfirmed:
                true,

              isEligible:
                true,

              ...(assignment
                .league
                .kitRotationMode ===
              "TEAM"
                ? {
                    teamId,
                  }
                : {}),
            },

            select: {
              id:
                true,

              teamId:
                true,

              playerId:
                true,

              displayName:
                true,

              normalizedName:
                true,
            },
          });

      if (
        !selectedMatchKitPlayer
      ) {
        return NextResponse.json(
          {
            error:
              "The selected player is not eligible for this kit rotation.",
          },
          {
            status:
              400,
          }
        );
      }
    }

    const normalizedActualName =
      pickupStatus ===
      "TOOK_KIT"
        ? normalizeKitPlayerName(
            requestedDisplayName
          )
        : null;

    if (
      pickupStatus ===
        "TOOK_KIT" &&
      !normalizedActualName
    ) {
      return NextResponse.json(
        {
          error:
            "Enter a valid name for the person who actually took the kit.",
        },
        {
          status:
            400,
        }
      );
    }

    const recordedAt =
      new Date();

    const result =
      await prisma
        .$transaction(
          async (tx) => {
            const previousActualMemberId =
              assignment
                .actualRotationMemberId;

            let actualRotationMember =
              null;

            let actualMatchKitPlayerId =
              null;

            if (
              pickupStatus ===
              "TOOK_KIT"
            ) {
              const selectedPlayerMatchesName =
                selectedMatchKitPlayer &&
                selectedMatchKitPlayer
                  .normalizedName ===
                  normalizedActualName;

              actualMatchKitPlayerId =
                selectedPlayerMatchesName
                  ? selectedMatchKitPlayer
                      .id
                  : null;

              actualRotationMember =
                await tx
                  .kitRotationMember
                  .upsert({
                    where: {
                      rotationKey_normalizedName:
                        {
                          rotationKey:
                            assignment
                              .rotationKey,

                          normalizedName:
                            normalizedActualName,
                        },
                    },

                    update: {
                      displayName:
                        requestedDisplayName,

                      ...(selectedPlayerMatchesName &&
                      selectedMatchKitPlayer
                        ?.playerId
                        ? {
                            playerId:
                              selectedMatchKitPlayer
                                .playerId,
                          }
                        : {}),

                      isActive:
                        true,
                    },

                    create: {
                      leagueId:
                        assignment
                          .leagueId,

                      rotationKey:
                        assignment
                          .rotationKey,

                      teamId:
                        assignment
                          .league
                          .kitRotationMode ===
                        "TEAM"
                          ? assignment
                              .teamId
                          : null,

                      playerId:
                        selectedPlayerMatchesName
                          ? selectedMatchKitPlayer
                              ?.playerId ||
                            null
                          : null,

                      displayName:
                        requestedDisplayName,

                      normalizedName:
                        normalizedActualName,

                      isActive:
                        true,
                    },

                    select: {
                      id:
                        true,

                      displayName:
                        true,
                    },
                  });
            }

            const updatedAssignment =
              await tx
                .kitAssignment
                .update({
                  where: {
                    id:
                      assignment.id,
                  },

                  data: {
                    pickupStatus,

                    actualRotationMemberId:
                      pickupStatus ===
                      "TOOK_KIT"
                        ? actualRotationMember
                            .id
                        : null,

                    actualMatchKitPlayerId:
                      pickupStatus ===
                      "TOOK_KIT"
                        ? actualMatchKitPlayerId
                        : null,

                    actualDisplayName:
                      pickupStatus ===
                      "TOOK_KIT"
                        ? requestedDisplayName
                        : null,

                    pickupRecordedAt:
                      recordedAt,

                    completedAt:
                      pickupStatus ===
                      "TOOK_KIT"
                        ? recordedAt
                        : null,
                  },

                  include: {
                    team: {
                      select: {
                        id:
                          true,

                        name:
                          true,
                      },
                    },

                    rotationMember: {
                      select: {
                        id:
                          true,

                        displayName:
                          true,
                      },
                    },

                    actualRotationMember:
                      {
                        select: {
                          id:
                            true,

                          displayName:
                            true,
                        },
                      },

                    actualMatchKitPlayer:
                      {
                        select: {
                          id:
                            true,

                          displayName:
                            true,
                        },
                      },

                    leagueKit: {
                      include: {
                        currentHolderRotationMember:
                          {
                            select:
                              {
                                id:
                                  true,

                                displayName:
                                  true,
                              },
                          },

                        previousHolderRotationMember:
                          {
                            select:
                              {
                                id:
                                  true,

                                displayName:
                                  true,
                              },
                          },
                      },
                    },
                  },
                });

            /*
             * For one shared league kit, the actual carrier
             * becomes the authoritative current holder for
             * the next match.
             *
             * The old current holder is retained as the
             * previous holder. The original assignment is
             * never overwritten.
             */
            if (
              assignment
                .leagueKitId &&
              pickupStatus ===
                "TOOK_KIT"
            ) {
              const oldHolderId =
                assignment
                  .leagueKit
                  ?.currentHolderRotationMemberId ||
                null;

              const oldHolder =
                oldHolderId
                  ? await tx
                      .kitRotationMember
                      .findUnique({
                        where: {
                          id:
                            oldHolderId,
                        },

                        select: {
                          id:
                            true,

                          displayName:
                            true,
                        },
                      })
                  : null;

              const updatedKit =
                await tx
                  .leagueKit
                  .update({
                    where: {
                      id:
                        assignment
                          .leagueKitId,
                    },

                    data: {
                      previousHolderRotationMemberId:
                        oldHolderId ||
                        assignment
                          .leagueKit
                          ?.previousHolderRotationMemberId ||
                        null,

                      currentHolderRotationMemberId:
                        actualRotationMember
                          .id,

                      status:
                        "WITH_HOLDER",

                      handoverStatus:
                        "NOT_REQUIRED",

                      holderConfirmedAt:
                        recordedAt,

                      handoverConfirmedAt:
                        null,

                      venueConfirmedAt:
                        null,
                    },

                    select: {
                      id:
                        true,

                      status:
                        true,

                      handoverStatus:
                        true,
                    },
                  });

              await tx
                .leagueKitEvent
                .create({
                  data: {
                    leagueKitId:
                      assignment
                        .leagueKitId,

                    leagueId:
                      assignment
                        .leagueId,

                    matchId:
                      assignment
                        .matchId,

                    assignmentId:
                      assignment
                        .id,

                    eventType:
                      "CUSTODY_TRANSFERRED",

                    fromHolderRotationMemberId:
                      oldHolder?.id ||
                      null,

                    toHolderRotationMemberId:
                      actualRotationMember
                        .id,

                    fromHolderName:
                      oldHolder
                        ?.displayName ||
                      null,

                    toHolderName:
                      requestedDisplayName,

                    description:
                      `${requestedDisplayName} was recorded as the current holder of the shared league kit after the match.`,

                    metadata: {
                      pickupStatus,

                      assignedCarrierName:
                        assignment
                          .rotationMember
                          ?.displayName ||
                        null,

                      actualMatchKitPlayerId:
                        actualMatchKitPlayerId,

                      statusAfter:
                        updatedKit
                          .status,

                      handoverStatusAfter:
                        updatedKit
                          .handoverStatus,
                    },

                    occurredAt:
                      recordedAt,
                  },
                });
            } else if (
              assignment
                .leagueKitId &&
              pickupStatus ===
                "DID_NOT_TAKE_KIT"
            ) {
              const currentHolderId =
                assignment
                  .leagueKit
                  ?.currentHolderRotationMemberId ||
                null;

              const currentHolder =
                currentHolderId
                  ? await tx
                      .kitRotationMember
                      .findUnique({
                        where: {
                          id:
                            currentHolderId,
                        },

                        select: {
                          id:
                            true,

                          displayName:
                            true,
                        },
                      })
                  : null;

              await tx
                .leagueKitEvent
                .create({
                  data: {
                    leagueKitId:
                      assignment
                        .leagueKitId,

                    leagueId:
                      assignment
                        .leagueId,

                    matchId:
                      assignment
                        .matchId,

                    assignmentId:
                      assignment
                        .id,

                    eventType:
                      "CUSTODY_NOT_TRANSFERRED",

                    fromHolderRotationMemberId:
                      currentHolder
                        ?.id ||
                      null,

                    toHolderRotationMemberId:
                      currentHolder
                        ?.id ||
                      null,

                    fromHolderName:
                      currentHolder
                        ?.displayName ||
                      null,

                    toHolderName:
                      currentHolder
                        ?.displayName ||
                      null,

                    description:
                      "Nobody was recorded as taking the shared league kit after the match.",

                    metadata: {
                      pickupStatus,

                      assignedCarrierName:
                        assignment
                          .rotationMember
                          ?.displayName ||
                        null,
                    },

                    occurredAt:
                      recordedAt,
                  },
                });
            }

            const affectedMemberIds =
              [
                previousActualMemberId,

                updatedAssignment
                  .actualRotationMemberId,
              ].filter(Boolean);

            for (
              const memberId
              of [
                ...new Set(
                  affectedMemberIds
                ),
              ]
            ) {
              await refreshRotationMemberStats(
                tx,
                memberId
              );
            }

            return tx
              .kitAssignment
              .findUnique({
                where: {
                  id:
                    assignment.id,
                },

                include: {
                  team: {
                    select: {
                      id:
                        true,

                      name:
                        true,
                    },
                  },

                  rotationMember: {
                    select: {
                      id:
                        true,

                      displayName:
                        true,
                    },
                  },

                  actualRotationMember:
                    {
                      select: {
                        id:
                          true,

                        displayName:
                          true,
                      },
                    },

                  actualMatchKitPlayer:
                    {
                      select: {
                        id:
                          true,

                        displayName:
                          true,
                      },
                    },

                  leagueKit: {
                    include: {
                      currentHolderRotationMember:
                        {
                          select:
                            {
                              id:
                                true,

                              displayName:
                                true,
                            },
                        },

                      previousHolderRotationMember:
                        {
                          select:
                            {
                              id:
                                true,

                              displayName:
                                true,
                            },
                        },
                    },
                  },
                },
              });
          }
        );

    return NextResponse.json({
      success:
        true,

      message:
        pickupStatus ===
        "TOOK_KIT"
          ? assignment
              .leagueKitId
            ? `${requestedDisplayName} is now recorded as the current holder of the shared league kit.`
            : `${requestedDisplayName} was recorded as the person who actually took the kit.`
          : "Recorded that nobody took the kit after the match.",

      assignment:
        result,

      leagueKit:
        result?.leagueKit ||
        null,
    });
  } catch (error) {
    console.error(
      "Unable to record kit pickup:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to record kit pickup.",
      },
      {
        status:
          500,
      }
    );
  }
}
