import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { normalizeKitPlayerName } from "@/lib/kit/name-normalization";

export const runtime = "nodejs";

function optionalPositiveInteger(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) &&
    parsedValue > 0
    ? parsedValue
    : null;
}

async function refreshRotationMemberStats(
  tx,
  rotationMemberId
) {
  if (!rotationMemberId) {
    return;
  }

  const [completedCount, latestPickup] =
    await Promise.all([
      tx.kitAssignment.count({
        where: {
          pickupStatus: "TOOK_KIT",
          actualRotationMemberId:
            rotationMemberId,
        },
      }),
      tx.kitAssignment.findFirst({
        where: {
          pickupStatus: "TOOK_KIT",
          actualRotationMemberId:
            rotationMemberId,
        },
        orderBy: [
          { pickupRecordedAt: "desc" },
          { id: "desc" },
        ],
        select: {
          pickupRecordedAt: true,
        },
      }),
    ]);

  await tx.kitRotationMember.update({
    where: {
      id: rotationMemberId,
    },
    data: {
      completedCount,
      lastCompletedAt:
        latestPickup?.pickupRecordedAt || null,
    },
  });
}

export async function PATCH(request, { params }) {
  try {
    const { id, teamId: teamIdParam } =
      await params;

    const matchId = Number(id);
    const teamId = Number(teamIdParam);

    if (
      !Number.isInteger(matchId) ||
      matchId <= 0 ||
      !Number.isInteger(teamId) ||
      teamId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid match or team id.",
        },
        { status: 400 }
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const pickupStatus = String(
      body?.pickupStatus || ""
    )
      .trim()
      .toUpperCase();

    if (
      ![
        "TOOK_KIT",
        "DID_NOT_TAKE_KIT",
      ].includes(pickupStatus)
    ) {
      return NextResponse.json(
        {
          error:
            "Select whether someone took the kit.",
        },
        { status: 400 }
      );
    }

    const requestedMatchKitPlayerId =
      optionalPositiveInteger(
        body?.actualMatchKitPlayerId
      );

    const requestedDisplayName = String(
      body?.actualDisplayName || ""
    ).trim();

    const assignment =
      await prisma.kitAssignment.findFirst({
        where: {
          matchId,
          teamId,
        },
        include: {
          league: {
            select: {
              id: true,
              kitRotationMode: true,
            },
          },
          rotationMember: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      });

    if (!assignment) {
      return NextResponse.json(
        {
          error:
            "No kit assignment was found for this team.",
        },
        { status: 404 }
      );
    }

    if (
      pickupStatus === "TOOK_KIT" &&
      !requestedDisplayName
    ) {
      return NextResponse.json(
        {
          error:
            "Enter the name of the person who actually took the kit.",
        },
        { status: 400 }
      );
    }

    let selectedMatchKitPlayer = null;

    if (
      pickupStatus === "TOOK_KIT" &&
      requestedMatchKitPlayerId
    ) {
      selectedMatchKitPlayer =
        await prisma.matchKitPlayer.findFirst({
          where: {
            id: requestedMatchKitPlayerId,
            matchId,
            isConfirmed: true,
            isEligible: true,
            ...(assignment.league
              .kitRotationMode === "TEAM"
              ? { teamId }
              : {}),
          },
          select: {
            id: true,
            teamId: true,
            playerId: true,
            displayName: true,
            normalizedName: true,
          },
        });

      if (!selectedMatchKitPlayer) {
        return NextResponse.json(
          {
            error:
              "The selected player is not eligible for this kit rotation.",
          },
          { status: 400 }
        );
      }
    }

    const normalizedActualName =
      pickupStatus === "TOOK_KIT"
        ? normalizeKitPlayerName(
            requestedDisplayName
          )
        : null;

    if (
      pickupStatus === "TOOK_KIT" &&
      !normalizedActualName
    ) {
      return NextResponse.json(
        {
          error:
            "Enter a valid name for the person who actually took the kit.",
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const previousActualMemberId =
          assignment.actualRotationMemberId;

        let actualRotationMember = null;
        let actualMatchKitPlayerId = null;

        if (pickupStatus === "TOOK_KIT") {
          const selectedPlayerMatchesName =
            selectedMatchKitPlayer &&
            selectedMatchKitPlayer.normalizedName ===
              normalizedActualName;

          actualMatchKitPlayerId =
            selectedPlayerMatchesName
              ? selectedMatchKitPlayer.id
              : null;

          actualRotationMember =
            await tx.kitRotationMember.upsert({
              where: {
                rotationKey_normalizedName: {
                  rotationKey:
                    assignment.rotationKey,
                  normalizedName:
                    normalizedActualName,
                },
              },
              update: {
                displayName:
                  requestedDisplayName,
                ...(selectedPlayerMatchesName &&
                selectedMatchKitPlayer?.playerId
                  ? {
                      playerId:
                        selectedMatchKitPlayer.playerId,
                    }
                  : {}),
                isActive: true,
              },
              create: {
                leagueId: assignment.leagueId,
                rotationKey:
                  assignment.rotationKey,
                teamId:
                  assignment.league
                    .kitRotationMode === "TEAM"
                    ? assignment.teamId
                    : null,
                playerId:
                  selectedPlayerMatchesName
                    ? selectedMatchKitPlayer
                        ?.playerId || null
                    : null,
                displayName:
                  requestedDisplayName,
                normalizedName:
                  normalizedActualName,
                isActive: true,
              },
              select: {
                id: true,
                displayName: true,
              },
            });
        }

        const updatedAssignment =
          await tx.kitAssignment.update({
            where: {
              id: assignment.id,
            },
            data: {
              pickupStatus,
              actualRotationMemberId:
                pickupStatus === "TOOK_KIT"
                  ? actualRotationMember.id
                  : null,
              actualMatchKitPlayerId:
                pickupStatus === "TOOK_KIT"
                  ? actualMatchKitPlayerId
                  : null,
              actualDisplayName:
                pickupStatus === "TOOK_KIT"
                  ? requestedDisplayName
                  : null,
              pickupRecordedAt: new Date(),
            },
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
              rotationMember: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
              actualRotationMember: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
              actualMatchKitPlayer: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          });

        const affectedMemberIds = [
          previousActualMemberId,
          updatedAssignment.actualRotationMemberId,
        ].filter(Boolean);

        for (const memberId of [
          ...new Set(affectedMemberIds),
        ]) {
          await refreshRotationMemberStats(
            tx,
            memberId
          );
        }

        return updatedAssignment;
      }
    );

    return NextResponse.json({
      success: true,
      message:
        pickupStatus === "TOOK_KIT"
          ? `${requestedDisplayName} was recorded as the person who actually took the kit.`
          : "Recorded that nobody took the kit after the match.",
      assignment: result,
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
      { status: 500 }
    );
  }
}
