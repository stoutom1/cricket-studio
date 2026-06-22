"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

export default function LoginForm({ callbackUrl = "/dashboard" }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: callbackUrl || "/dashboard",
      });

      if (!result?.ok) {
        setError("Invalid email or password");
        return;
      }

      router.push(callbackUrl || "/dashboard");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card-pro">
        <div className="login-brand-side">
          <div className="login-logo-row">
            <div className="login-logo-badge">🏏</div>
            <div>
              <h1>Cric4All</h1>
              <p>Live cricket scoring made simple.</p>
            </div>
          </div>

          <div className="login-hero-copy">
            <h3>Score matches. Track stats. Share live updates.</h3>
            <p>
              Manage leagues, teams, scorecards, player stats, captaincy stats,
              wicketkeeping stats, league permissions and public live score links from one secure
              dashboard.
            </p>
          </div>

          <div className="login-feature-grid">
            <span>Live scoring</span>
            <span>Public scorecards</span>
            <span>Player statistics</span>
            <span>Mobile friendly</span>
          </div>

          <div className="login-qr-card">
            <QRCodeCanvas
              value="https://cric4all.app"
              size={108}
              includeMargin
            />

            <div>
              <strong>Open on mobile</strong>
              <p>Scan to launch Cric4All on your phone.</p>
            </div>
          </div>
        </div>

        <div className="login-form-side">
          <div className="login-form-card">
            <div className="login-form-head">
              <h2>Welcome back</h2>
              <p>Sign in to continue to your cricket dashboard.</p>
            </div>

            <form onSubmit={handleSubmit} className="login-form-clean">
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </label>

              <label>
                <span>Password</span>

                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter password"
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <div className="login-link-row">
                <Link
                  href={
                    callbackUrl
                      ? `/forgot-password?callbackUrl=${encodeURIComponent(
                          callbackUrl
                        )}`
                      : "/forgot-password"
                  }
                >
                  Forgot password?
                </Link>
              </div>

              {error && <div className="error">{error}</div>}

              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </button>

              <div className="login-register-row">
                New user?{" "}
                <Link
                  href={
                    callbackUrl
                      ? `/register?callbackUrl=${encodeURIComponent(
                          callbackUrl
                        )}`
                      : "/register"
                  }
                >
                  Create account
                </Link>
              </div>
              <div className="login-trust-line">
  🔒 Secure sign in powered by Cric4All
</div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}