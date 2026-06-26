"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export default function AuthNav() {
  const { data: session, status } = useSession();

  return (
    <nav className="auth-nav auth-nav-compact">
      <Link href="/" className="nav-link nav-home">
        ← Home
      </Link>

      <div className="auth-nav-center">
        <Link href="/explore" className="nav-link">
          Explore
        </Link>

        <Link href="/contact" className="nav-link">
          Contact
        </Link>
      </div>

      <div className="auth-nav-right">
        {status === "loading" ? (
          <span className="loading-text">Loading...</span>
        ) : session ? (
          <>
            <span className="user-avatar" title={session.user?.email}>
              👤
            </span>

            <button
              type="button"
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
          <Link href="/login" className="login-btn">
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}