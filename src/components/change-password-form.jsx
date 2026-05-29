"use client";

import { useState } from "react";

export default function ChangePasswordForm() {
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    setMessage("");
    setError("");

    const res = await fetch(
      "/api/change-password",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          currentPassword,
          newPassword
        })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setMessage(data.message);

    setCurrentPassword("");
    setNewPassword("");
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) =>
          setEmail(e.target.value)
        }
      />

      <input
        type="password"
        placeholder="Current Password"
        value={currentPassword}
        onChange={(e) =>
          setCurrentPassword(e.target.value)
        }
      />

      <input
        type="password"
        placeholder="New Password"
        value={newPassword}
        onChange={(e) =>
          setNewPassword(e.target.value)
        }
      />

      <button type="submit">
        Update Password
      </button>

      {message && <p>{message}</p>}
      {error && <p>{error}</p>}
    </form>
  );
}