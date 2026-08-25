"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function safeLocalCallback(value) {
  const callback = String(value || "");

  if (
    callback.startsWith("/") &&
    !callback.startsWith("//") &&
    !callback.includes("/api/auth")
  ) {
    return callback;
  }

  return "/dashboard";
}

export default function VerifyEmailClient({
  initialStatus,
  email,
  maskedEmail,
  callbackUrl,
  leagueName,
  roleLabel,
  inviteApplied,
  message,
  code,
  emailSent,
}) {
  const [status, setStatus] = useState(
    initialStatus || "pending"
  );
  const [notice, setNotice] = useState(
    message || ""
  );
  const [resending, setResending] =
    useState(false);

  const destination =
    maskedEmail || email || "your email address";

  const loginUrl = useMemo(() => {
    const target = safeLocalCallback(
      callbackUrl
    );

    return `/login?callbackUrl=${encodeURIComponent(
      target
    )}`;
  }, [callbackUrl]);

  async function resendVerification() {
    if (!email || resending) {
      return;
    }

    setResending(true);
    setNotice("");

    try {
      const response = await fetch(
        "/api/email-verification/resend",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            email,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        setNotice(
          data?.message ||
            data?.error ||
            "Unable to resend verification email."
        );
        return;
      }

      if (data?.alreadyVerified) {
        setStatus("success");
      }

      setNotice(
        data?.message ||
          "Verification email sent."
      );
    } catch (error) {
      setNotice(
        error?.message ||
          "Unable to resend verification email."
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 16px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 620,
          border:
            "1px solid rgba(148,163,184,.3)",
          borderRadius: 18,
          padding: 28,
          background:
            "rgba(15,23,42,.78)",
          boxShadow:
            "0 18px 50px rgba(2,6,23,.28)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              background:
                "rgba(34,197,94,.14)",
              fontSize: 26,
            }}
          >
            {status === "success"
              ? "✅"
              : status === "error"
                ? "⚠️"
                : "✉️"}
          </div>

          <div>
            <div
              style={{
                fontSize: 13,
                opacity: 0.72,
                fontWeight: 800,
              }}
            >
              🏏 Cric4All Account Security
            </div>
            <h1
              style={{
                margin: "3px 0 0",
                fontSize: 24,
              }}
            >
              {status === "success"
                ? "Email verified"
                : status === "error"
                  ? "Verification link problem"
                  : "Verify your email"}
            </h1>
          </div>
        </div>

        {status === "success" ? (
          <>
            <p
              style={{
                lineHeight: 1.65,
                opacity: 0.9,
              }}
            >
              Your email address has been verified successfully.
            </p>

            {inviteApplied && leagueName && (
              <div
                style={{
                  margin: "18px 0",
                  padding: 16,
                  borderRadius: 12,
                  background:
                    "rgba(34,197,94,.10)",
                  border:
                    "1px solid rgba(34,197,94,.28)",
                }}
              >
                <strong>
                  League invitation applied ✓
                </strong>
                <div
                  style={{
                    marginTop: 5,
                    opacity: 0.86,
                  }}
                >
                  {leagueName}
                  {roleLabel
                    ? ` · ${roleLabel}`
                    : ""}
                </div>
              </div>
            )}

            <Link
              href={loginUrl}
              style={{
                display: "inline-block",
                marginTop: 12,
                padding: "12px 18px",
                borderRadius: 10,
                background: "#16a34a",
                color: "white",
                textDecoration: "none",
                fontWeight: 900,
              }}
            >
              Continue to secure sign in →
            </Link>
          </>
        ) : (
          <>
            <p
              style={{
                lineHeight: 1.65,
                opacity: 0.9,
              }}
            >
              {status === "error"
                ? notice ||
                  "This verification link could not be used."
                : `We sent a secure verification link to ${destination}. Open that email and select “Verify my Cric4All account” to continue.`}
            </p>

            {leagueName && (
              <div
                style={{
                  margin: "18px 0",
                  padding: 16,
                  borderRadius: 12,
                  background:
                    "rgba(59,130,246,.10)",
                  border:
                    "1px solid rgba(59,130,246,.25)",
                }}
              >
                <strong>
                  Your invitation is preserved
                </strong>
                <div
                  style={{
                    marginTop: 5,
                    opacity: 0.86,
                  }}
                >
                  {leagueName}
                  {roleLabel
                    ? ` · ${roleLabel}`
                    : ""}
                </div>
                <small
                  style={{
                    display: "block",
                    marginTop: 6,
                    opacity: 0.7,
                  }}
                >
                  You can verify from another browser or device. Cric4All will apply the invitation after verification if it is still valid.
                </small>
              </div>
            )}

            {!emailSent && (
              <div
                style={{
                  margin: "14px 0",
                  padding: 12,
                  borderRadius: 10,
                  background:
                    "rgba(245,158,11,.12)",
                }}
              >
                The first verification email could not be sent. Use the resend button below.
              </div>
            )}

            {notice && status !== "error" && (
              <div
                style={{
                  margin: "14px 0",
                  padding: 12,
                  borderRadius: 10,
                  background:
                    "rgba(14,165,233,.10)",
                }}
              >
                {notice}
              </div>
            )}

            {email && (
              <button
                type="button"
                disabled={resending}
                onClick={resendVerification}
                style={{
                  marginTop: 12,
                  minHeight: 42,
                  padding: "10px 16px",
                  borderRadius: 10,
                  border:
                    "1px solid rgba(148,163,184,.35)",
                  background:
                    "rgba(30,41,59,.86)",
                  color: "inherit",
                  fontWeight: 800,
                  cursor: resending
                    ? "not-allowed"
                    : "pointer",
                  opacity: resending ? 0.6 : 1,
                }}
              >
                {resending
                  ? "Sending…"
                  : "Resend verification email"}
              </button>
            )}

            <p
              style={{
                marginTop: 20,
                fontSize: 13,
                opacity: 0.68,
                lineHeight: 1.55,
              }}
            >
              Verification links expire after 24 hours. Check your spam or junk folder if the message is not in your inbox.
              {code === "EXPIRED_TOKEN"
                ? " This link has expired, so request a new one."
                : ""}
            </p>

            <p
              style={{
                marginTop: 12,
                fontSize: 13,
              }}
            >
              Entered the wrong email address?{" "}
              <Link
                href={`/register?callbackUrl=${encodeURIComponent(
                  safeLocalCallback(callbackUrl)
                )}`}
                style={{
                  fontWeight: 800,
                }}
              >
                Start registration again
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
