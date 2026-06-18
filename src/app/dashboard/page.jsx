import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import DashboardClient from "@/components/dashboard-client";
import Link from "next/link";

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
    <h2 className="dashboard-title">
        <Link
          href="/"
          style={{
            textDecoration: "none",
            color: "inherit",
          }}
        >📊 Dashboard
  </Link>
  </h2>
                      <div className="dashboard-subtitle">
                        Advanced scoring • custom overs • custom wickets • custom powerplay overs • player stats • league permissions • and more! 
                      </div>
  </section>


      <section className="dashboard-content">
        <DashboardClient />
      </section>
    </main>
  );
}