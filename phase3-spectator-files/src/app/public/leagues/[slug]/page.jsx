import { redirect } from "next/navigation";

export default async function OldPublicLeagueRedirect({ params }) {
  const { slug } = await params;

  redirect(`/leagues/${slug}`);
}