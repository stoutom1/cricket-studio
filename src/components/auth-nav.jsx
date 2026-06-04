"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export default function AuthNav() {
  const { data: session, status } = useSession();

  return (
<nav className="auth-nav">
  <div className="nav-brand">
    <Link href="/">
      Dashboard
    </Link>
  </div>

  <div className="nav-links">
    <Link href="/about">About</Link>
    <Link href="/contact">Contact</Link>
    <Link href="/help">Help</Link>
  </div>

  <div className="nav-auth">
    {status === "loading" ? (
      <span className="loading-text">Loading...</span>
    ) : session ? (
      <>
        <div className="user-info">
          <span className="user-avatar">👤</span>
          <span className="user-email">
            {session.user?.email}
          </span>
        </div>

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