"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl =
    searchParams.get("callbackUrl") ||
    "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    console.log(callbackUrl);
    console.log(email, password);
    const result = await signIn(
      "credentials",
      {
        email,
        password,
        redirect: false
      }
    );

    if (!result?.ok) {
      setError("Invalid email or password");
      return;
    }

    router.push(callbackUrl);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="form stack"
    >
      <label>
        <span>Email</span>

        <input
          type="email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          required
        />
      </label>

      <label>
        <span>Password</span>

        <input
          type="password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          required
        />
      </label>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn"
      >
        Sign In
      </button>

      <div style={{ marginTop: 12 }}>
        New user?{" "}
        <Link href="/register">
          Create Account
        </Link>
      </div>
    </form>
  );
}