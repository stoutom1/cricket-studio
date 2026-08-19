"use client";

import {
  useState,
} from "react";

export default function FeedShareButton({
  shareText,
}) {
  const [
    status,
    setStatus,
  ] = useState("");

  async function handleShare() {
    const url =
      window.location.href;

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            "Cric4All Player Feed",
          text:
            shareText,
          url,
        });

        return;
      }

      await navigator.clipboard.writeText(
        `${shareText}\n${url}`
      );

      setStatus(
        "Feed link copied."
      );
    } catch (
      error
    ) {
      if (
        error?.name !==
        "AbortError"
      ) {
        setStatus(
          "Unable to share."
        );
      }
    }
  }

  return (
    <div className="phf-share">
      <button
        type="button"
        onClick={
          handleShare
        }
      >
        ↗ Share feed
      </button>

      {status && (
        <span role="status">
          {status}
        </span>
      )}
    </div>
  );
}
