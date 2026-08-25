"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  SMS_CONSENT_TEXT,
} from "@/lib/compliance/sms-consent";
import SmsConsentFields from "@/components/SmsConsentFields";

function extractInviteToken(callbackUrl) {
  try {
    if (!callbackUrl) {
      return "";
    }

    const url = new URL(
      callbackUrl,
      "https://cric4all.app"
    );

    const match = url.pathname.match(
      /^\/invite\/([^/]+)(?:\/join)?\/?$/
    );

    return match?.[1]
      ? decodeURIComponent(match[1])
      : "";
  } catch {
    return "";
  }
}

export default function RegisterForm({
  callbackUrl,
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [loading, setLoading] =
    useState(false);
  const [message, setMessage] =
    useState("");
  const [smsPhoneNumber, setSmsPhoneNumber] =
    useState("");
  const [smsOptIn, setSmsOptIn] =
    useState(false);

  const inviteToken = useMemo(
    () => extractInviteToken(callbackUrl),
    [callbackUrl]
  );

  const loginHref = callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(
        callbackUrl
      )}`
    : "/login";

  async function handleRegister(e) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        "/api/register",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name,
            email,
            password,
            smsPhoneNumber:
              smsPhoneNumber.trim(),
            smsOptIn,
            smsConsentText: smsOptIn
              ? SMS_CONSENT_TEXT
              : null,
            inviteToken:
              inviteToken || null,
          }),
        }
      );

      const data = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        setMessage(
          data?.error ||
            "Registration failed."
        );
        return;
      }

      const params = new URLSearchParams({
        status: "pending",
        email:
          data?.email ||
          email.trim().toLowerCase(),
        maskedEmail:
          data?.maskedEmail || "",
        callbackUrl:
          callbackUrl || "/dashboard",
        emailSent:
          data?.verificationEmailSent
            ? "1"
            : "0",
      });

      if (data?.leagueId) {
        params.set(
          "leagueId",
          String(data.leagueId)
        );
      }

      if (data?.leagueName) {
        params.set(
          "leagueName",
          data.leagueName
        );
      }

      if (data?.roleLabel) {
        params.set(
          "roleLabel",
          data.roleLabel
        );
      }

      if (data?.emailWarning) {
        params.set(
          "message",
          data.emailWarning
        );
      } else if (data?.inviteWarning) {
        params.set(
          "message",
          data.inviteWarning
        );
      }

      router.push(
        `/verify-email?${params.toString()}`
      );
    } catch (error) {
      console.error(error);
      setMessage(
        "Unable to create your account right now. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-left">
          <div className="auth-brand">
            <div className="auth-logo">
              🏏
            </div>
            <div>
              <h2>Cric4All</h2>
              <p>
                Live cricket scoring made simple.
              </p>
            </div>
          </div>

          <h3>
            Start scoring matches in minutes.
          </h3>

          <p className="auth-description">
            Create leagues, teams, live scorecards, player stats, captaincy stats,
            wicketkeeping stats and public spectator links from one secure dashboard.
          </p>

          <div className="auth-feature-grid">
            <span>Live scoring</span>
            <span>Public scorecards</span>
            <span>Player statistics</span>
            <span>Mobile friendly</span>
          </div>
        </div>

        <div className="auth-right">
          <h1>Create account</h1>
          <p className="auth-subtitle">
            Join Cric4All and verify your email to activate your account.
          </p>

          {inviteToken && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 10,
                background:
                  "rgba(59,130,246,.10)",
                border:
                  "1px solid rgba(59,130,246,.24)",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <strong>
                League invitation detected ✓
              </strong>
              <div
                style={{
                  marginTop: 4,
                  opacity: 0.76,
                }}
              >
                Cric4All will preserve this invitation while you verify your email.
              </div>
            </div>
          )}

          <form onSubmit={handleRegister}>
            <label className="auth-field">
              <span>Full name</span>
              <input
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                required
                autoComplete="name"
              />
            </label>

            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                required
                autoComplete="email"
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>

            <SmsConsentFields
              phoneNumber={smsPhoneNumber}
              smsOptIn={smsOptIn}
              onPhoneNumberChange={
                setSmsPhoneNumber
              }
              onSmsOptInChange={
                setSmsOptIn
              }
              disabled={loading}
            />

            <button
              type="submit"
              disabled={loading}
              className="auth-primary-btn"
            >
              {loading
                ? "Creating secure account..."
                : "Create Account"}
            </button>
          </form>

          {message && (
            <div className="auth-message error">
              {message}
            </div>
          )}

          <p className="auth-footer">
            Already have an account?{" "}
            <Link href={loginHref}>
              Sign in
            </Link>
          </p>

          <p className="auth-secure-note">
            🔒 Email ownership verification protects Cric4All accounts
          </p>
        </div>
      </section>
    </main>
  );
}
