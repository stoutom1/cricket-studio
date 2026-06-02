import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import DashboardClient from "@/components/dashboard-client";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }
  return (
    <>
      <section className="hero">
        <h1>📊 Dashboard</h1>
        <p>
          Manage teams, add roster players, create matches, score every delivery,
          and view live scoreboards plus player statistics.
        </p>
      </section>
      <DashboardClient />
    </>
  );
}