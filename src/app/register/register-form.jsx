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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#030712",
        color: "white"
      }}
    >
      <form
        onSubmit={handleRegister}
        style={{
          width: 420,
          background: "#111827",
          padding: 30,
          borderRadius: 16
        }}
      >
        <h1
          style={{
            fontSize: 32,
            marginBottom: 24
          }}
        >
          Create Account
        </h1>

        <input
          type="text"
          placeholder="Full name"
          value={name}
          onChange={(e) =>
            setName(e.target.value)
          }
          required
          style={inputStyle}
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          required
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          required
          style={inputStyle}
        />

        <button
          type="submit"
          disabled={loading}
          style={buttonStyle}
        >
          {loading
            ? "Creating account..."
            : "Register"}
        </button>

        {message ? (
          <p
            style={{
              marginTop: 16,
              color: "#d1d5db"
            }}
          >
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 12,
  marginBottom: 16,
  borderRadius: 10,
  border: "1px solid #374151",
  background: "#1f2937",
  color: "white"
};

const buttonStyle = {
  width: "100%",
  padding: 12,
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 700,
  cursor: "pointer"
};