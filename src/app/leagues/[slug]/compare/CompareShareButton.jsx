"use client";

import {
  useState,
} from "react";

export default function CompareShareButton({
  shareText,
}) {
  const [
    message,
    setMessage,
  ] = useState("");

  async function share() {
    const url =
      window.location.href;

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            "Cric4All Player Comparison",
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
        "Comparison link copied."
      );
    } catch (
      error
    ) {
      if (
        error?.name !==
        "AbortError"
      ) {
        setMessage(
          "Unable to share comparison."
        );
      }
    }
  }

  return (
    <div className="pcp-share-wrap">
      <button
        type="button"
        onClick={
          share
        }
      >
        ↗ Share comparison
      </button>

      {message && (
        <span role="status">
          {message}
        </span>
      )}
    </div>
  );
}
