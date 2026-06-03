import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import DashboardClient from "@/components/dashboard-client";

export default async function DashboardPage() {
  const session =
    await getServerSession(
      authOptions
    );

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <h2>📊 Dashboard</h2>

        <div className="dashboard-hero-sub">
          Manage teams, add roster players,
          create matches, score every
          delivery, and view live
          scoreboards plus player
          statistics.
        </div>
      </section>

      <section className="dashboard-content">
        <DashboardClient />
      </section>
    </main>
  );
}