"use client";

import {
  useState,
} from "react";

export default function PlayerCardActions({
  playerName,
  shareText,
  compareHref,
  journeyHref,
}) {
  const [
    message,
    setMessage,
  ] = useState("");

  async function shareCard() {
    const url =
      window.location.href;

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            `${playerName} | Cric4All Player Card`,
          text:
            shareText,
          url,
        });

        return;
      }

      await navigator.clipboard.writeText(
        `${shareText}\n${url}`
      );

      setMessage(
        "Player card link copied."
      );
    } catch (
      error
    ) {
      if (
        error?.name !==
        "AbortError"
      ) {
        setMessage(
          "Unable to share this player card."
        );
      }
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        window.location.href
      );

      setMessage(
        "Link copied."
      );
    } catch {
      setMessage(
        "Unable to copy the link."
      );
    }
  }

  return (
    <div className="spf-card-actions">
      <button
        type="button"
        className="spf-share-button"
        onClick={
          shareCard
        }
      >
        <span aria-hidden="true">
          ↗
        </span>
        Share player card
      </button>

      {journeyHref && (
        <a
          className="spf-journey-button"
          href={journeyHref}
        >
          ✦ Player journey
        </a>
      )}

      {compareHref && (
        <a
          className="spf-compare-button"
          href={compareHref}
        >
          ⚔ Compare players
        </a>
      )}

      <button
        type="button"
        className="spf-copy-button"
        onClick={
          copyLink
        }
      >
        Copy link
      </button>

      {message && (
        <span
          className="spf-action-message"
          role="status"
        >
          {message}
        </span>
      )}
    </div>
  );
}
