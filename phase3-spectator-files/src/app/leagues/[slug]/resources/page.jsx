import { notFound } from "next/navigation";

import LeagueResourcesClient from "./LeagueResourcesClient";
import styles from "./resources.module.css";

export const metadata = {
  title: "League Resources | Cric4All",
  description:
    "League documents, rules, venue guides, restaurant links, forms, and useful resources.",
};

export default async function LeagueResourcesPage({
  params,
}) {
  const { slug } = await params;

  const leagueId =
    Number(slug);

  if (
    !Number.isInteger(leagueId) ||
    leagueId <= 0
  ) {
    notFound();
  }

  return (
    <main
      className={styles.pageShell}
    >
      <LeagueResourcesClient
        leagueId={leagueId}
      />
    </main>
  );
}