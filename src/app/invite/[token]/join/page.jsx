"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

export default function JoinPage() {
  const params = useParams();
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token;
  const [message, setMessage] = useState("Joining league...");
  const claimStartedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setMessage("Invalid invitation link.");
      return;
    }

    /*
     * React Strict Mode can run effects twice in development. Keep the claim
     * one-shot on the client as well as idempotent on the server. Do not use a
     * cleanup cancellation flag here: Strict Mode cleanup happens between the
     * two development effect passes and could otherwise cancel the only claim.
     */
    if (claimStartedRef.current) {
      return;
    }

    claimStartedRef.current = true;

    async function joinLeague() {
      try {
        const res = await fetch(
          `/api/invites/${encodeURIComponent(token)}/claim`,
          { method: "POST" }
        );

        const data = await res.json().catch(() => ({}));

        if (res.status === 401) {
          window.location.href = `/login?callbackUrl=${encodeURIComponent(
            `/invite/${token}/join`
          )}`;
          return;
        }

        if (data?.code === "PROFILE_REQUIRED") {
          window.location.href = `/complete-profile?token=${encodeURIComponent(token)}`;
          return;
        }

        if (!res.ok) {
          setMessage(data.error || "Failed to join league.");
          return;
        }

        setMessage(
          data.promoted
            ? `Role updated from ${data.previousRole || "your previous role"} to ${
                data.roleLabel || data.role || "the invited role"
              }. Opening the league...`
            : data.alreadyMember
              ? "You are already a member. Your existing role was kept. Opening the league..."
              : `Joined ${data.leagueName || "league"} as ${data.roleLabel || data.role || "member"}.`
        );

        window.location.href = `/dashboard?leagueId=${encodeURIComponent(data.leagueId)}`;
      } catch (error) {
        setMessage(error?.message || "Failed to join league.");
      }
    }

    joinLeague();
  }, [token]);

  return (
    <main style={{ maxWidth: 620, margin: "48px auto", padding: 24 }}>
      <h1>Cric4All League Invitation</h1>
      <p>{message}</p>
    </main>
  );
}
