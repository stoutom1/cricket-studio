"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export default function AuthNav() {
  const { data: session, status } = useSession();

  return (
    <div className="auth-nav">
      {status === "loading" ? (
        <span className="muted">Loading...</span>
      ) : session ? (
        <>
          <span className="muted">👤 {session.user?.email}</span>
          <Link href="/">Dashboard</Link>
          <Link href="/about">About Us</Link>
          <Link href="/contact">Contact Us</Link>
          <button
            className="btn btn-outline"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </button>
        </>
      ) : (
        <Link href="/login" className="btn btn-outline"> Sign in </Link>,
        <Link href="/about">About Us</Link>,
        <Link href="/contact">Contact Us</Link>
      )}
    </div>
  );
}