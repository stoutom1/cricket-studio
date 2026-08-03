"use client";

import Link from "next/link";
import styles from "./LeagueResourcesShortcut.module.css";

export default function LeagueResourcesShortcut({
  leagueId,
}) {
  if (!leagueId) {
    return null;
  }

  return (
    <Link
      href={`/leagues/${leagueId}/resources`}
      className={styles.resourceCard}
      aria-label="Open Knowledge Center"
    >
      <span
        className={styles.iconBox}
        aria-hidden="true"
      >
        📚
      </span>

      <span className={styles.copy}>
        <span className={styles.title}>
          Knowledge Center
        </span>

        <span className={styles.description}>
          Rules · places · forms · files · contacts
        </span>
      </span>

      <span className={styles.action}>
        <span className={styles.actionText}>
          Explore
        </span>

        <span
          className={styles.arrowBox}
          aria-hidden="true"
        >
          →
        </span>
      </span>
    </Link>
  );
}