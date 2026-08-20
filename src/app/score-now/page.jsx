import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import QuickMatchStarter from "@/components/quick-match-starter";

export const dynamic = "force-dynamic";

export default async function ScoreNowPage() {
  const session =
    await getServerSession(
      authOptions
    );

  let userContext = {
    signedIn: false,
    userName: "",
    activeLeagueId: null,
    activeLeagueName: "",
  };

  if (session?.user?.email) {
    const user =
      await prisma.user.findUnique({
        where: {
          email:
            session.user.email,
        },
        select: {
          id: true,
          name: true,
          activeLeagueId: true,
        },
      });

    if (user) {
      let activeLeagueName = "";

      /*
       * User stores activeLeagueId as a scalar field.
       * The current Prisma User model does NOT expose an `activeLeague`
       * relation, so resolve the League explicitly.
       */
      if (user.activeLeagueId) {
        const activeLeague =
          await prisma.league.findUnique({
            where: {
              id:
                Number(
                  user.activeLeagueId
                ),
            },
            select: {
              id: true,
              name: true,
            },
          });

        activeLeagueName =
          activeLeague?.name ||
          "";
      }

      userContext = {
        signedIn: true,
        userName:
          user.name ||
          session.user.name ||
          "",
        activeLeagueId:
          user.activeLeagueId ||
          null,
        activeLeagueName,
      };
    }
  }

  return (
    <QuickMatchStarter
      userContext={
        userContext
      }
    />
  );
}
