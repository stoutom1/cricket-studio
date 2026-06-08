"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function RegisterLeaguePage() {
  const { token } = useParams();
  const router = useRouter();

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [leagueId, setLeagueId] = useState(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    async function registerLeague() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const session = await sessionRes.json();

        if (!session?.user) {
          setStatus("error");
          setMessage("Please sign in before joining a league.");
          return;
        }

        const res = await fetch(
          `/api/register-league/${token}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            }
          }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data.error ||
              data.message ||
              "Request failed"
          );
        }

        setLeagueName(data.leagueName);
        setLeagueId(data.leagueId);
        setStatus("success");
        setMessage(
          `You have successfully joined ${data.leagueName}.`
        );
      } catch (err) {
        console.error(err);

        setStatus("error");
        setMessage(
          err.message || "Failed to join league."
        );
      }
    }

    if (token) {
      registerLeague();
    }
  }, [token]);

useEffect(() => {
  if (status !== "success") return;

  const timer = setTimeout(() => {

    router.push("/dashboard");
  }, 5000);

  const interval = setInterval(() => {
    setCountdown((prev) => prev - 1);
  }, 1000);

  return () => {
    clearTimeout(timer);
    clearInterval(interval);
  };
}, [status, router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background:
          "linear-gradient(135deg,#0f172a,#1e293b)",
        padding: 24
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#fff",
          borderRadius: 16,
          padding: 32,
          boxShadow:
            "0 10px 30px rgba(0,0,0,.25)",
          textAlign: "center"
        }}
      >
        {status === "loading" && (
          <>
            <div
              style={{
                fontSize: 56,
                marginBottom: 16
              }}
            >
              🏏
            </div>

            <h2>Joining League...</h2>

            <p
              style={{
                color: "#666",
                marginTop: 12
              }}
            >
              Please wait while we process your invitation.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div
              style={{
                fontSize: 64,
                marginBottom: 16
              }}
            >
              ✅
            </div>

            <h1>Welcome to {leagueName}</h1>

            <p
              style={{
                color: "#555",
                marginTop: 12
              }}
            >
              {message}
            </p>

            <p
              style={{
                color: "#777",
                marginTop: 12,
                fontSize: 14
              }}
            >
              Redirecting to dashboard in {countdown} second
              {countdown !== 1 ? "s" : ""}...
            </p>

            <button
              onClick={() => {
                if (leagueId) {
                  router.push(`/leagues/${leagueId}`);
                } else {

                  router.push("/dashboard");
                }
              }}
              style={{
                marginTop: 24,
                padding: "12px 24px",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                background: "#2563eb",
                color: "#fff",
                fontSize: 16,
                fontWeight: 600
              }}
            >
              Go to League Dashboard
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div
              style={{
                fontSize: 64,
                marginBottom: 16
              }}
            >
              ❌
            </div>

            <h1>Unable to Join League</h1>

            <p
              style={{
                color: "#555",
                marginTop: 12
              }}
            >
              {message}
            </p>

            <button
              onClick={() =>
                router.push("/dashboard")
              }
              style={{
                marginTop: 24,
                padding: "12px 24px",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                background: "#475569",
                color: "#fff",
                fontSize: 16,
                fontWeight: 600
              }}
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}