"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

export default function UserHeartbeat() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user?.email) return;

    function sendHeartbeat() {
      if (document.visibilityState !== "visible") return;

      fetch("/api/user/heartbeat", {
        method: "POST",
      }).catch(() => {});
    }

    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [session?.user?.email]);

  return null;
}