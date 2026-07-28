import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
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

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0
  ) {
    return null;
  }

  return parsedValue;
}

export async function PATCH(request, { params }) {
  try {
    const { assignmentId: assignmentIdParam } =
      await params;

    const assignmentId = Number(
      assignmentIdParam
    );

    if (
      !Number.isInteger(assignmentId) ||
      assignmentId <= 0
    ) {
      return NextResponse.json(
        {
          error: "Invalid kit assignment id.",
        },
        {
          status: 400,
        }
      );
    }

    const session = await getServerSession(
      authOptions
    );

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error:
            "You must be signed in to record kit pickup.",
        },
        {
          status: 401,
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

    const pickupStatus = String(
      body?.pickupStatus || ""
    )
      .trim()
      .toUpperCase();

    const validPickupStatuses = new Set([
      "TOOK_KIT",
      "DID_NOT_TAKE_KIT",
    ]);

    if (
      !validPickupStatuses.has(pickupStatus)
    ) {
      return NextResponse.json(
        {
          error:
            "Select whether someone took the kit.",
        },
        {
          status: 400,
        }
      );
    }

    const requestedRotationMemberId =
      optionalPositiveInteger(
        body?.actualRotationMemberId
      );

    const requestedMatchKitPlayerId =
      optionalPositiveInteger(
        body?.actualMatchKitPlayerId
      );

    const requestedActualDisplayName =
      String(
        body?.actualDisplayName || ""
      ).trim();

    const assignment =
      await prisma.kitAssignment.findUnique({
        where: {
          id: assignmentId,
        },

        include: {
          league: {
            select: {
              id: true,
              name: true,
              kitRotationMode: true,
            },
          },

          team: {
            select: {
              id: true,
              name: true,
            },
          },

          match: {
            select: {
              id: true,
              teamAId: true,
              teamBId: true,
            },
          },

          rotationMember: {
            select: {
              id: true,
              playerId: true,
              displayName: true,
              normalizedName: true,
              rotationKey: true,
            },
          },
        },
      });

    if (!assignment) {
      return NextResponse.json(
        {
          error: "Kit assignment not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Nobody took the kit.
     *
     * Clear all actual-carrier fields.
     */
    if (
      pickupStatus ===
      "DID_NOT_TAKE_KIT"
    ) {
      const updatedAssignment =
        await prisma.kitAssignment.update({
          where: {
            id: assignment.id,
          },

          data: {
            pickupStatus:
              "DID_NOT_TAKE_KIT",

            actualRotationMemberId: null,
            actualMatchKitPlayerId: null,
            actualDisplayName: null,

            pickupRecordedAt: new Date(),
            pickupRecordedById:
              session.user.id,
          },

          include: {
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
          },
        });

      return NextResponse.json({
        success: true,

        message:
          "Recorded that nobody took the kit after the match.",

        assignment: updatedAssignment,
      });
    }

    /*
     * TOOK_KIT requires either:
     *
     * 1. An eligible rotation member, or
     * 2. A manually entered actual carrier name.
     */
    if (
      !requestedRotationMemberId &&
      !requestedActualDisplayName
    ) {
      return NextResponse.json(
        {
          error:
            "Select or enter the name of the person who actually took the kit.",
        },
        {
          status: 400,
        }
      );
    }

    let actualRotationMember = null;

    if (requestedRotationMemberId) {
      actualRotationMember =
        await prisma.kitRotationMember.findFirst({
          where: {
            id: requestedRotationMemberId,
            rotationKey:
              assignment.rotationKey,
            isActive: true,
          },

          select: {
            id: true,
            playerId: true,
            displayName: true,
            normalizedName: true,
            rotationKey: true,
          },
        });

      if (!actualRotationMember) {
        return NextResponse.json(
          {
            error:
              "The selected person is not eligible for this kit rotation.",
          },
          {
            status: 400,
          }
        );
      }
    }

    let actualMatchKitPlayer = null;

    if (requestedMatchKitPlayerId) {
      actualMatchKitPlayer =
        await prisma.matchKitPlayer.findFirst({
          where: {
            id: requestedMatchKitPlayerId,
            matchId: assignment.matchId,
            isEligible: true,
          },

          select: {
            id: true,
            teamId: true,
            playerId: true,
            displayName: true,
            normalizedName: true,
          },
        });

      if (!actualMatchKitPlayer) {
        return NextResponse.json(
          {
            error:
              "The selected match player is not eligible for this match.",
          },
          {
            status: 400,
          }
        );
      }
    }

    const finalActualDisplayName =
      requestedActualDisplayName ||
      actualRotationMember?.displayName ||
      actualMatchKitPlayer?.displayName ||
      "";

    if (!finalActualDisplayName.trim()) {
      return NextResponse.json(
        {
          error:
            "Enter the name of the person who actually took the kit.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * When a known rotation member was selected,
     * use the official server-side name.
     *
     * When the user edits the name manually,
     * preserve the edited value.
     */
    const normalizedActualName =
      normalizeKitPlayerName(
        finalActualDisplayName
      );

    if (!normalizedActualName) {
      return NextResponse.json(
        {
          error:
            "Enter a valid actual kit carrier name.",
        },
        {
          status: 400,
        }
      );
    }

    const updatedAssignment =
      await prisma.kitAssignment.update({
        where: {
          id: assignment.id,
        },

        data: {
          pickupStatus: "TOOK_KIT",

          actualRotationMemberId:
            actualRotationMember?.id || null,

          actualMatchKitPlayerId:
            actualMatchKitPlayer?.id || null,

          actualDisplayName:
            finalActualDisplayName.trim(),

          pickupRecordedAt: new Date(),

          pickupRecordedById:
            session.user.id,
        },

        include: {
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

    return NextResponse.json({
      success: true,

      message:
        `${finalActualDisplayName.trim()} was recorded ` +
        "as the person who actually took the kit.",

      assignment: updatedAssignment,
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
        status: 500,
      }
    );
  }
}