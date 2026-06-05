"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] =
    useState("");

  const [message, setMessage] =
    useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    const res = await fetch(
      "/api/forgot-password",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          email
        })
      }
    );

    if (res.ok) {
      setMessage(
        "If an account exists, a reset email has been sent."
      );
    }
  }

  return (
    <div className="center-screen">
      <div className="card">
        <h1>
          Reset Password
        </h1>

        <form
          onSubmit={
            handleSubmit
          }
        >
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(
                e.target.value
              )
            }
            required
          />

          <button
            type="submit"
          >
            Send Reset Link
          </button>
        </form>

        {message && (
          <p>{message}</p>
        )}
      </div>
    </div>
  );
}