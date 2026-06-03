"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function JoinPage({ params }) {
  useEffect(() => {
    const joinLeague = async () => {
      const { token } = await params;

      const res = await fetch(
        `/api/invite/${token}/join`,
        {
          method: "POST"
        }
      );

      const data = await res.json();
      const newURL = `/dashboard?leagueId=${data.leagueId}`;

      if (res.ok) {
        window.location.href = newURL;
      } else {
        alert(data.error || "Failed to join");
      }
    };

    joinLeague();
  }, [params]);

  return <p>Joining league...</p>;
}