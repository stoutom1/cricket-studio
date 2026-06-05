"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordForm({
  token
}) {
  const router = useRouter();

  const [password, setPassword] =
    useState("");

  const [confirm, setConfirm] =
    useState("");

  const [message, setMessage] =
    useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    if (password !== confirm) {
      setMessage(
        "Passwords do not match"
      );
      return;
    }

    const res = await fetch(
      "/api/reset-password",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          token,
          password
        })
      }
    );

    const data =
      await res.json();

    if (!res.ok) {
      setMessage(
        data.error
      );
      return;
    }

    router.push("/login");
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
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }
            required
          />

          <input
            type="password"
            placeholder="Confirm Password"
            value={confirm}
            onChange={(e) =>
              setConfirm(
                e.target.value
              )
            }
            required
          />

          <button
            type="submit"
          >
            Update Password
          </button>
        </form>

        {message && (
          <p>{message}</p>
        )}
      </div>
    </div>
  );
}