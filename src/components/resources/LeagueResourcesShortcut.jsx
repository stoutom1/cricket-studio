"use client";

import Link from "next/link";
import styles from "./LeagueResourcesShortcut.module.css";

export default function LeagueResourcesShortcut({
  leagueId,
  leagueName = "Active league",
  compact = false,
}) {
  const validLeagueId =
    Number.isInteger(Number(leagueId)) && Number(leagueId) > 0;

  if (!validLeagueId) return null;

  return (
    <Link
      href={`/leagues/${leagueId}/resources`}
      className={`${styles.shortcut} ${compact ? styles.compact : ""}`}
      aria-label={`Open the knowledge center for ${leagueName}`}
    >
      <span className={styles.icon} aria-hidden="true">📚</span>

      <span className={styles.copy}>
        <strong>Knowledge Center</strong>
        <small>Rules • places • forms • files • contacts</small>
      </span>

      <span className={styles.action}>
        Explore
        <b aria-hidden="true">→</b>
      </span>
    </Link>
  );
}
