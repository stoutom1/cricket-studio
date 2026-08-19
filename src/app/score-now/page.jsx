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

  if (
    session?.user?.email
  ) {
    /*
     * User.activeLeagueId is a scalar preference in the current Cric4All
     * schema. There is intentionally NO Prisma relation named `activeLeague`
     * on User, so fetch the selected League separately.
     *
     * Keeping the schema unchanged avoids introducing a migration simply for
     * this onboarding page.
     */
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
      let activeLeague =
        null;

      if (
        Number.isInteger(
          Number(
            user.activeLeagueId
          )
        ) &&
        Number(
          user.activeLeagueId
        ) > 0
      ) {
        /*
         * Verify that the saved ID still points to a league the user can
         * access. A stale activeLeagueId should not make /score-now fail.
         */
        activeLeague =
          await prisma.league.findFirst({
            where: {
              id: Number(
                user.activeLeagueId
              ),

              OR: [
                {
                  ownerId:
                    user.id,
                },
                {
                  members: {
                    some: {
                      userId:
                        user.id,
                    },
                  },
                },
              ],
            },
            select: {
              id: true,
              name: true,
            },
          });
      }

      userContext = {
        signedIn: true,
        userName:
          user.name ||
          session.user.name ||
          "",
        activeLeagueId:
          activeLeague?.id ||
          null,
        activeLeagueName:
          activeLeague?.name ||
          "",
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
