"use client";

import styles from "./KitPostMatchPrompt.module.css";

export default function KitPostMatchPrompt({
  open,
  matchLabel,
  taskCount = 0,
  warning = "",
  onRecordNow,
  onLater,
}) {
  if (!open) {
    return null;
  }

  const hasPendingTask =
    Number(taskCount) > 0;

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onLater?.();
        }
      }}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kit-post-match-title"
      >
        <div
          className={styles.icon}
          aria-hidden="true"
        >
          🎒
        </div>

        <div className={styles.copy}>
          <span className={styles.kicker}>
            MATCH COMPLETED
          </span>

          <h2 id="kit-post-match-title">
            Record the final kit holder
          </h2>

          <p>
            {matchLabel
              ? `${matchLabel} has ended. Confirm who actually took the kit home.`
              : "The match has ended. Confirm who actually took the kit home."}
          </p>
        </div>

        <div className={styles.status}>
          <div>
            <span>Follow-up status</span>

            <strong>
              {hasPendingTask
                ? `${taskCount} custody confirmation${
                    Number(taskCount) === 1
                      ? ""
                      : "s"
                  } pending`
                : warning
                  ? "Task creation needs attention"
                  : "Custody confirmation required"}
            </strong>
          </div>

          <small>
            The current holder does not change until an authorized
            scorer, Admin, or Owner records the actual person.
          </small>
        </div>

        {warning && (
          <div className={styles.warning}>
            <strong>
              Kit follow-up warning
            </strong>

            <span>{warning}</span>
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.laterButton}
            onClick={onLater}
          >
            Do It Later
          </button>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={onRecordNow}
          >
            Record Kit Holder Now
          </button>
        </div>

        <p className={styles.note}>
          Choosing “Do It Later” keeps the follow-up under
          Matches → Kit → Needs Attention.
        </p>
      </section>
    </div>
  );
}
