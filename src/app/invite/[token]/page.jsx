import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function InvitePage({
  params
}) {
  const { token } = await params;

  const invite =
    await prisma.leagueInvite.findUnique({
      where: { token },
      include: {
        league: true
      }
    });

  if (!invite) {
    return (
      <div>
        Invalid invite link
      </div>
    );
  }

  const session =
    await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(
        `/invite/${token}`
      )}`
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email: session.user.email
      }
    });

  if (!user) {
    redirect(
      `/complete-profile?token=${token}`
    );
  }

  await prisma.leagueMember.upsert({
    where: {
      userId_leagueId: {
        userId: user.id,
        leagueId: invite.leagueId
      }
    },

    update: {},

    create: {
      userId: user.id,
      leagueId: invite.leagueId,
      role: "VIEWER",

      canViewDashboard: true,
      canViewMatches: true,
      canViewStats: true
    }
  });
console.log("at the end of app/invite/token/page.jsx");
  redirect("/dashboard");
}