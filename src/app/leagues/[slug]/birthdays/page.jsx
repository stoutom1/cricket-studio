import { notFound } from "next/navigation";
import BirthdayManager from "./BirthdayManager";

export default async function BirthdayManagementPage({ params }) {
  const { slug } = await params;
  const leagueId = Number(slug);

  if (!Number.isInteger(leagueId) || leagueId <= 0) {
    notFound();
  }

  return <BirthdayManager leagueId={leagueId} />;
}