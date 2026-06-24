"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";


export default function RegisterForm({
  callbackUrl
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

  async function handleRegister(e) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const res = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        email,
        password
      })
    });

    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setMessage(data.error || "Registration failed");
      return;
    }

setMessage("Registration successful");

const result = await signIn(
  "credentials",
  {
    email,
    password,
    redirect: false,
    callbackUrl:
      callbackUrl || "/dashboard",
  }
);

if (result?.ok) {
  router.push(
    callbackUrl || "/dashboard"
  );
} else {
  router.push(
    callbackUrl
      ? `/login?callbackUrl=${encodeURIComponent(
          callbackUrl
        )}`
      : "/login"
  );
}
  }

return (
  <main className="auth-page">
    <section className="auth-card">
      <div className="auth-left">
        <div className="auth-brand">
          <div className="auth-logo">🏏</div>
          <div>
            <h2>Cric4All</h2>
            <p>Live cricket scoring made simple.</p>
          </div>
        </div>

        <h3>Start scoring matches in minutes.</h3>

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
          Join Cric4All and start managing cricket matches.
        </p>

        <form onSubmit={handleRegister}>
          <label className="auth-field">
            <span>Full name</span>
            <input
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

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

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              placeholder="Create a secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button type="submit" disabled={loading} className="auth-primary-btn">
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        {message && (
          <div
            className={
              message.includes("successful")
                ? "auth-message success"
                : "auth-message error"
            }
          >
            {message}
          </div>
        )}

        <p className="auth-footer">
          Already have an account? <a href="/login">Sign in</a>
        </p>

        <p className="auth-secure-note">
          🔒 Secure account creation powered by Cric4All
        </p>
      </div>
    </section>
  </main>
);
}