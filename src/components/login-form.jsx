"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";

export default function LoginForm({
  callbackUrl = {callbackUrl}
}) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const result = await signIn(
        "credentials",
        {
          email,
          password,
          redirect: false,
          callbackUrl: callbackUrl || "/dashboard",
        }
      );

      if (!result?.ok) {
        setError("Invalid email or password");
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Unable to sign in");
    } finally {
      setLoading(false);
    }
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
          autoComplete="email"
        />
      </label>

<label>
  <span>Password</span>
<div className="password-input-wrapper">
  <input
    type={showPassword ? "text" : "password"}
    value={password}
    onChange={(e) =>
      setPassword(e.target.value)
    }
    required
    autoComplete="current-password"
    placeholder="Enter password"
  />
  <button
    type="button"
    className="password-toggle"
    onClick={() => setShowPassword((prev) => !prev)}
    aria-label={
      showPassword ? "Hide password" : "Show password"
    }
  >
    {showPassword ? (
  <EyeOff size={18} />
) : (
  <Eye size={18} />
)}
  </button>
</div>  
</label>
<div
  style={{
    textAlign: "right",
    marginTop: -8,
    marginBottom: 12,
  }}
>
<Link
  href={
    callbackUrl
      ? `/forgot-password?callbackUrl=${encodeURIComponent(
          callbackUrl
        )}`
      : "/forgot-password"
  }
  style={{
    fontSize: "0.9rem",
    color: "#60a5fa",
    textDecoration: "none",
  }}
>
  Forgot Password?
</Link>
</div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn"
        disabled={loading}
      >
        {loading
          ? "Signing In..."
          : "Sign In"}
      </button>

      <div
        style={{
          marginTop: 12,
          textAlign: "center"
        }}
      >
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
  Create Account
</Link>
      </div>
    </form>
  );
}