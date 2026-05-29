"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("demo12345");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="form stack" onSubmit={handleSubmit}>
      <label>
        <span>Email</span>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      <label>
        <span>Password</span>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>

      {/* FORGOT PASSWORD */}
      <div
        style={{
          textAlign: "right",
          marginTop: "-6px",
          marginBottom: "10px"
        }}
      >
        <Link
          href="/forgot-password"
          style={{
            color: "#2563eb",
            fontSize: "14px",
            textDecoration: "none"
          }}
        >
          Forgot Password?
        </Link>
      </div>

      {error ? (
        <p className="error">
          ⚠️ {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="btn"
        disabled={loading}
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>

      {/* REGISTER LINK */}
      <div
        style={{
          marginTop: 20,
          textAlign: "center"
        }}
      >
        <span style={{ color: "#9ca3af" }}>
          Don&apos;t have an account?{" "}
        </span>

        <Link
          href="/register"
          style={{
            color: "#2563eb",
            fontWeight: 600,
            textDecoration: "none"
          }}
        >
          Create Account
        </Link>
      </div>
    </form>
  );
}