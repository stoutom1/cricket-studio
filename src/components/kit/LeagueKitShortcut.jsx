"use client";

import styles from "./LeagueKitShortcut.module.css";

export default function LeagueKitShortcut({
  leagueName,
  sharedKit = false,
  onOpenKit,
}) {
  return (
    <section
      className={styles.card}
      aria-label={`Kit tracking for ${leagueName}`}
    >
      <div
        className={styles.summary}
      >
        <span
          className={styles.icon}
          aria-hidden="true"
        >
          🏏
        </span>

        <div className={styles.copy}>
          <strong>
            League Kit Tracking
          </strong>

          <small>
            {sharedKit
              ? "Manage shared-kit custody in Matches → Kit."
              : "Manage team-kit custody in Matches → Kit."}
          </small>
        </div>
      </div>

      <button
        type="button"
        className={styles.action}
        onClick={onOpenKit}
      >
        Open Kit
        <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
