"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CompleteProfileForm({
  token
}) {
  const router = useRouter();

  const [name, setName] =
    useState("");

  async function submit(e) {
    e.preventDefault();

    const response =
      await fetch("/api/users/register", {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          name
        })
      });

    if (!response.ok) {
      alert("Registration failed");
      return;
    }
console.log("before join in profile-form", token);
    router.push(
      `/register/${token}/join`
    );
  }

  return (
    <div className="auth-card">
      <h1>Complete Registration</h1>

      <form onSubmit={submit}>
        <input
          value={name}
          onChange={(e) =>
            setName(e.target.value)
          }
          placeholder="Full Name"
          required
        />

        <button type="submit">
          Continue
        </button>
      </form>
    </div>
  );
}