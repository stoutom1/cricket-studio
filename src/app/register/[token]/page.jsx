import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export default async function RegisterTokenPage({
  params
}) {
  const { token } = await params;

  const invite =
    await prisma.leagueInvite.findUnique({
      where: { token }
    });

  if (!invite) {
    return (
      <div className="container">
        <h1>Invalid Invite Link</h1>
      </div>
    );
  }

  const session =
    await getServerSession(authOptions);

  /*
   * Not logged in
   */
  if (!session?.user?.email) {
redirect(`/login?callbackUrl=/register/${token}`);
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email: session.user.email
      }
    });

  /*
   * User does not exist yet
   */
  if (!user) {
    redirect(
      `/complete-profile?token=${token}`
    );
  }

  /*
   * Already registered
   */
  redirect(
    `/register/${token}/join`
  );
}