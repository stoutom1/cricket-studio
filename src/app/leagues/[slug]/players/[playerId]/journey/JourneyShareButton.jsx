"use client";

import {
  useState,
} from "react";

export default function JourneyShareButton({
  shareText,
}) {
  const [
    message,
    setMessage,
  ] = useState("");

  async function shareJourney() {
    const url =
      window.location.href;

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            "Cric4All Player Journey",
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
        "Journey link copied."
      );
    } catch (
      error
    ) {
      if (
        error?.name !==
        "AbortError"
      ) {
        setMessage(
          "Unable to share journey."
        );
      }
    }
  }

  return (
    <div className="pj-share">
      <button
        type="button"
        onClick={
          shareJourney
        }
      >
        ↗ Share journey
      </button>

      {message && (
        <span role="status">
          {message}
        </span>
      )}
    </div>
  );
}
