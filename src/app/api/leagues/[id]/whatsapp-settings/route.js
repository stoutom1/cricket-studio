import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

function normalizeWhatsAppNumber(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return null;
  }

  const normalized = `+${rawValue.replace(/\D/g, "")}`;

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error(
      "WhatsApp number must include a valid country code, for example +16025551234."
    );
  }

  return normalized;
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const leagueId = Number(id);

    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      return NextResponse.json(
        { error: "Invalid league ID." },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 404 }
      );
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        ownerId: true,
      },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found." },
        { status: 404 }
      );
    }

    const membership = await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId: currentUser.id,
          leagueId,
        },
      },
      select: {
        role: true,
        canEditLeague: true,
      },
    });

    const canManageSettings =
      league.ownerId === currentUser.id ||
      membership?.role === "OWNER" ||
      membership?.role === "ADMIN" ||
      membership?.canEditLeague === true;

    if (!canManageSettings) {
      return NextResponse.json(
        {
          error:
            "Only the league owner or an authorized league administrator can update birthday reminder contacts.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    let ownerWhatsAppNumber;
    let backupOwnerWhatsAppNumber;

    try {
      ownerWhatsAppNumber = normalizeWhatsAppNumber(
        body.ownerWhatsAppNumber
      );

      backupOwnerWhatsAppNumber = normalizeWhatsAppNumber(
        body.backupOwnerWhatsAppNumber
      );
    } catch (validationError) {
      return NextResponse.json(
        {
          error:
            validationError instanceof Error
              ? validationError.message
              : "Invalid WhatsApp number.",
        },
        { status: 400 }
      );
    }

    const backupOwnerId = body.backupOwnerId
      ? String(body.backupOwnerId)
      : null;

    const whatsappNotificationsEnabled = Boolean(
      body.whatsappNotificationsEnabled
    );

    if (whatsappNotificationsEnabled && !ownerWhatsAppNumber) {
      return NextResponse.json(
        {
          error:
            "Enter the primary league owner's WhatsApp number before enabling automatic owner birthday reminders.",
        },
        { status: 400 }
      );
    }

    if (backupOwnerId) {
      if (backupOwnerId === league.ownerId) {
        return NextResponse.json(
          {
            error:
              "Backup League Owner must be different from the Primary League Owner.",
          },
          { status: 400 }
        );
      }

      const backupMembership = await prisma.leagueMember.findUnique({
        where: {
          userId_leagueId: {
            userId: backupOwnerId,
            leagueId,
          },
        },
        select: {
          userId: true,
        },
      });

      if (!backupMembership) {
        return NextResponse.json(
          {
            error:
              "The selected Backup League Owner must already be assigned to this league.",
          },
          { status: 400 }
        );
      }

      if (!backupOwnerWhatsAppNumber) {
        return NextResponse.json(
          {
            error:
              "Enter the Backup League Owner's WhatsApp number.",
          },
          { status: 400 }
        );
      }
    }

    if (!backupOwnerId) {
      backupOwnerWhatsAppNumber = null;
    }

    const updatedLeague = await prisma.league.update({
      where: { id: leagueId },
      data: {
        ownerWhatsAppNumber,
        backupOwnerId,
        backupOwnerWhatsAppNumber,
        whatsappNotificationsEnabled,
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        backupOwnerId: true,
        backupOwner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        ownerWhatsAppNumber: true,
        backupOwnerWhatsAppNumber: true,
        whatsappNotificationsEnabled: true,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "League owner birthday reminder settings saved successfully.",
      league: updatedLeague,
    });
  } catch (error) {
    console.error("League WhatsApp settings error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to save birthday reminder settings.",
      },
      { status: 500 }
    );
  }
}
