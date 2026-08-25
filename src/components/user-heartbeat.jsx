"use client";

import { useEffect } from "react";
import {
  signOut,
  useSession,
} from "next-auth/react";

export default function UserHeartbeat() {
  const {
    data: session,
  } = useSession();

  useEffect(() => {
    if (!session?.user?.email) {
      return;
    }

    let disposed = false;
    let clearingStaleSession = false;

    async function clearStaleSession() {
      if (
        disposed ||
        clearingStaleSession
      ) {
        return;
      }

      clearingStaleSession = true;

      try {
        /*
         * Clear the obsolete NextAuth cookie/provider state but stay on the
         * current page. This is important on /verify-email: the user must not
         * be kicked away from the verification/resend workflow just because a
         * previous browser session points at a User row that no longer exists.
         */
        await signOut({
          redirect: false,
        });
      } catch (error) {
        console.warn(
          "[HEARTBEAT_STALE_SESSION_CLEAR_FAILED]",
          error
        );
      }
    }

    async function sendHeartbeat() {
      if (
        disposed ||
        document.visibilityState !==
          "visible"
      ) {
        return;
      }

      try {
        const response = await fetch(
          "/api/user/heartbeat",
          {
            method: "POST",
            cache: "no-store",
          }
        );

        if (response.status === 404) {
          const data = await response
            .json()
            .catch(() => ({}));

          if (
            data?.code ===
            "USER_NOT_FOUND"
          ) {
            await clearStaleSession();
          }
        }
      } catch {
        /*
         * Heartbeat is best-effort presence metadata. Network loss must never
         * block navigation, scoring, login, or email verification.
         */
      }
    }

    void sendHeartbeat();

    const interval = window.setInterval(
      () => {
        void sendHeartbeat();
      },
      2 * 60 * 1000
    );

    return () => {
      disposed = true;
      window.clearInterval(
        interval
      );
    };
  }, [
    session?.user?.email,
  ]);

  return null;
}
