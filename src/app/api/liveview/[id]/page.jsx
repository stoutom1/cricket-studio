import DashboardClient from "@/components/dashboard-client";

export default async function Page({ params }) {
  const { matchId: matchIdParam } = await params;
  const matchId = Number(matchIdParam);
  return <DashboardClient matchId={params.id} />;
}