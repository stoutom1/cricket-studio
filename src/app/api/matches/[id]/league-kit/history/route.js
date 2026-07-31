import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";

export const runtime =
  "nodejs";

function positiveInteger(
  value,
  fallback
) {
  const parsed =
    Number(value);

  return (
    Number.isInteger(parsed) &&
    parsed > 0
      ? parsed
      : fallback
  );
}

export async function GET(
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

    const requestUrl =
      new URL(request.url);

    const limit =
      Math.min(
        positiveInteger(
          requestUrl
            .searchParams
            .get("limit"),
          30
        ),
        100
      );

    const match =
      await prisma
        .match
        .findUnique({
          where: {
            id:
              matchId,
          },

          select: {
            id:
              true,

            leagueId:
              true,

            league: {
              select: {
                id:
                  true,

                name:
                  true,
              },
            },

            kitAssignments: {
              where: {
                leagueKitId: {
                  not:
                    null,
                },
              },

              orderBy: {
                id:
                  "desc",
              },

              take:
                1,

              select: {
                id:
                  true,

                leagueKitId:
                  true,
              },
            },
          },
        });

    const leagueKitId =
      match
        ?.kitAssignments?.[0]
        ?.leagueKitId ||
      null;

    if (
      !match ||
      !match.leagueId ||
      !leagueKitId
    ) {
      return NextResponse.json({
        success:
          true,

        history:
          [],

        leagueKitId:
          null,
      });
    }

    const history =
      await prisma
        .leagueKitEvent
        .findMany({
          where: {
            leagueKitId,
          },

          orderBy: [
            {
              occurredAt:
                "desc",
            },
            {
              id:
                "desc",
            },
          ],

          take:
            limit,

          select: {
            id:
              true,

            eventType:
              true,

            fromHolderName:
              true,

            toHolderName:
              true,

            description:
              true,

            metadata:
              true,

            occurredAt:
              true,

            matchId:
              true,

            assignmentId:
              true,

            match: {
              select: {
                id:
                  true,

                scheduledAt:
                  true,

                teamA: {
                  select: {
                    id:
                      true,

                    name:
                      true,
                  },
                },

                teamB: {
                  select: {
                    id:
                      true,

                    name:
                      true,
                  },
                },
              },
            },
          },
        });

    const [
      completedCustodyEvents,
      assignmentEvents,
      missedCustodyEvents,
      rotationMembers,
    ] = await Promise.all([
      prisma.leagueKitEvent.findMany({
        where: {
          leagueKitId,
          eventType:
            "CUSTODY_TRANSFERRED",
        },
        select: {
          toHolderRotationMemberId:
            true,
          toHolderName:
            true,
          occurredAt:
            true,
        },
      }),

      prisma.leagueKitEvent.findMany({
        where: {
          leagueKitId,
          eventType: {
            in: [
              "ASSIGNMENT_CREATED",
              "ASSIGNMENT_CHANGED",
            ],
          },
        },
        select: {
          toHolderRotationMemberId:
            true,
          toHolderName:
            true,
          occurredAt:
            true,
        },
      }),

      prisma.leagueKitEvent.count({
        where: {
          leagueKitId,
          eventType:
            "CUSTODY_NOT_TRANSFERRED",
        },
      }),

      prisma.kitRotationMember.findMany({
        where: {
          leagueId:
            match.leagueId,
          rotationKey:
            `LEAGUE:${match.leagueId}`,
          isActive:
            true,
        },
        select: {
          id:
            true,
          displayName:
            true,
          completedCount:
            true,
          lastCompletedAt:
            true,
          lastAssignedAt:
            true,
        },
        orderBy: [
          {
            completedCount:
              "asc",
          },
          {
            lastCompletedAt:
              "asc",
          },
          {
            displayName:
              "asc",
          },
        ],
      }),
    ]);

    const holderCountMap =
      new Map();

    for (
      const event
      of completedCustodyEvents
    ) {
      const key =
        event
          .toHolderRotationMemberId ||
        event.toHolderName ||
        "UNKNOWN";

      const existing =
        holderCountMap.get(
          key
        ) || {
          rotationMemberId:
            event
              .toHolderRotationMemberId ||
            null,
          displayName:
            event
              .toHolderName ||
            "Unknown",
          completedCount:
            0,
          lastCompletedAt:
            null,
        };

      existing.completedCount +=
        1;

      if (
        !existing.lastCompletedAt ||
        new Date(
          event.occurredAt
        ) >
          new Date(
            existing.lastCompletedAt
          )
      ) {
        existing.lastCompletedAt =
          event.occurredAt;
      }

      holderCountMap.set(
        key,
        existing
      );
    }

    const assignmentCountMap =
      new Map();

    for (
      const event
      of assignmentEvents
    ) {
      const key =
        event
          .toHolderRotationMemberId ||
        event.toHolderName ||
        "UNKNOWN";

      const existing =
        assignmentCountMap.get(
          key
        ) || {
          assignedCount:
            0,
          lastAssignedAt:
            null,
        };

      existing.assignedCount +=
        1;

      if (
        !existing.lastAssignedAt ||
        new Date(
          event.occurredAt
        ) >
          new Date(
            existing.lastAssignedAt
          )
      ) {
        existing.lastAssignedAt =
          event.occurredAt;
      }

      assignmentCountMap.set(
        key,
        existing
      );
    }

    const carrierAnalytics =
      rotationMembers.map(
        (member) => {
          const eventCompleted =
            holderCountMap.get(
              member.id
            );

          const eventAssignments =
            assignmentCountMap.get(
              member.id
            );

          return {
            rotationMemberId:
              member.id,

            displayName:
              member.displayName,

            assignedCount:
              eventAssignments
                ?.assignedCount ||
              0,

            completedCount:
              Math.max(
                Number(
                  member.completedCount ||
                    0
                ),
                Number(
                  eventCompleted
                    ?.completedCount ||
                    0
                )
              ),

            lastAssignedAt:
              member.lastAssignedAt ||
              eventAssignments
                ?.lastAssignedAt ||
              null,

            lastCompletedAt:
              member.lastCompletedAt ||
              eventCompleted
                ?.lastCompletedAt ||
              null,
          };
        }
      );

    const completedCounts =
      carrierAnalytics.map(
        (item) =>
          Number(
            item.completedCount ||
              0
          )
      );

    const minimumCompleted =
      completedCounts.length
        ? Math.min(
            ...completedCounts
          )
        : 0;

    const maximumCompleted =
      completedCounts.length
        ? Math.max(
            ...completedCounts
          )
        : 0;

    const totalCompleted =
      completedCounts.reduce(
        (sum, value) =>
          sum + value,
        0
      );

    const analytics = {
      totalCustodyTransfers:
        completedCustodyEvents.length,

      totalAssignments:
        assignmentEvents.length,

      custodyNotTransferred:
        missedCustodyEvents,

      activeRotationMembers:
        carrierAnalytics.length,

      minimumCompleted,

      maximumCompleted,

      completionSpread:
        maximumCompleted -
        minimumCompleted,

      averageCompleted:
        carrierAnalytics.length
          ? Number(
              (
                totalCompleted /
                carrierAnalytics.length
              ).toFixed(2)
            )
          : 0,

      fairnessStatus:
        maximumCompleted -
          minimumCompleted <=
        1
          ? "BALANCED"
          : "NEEDS_ATTENTION",

      carriers:
        carrierAnalytics,
    };

    return NextResponse.json({
      success:
        true,

      leagueKitId,

      league: {
        id:
          match.league.id,

        name:
          match.league.name,
      },

      history,

      analytics,
    });
  } catch (error) {
    console.error(
      "[LEAGUE_KIT_HISTORY_FAILED]",
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
            : "Unable to load league-kit history.",
      },
      {
        status:
          500,
      }
    );
  }
}
