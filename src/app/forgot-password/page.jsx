"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const res = await fetch("/api/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    setLoading(false);

    if (res.ok) {
      setMessage("If an account exists, a reset email has been sent.");
    } else {
      setMessage("Unable to send reset link. Please try again.");
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-left">
          <div className="auth-brand">
            <div className="auth-logo">🔐</div>
            <div>
              <h2>Cric4All</h2>
              <p>Secure cricket scoring dashboard.</p>
            </div>
          </div>

          <h3>Recover access safely.</h3>

          <p className="auth-description">
            Enter your account email and we will send a secure password reset
            link if an account exists.
          </p>

          <div className="auth-feature-grid">
            <span>Secure reset link</span>
            <span>Email verification</span>
            <span>Protected dashboard</span>
            <span>Fast account recovery</span>
          </div>
        </div>

        <div className="auth-right">
          <h1>Reset password</h1>

          <p className="auth-subtitle">
            We’ll help you get back into your Cric4All account.
          </p>

          <form onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="auth-primary-btn"
            >
              {loading ? "Sending reset link..." : "Send Reset Link"}
            </button>
          </form>

          {message && (
            <div
              className={
                message.includes("sent")
                  ? "auth-message success"
                  : "auth-message error"
              }
            >
              {message}
            </div>
          )}

          <p className="auth-footer">
            Remember your password? <Link href="/login">Sign in</Link>
          </p>

          <p className="auth-secure-note">
            🔒 Password reset powered by Cric4All
          </p>
        </div>
      </section>
    </main>
  );
}