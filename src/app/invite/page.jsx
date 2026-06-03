import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function InvitePage({
  params
}) {
  const { token } = await params;

  const session =
    await getServerSession(authOptions);

  if (!session) {
    redirect(
      `/signup?invite=${token}`
    );
  }

  redirect(
    `/join-league/${token}`
  );
}