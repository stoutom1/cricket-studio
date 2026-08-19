import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import QuickMatchStarter from "@/components/quick-match-starter";

export const dynamic = "force-dynamic";

export default async function ScoreNowPage() {
  const session = await getServerSession(authOptions);

  let userContext = {
    signedIn: false,
    userName: "",
    activeLeagueId: null,
    activeLeagueName: "",
  };

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
      select: {
        id: true,
        name: true,
        activeLeagueId: true,
      },
    });

    if (user) {
      let activeLeagueName = "";

      // User has activeLeagueId, but the Prisma User model does not
      // currently expose an activeLeague relation. Resolve the league
      // explicitly instead.
      if (user.activeLeagueId) {
        const activeLeague = await prisma.league.findUnique({
          where: {
            id: Number(user.activeLeagueId),
          },
          select: {
            id: true,
            name: true,
          },
        });

        activeLeagueName = activeLeague?.name || "";
      }

      userContext = {
        signedIn: true,
        userName: user.name || session.user.name || "",
        activeLeagueId: user.activeLeagueId || null,
        activeLeagueName,
      };
    }
  }

  return <QuickMatchStarter userContext={userContext} />;
}