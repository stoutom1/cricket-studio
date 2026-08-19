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
          activeLeague: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    if (user) {
      userContext = {
        signedIn: true,
        userName:
          user.name ||
          session.user.name ||
          "",
        activeLeagueId:
          user.activeLeagueId ||
          null,
        activeLeagueName:
          user.activeLeague?.name ||
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
