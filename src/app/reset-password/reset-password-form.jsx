"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

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

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);    

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
  <div className="password-input-wrapper">        
  <input
    type={showPassword ? "text" : "password"}
    value={password}
    onChange={(e) =>
      setPassword(e.target.value)
    }
    required
    placeholder="New Password"
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
<div className="password-input-wrapper">
  <input
    type={showConfirmPassword ? "text" : "password"}
    value={confirm}
onChange={(e) =>
              setConfirm(
                e.target.value
              )
    }
    required
    placeholder="Confirm password"
  />

  <button
    type="button"
    className="password-toggle"
    onClick={() =>
      setShowConfirmPassword((prev) => !prev)
    }
    aria-label={
      showConfirmPassword
        ? "Hide password"
        : "Show password"
    }
  >
    {showConfirmPassword ? (
  <EyeOff size={18} />
) : (
  <Eye size={18} />
)}
  </button>
  </div>
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