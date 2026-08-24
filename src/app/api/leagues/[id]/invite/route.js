import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  ROLE_LABELS,
  getAllowedInviteRoles,
  normalizeLeagueRole,
} from "@/lib/league-role-permissions";
import { createLeagueInviteToken } from "@/lib/league-invite-token";

const SUPER_ADMIN_EMAIL = "surprisecricket11@gmail.com";

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const leagueId = Number(id);

    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      return NextResponse.json({ error: "Invalid league id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const requestedRole = normalizeLeagueRole(body?.role || "VIEWER");

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true, name: true, ownerId: true },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const membership = await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId: currentUser.id,
          leagueId,
        },
      },
    });

    const isSuperAdmin =
      String(currentUser.email || "").toLowerCase() === SUPER_ADMIN_EMAIL;

    const effectiveRole =
      league.ownerId === currentUser.id
        ? "OWNER"
        : membership?.role || "VIEWER";

    const allowedRoles = getAllowedInviteRoles({
      role: effectiveRole,
      permissions: membership,
      isSuperAdmin,
    });

    if (!allowedRoles.length) {
      return NextResponse.json(
        { error: "You do not have permission to create league invitations." },
        { status: 403 }
      );
    }

    if (!allowedRoles.includes(requestedRole)) {
      return NextResponse.json(
        {
          error: `Your current league access cannot create a ${ROLE_LABELS[requestedRole]} invite.`,
          allowedRoles,
        },
        { status: 403 }
      );
    }

    if (requestedRole === "OWNER" && !(isSuperAdmin || league.ownerId === currentUser.id)) {
      return NextResponse.json(
        { error: "Only the league owner or Super Admin can create an Owner invite." },
        { status: 403 }
      );
    }

    const token = createLeagueInviteToken({
      leagueId,
      role: requestedRole,
      inviterUserId: currentUser.id,
    });

    await prisma.leagueInvite.create({
      data: {
        token,
        leagueId,
      },
    });

    const origin = new URL(req.url).origin;
    const inviteLink = `${origin}/invite/${token}`;

    return NextResponse.json({
      inviteLink,
      role: requestedRole,
      roleLabel: ROLE_LABELS[requestedRole],
      leagueId,
      leagueName: league.name,
      allowedRoles,
    });
  } catch (error) {
    console.error("Create league invite failed:", error);
    return NextResponse.json(
      { error: error?.message || "Unable to create league invitation." },
      { status: 500 }
    );
  }
}
