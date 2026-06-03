import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function JoinPage({
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
    return <h1>Invite expired</h1>;
  }

  return (
    <div className="invite-card">
      <h1>
        Join {invite.league.name}
      </h1>

      <form
        action={`/api/invites/${token}/accept`}
        method="POST"
      >
        <button>
          Join League
        </button>
      </form>
    </div>
  );
}