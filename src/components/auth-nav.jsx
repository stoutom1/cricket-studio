"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export default function AuthNav() {
  const { data: session, status } = useSession();

  return (
<nav className="auth-nav">
  <Link href="/" className="nav-home">
    ← Home
  </Link>

  <div className="nav-right">
    <Link href="/contact">Contact</Link>

    {status === "loading" ? (
      <span className="loading-text">
        Loading...
      </span>
    ) : session ? (
      <>
        <span
          className="user-avatar"
          title={session.user?.email}
        >
          👤
        </span>

        <button
          className="logout-btn"
          onClick={() =>
            signOut({
              callbackUrl: "/login",
            })
          }
        >
          Sign Out
        </button>
      </>
    ) : (
      <Link
        href="/login"
        className="login-btn"
      >
        Sign In
      </Link>
    )}
  </div>
</nav>
  );
}