"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import UserHeartbeat from "@/components/user-heartbeat";

export default function AuthNav() {
  const { data: session, status } = useSession();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!showAccountModal) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setShowAccountModal(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showAccountModal]);

  const accountModal =
    showAccountModal && session ? (
      <div
        className="account-modal-backdrop account-modal-portal-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setShowAccountModal(false);
          }
        }}
      >
        <div
          className="account-modal account-modal-portal-card"
          role="dialog"
          aria-modal="true"
          aria-label="Cric4All account menu"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="account-close-btn"
            aria-label="Close account menu"
            onClick={() => setShowAccountModal(false)}
          >
            ✕
          </button>

          <div className="account-hero">
            <div className="account-avatar-big">👤</div>

            <div>
              <span className="account-kicker">Cric4All Account</span>
              <h2>{session.user?.name || "Cricket User"}</h2>
              <p>{session.user?.email}</p>
            </div>
          </div>

          <div className="account-wow-grid">
            <div>
              <strong>🏏 Manage Cricket</strong>
              <span>
                Create leagues, teams, players, matches, and scoring workflows.
              </span>
            </div>

            <div>
              <strong>🎯 Score Faster</strong>
              <span>Use Scorer Mode for quick match-day scoring.</span>
            </div>

            <div>
              <strong>📤 Share Live</strong>
              <span>
                Share spectator links with players, fans, and families.
              </span>
            </div>

            <div>
              <strong>🤖 Review with AI</strong>
              <span>Generate AI insights after completed matches.</span>
            </div>
          </div>

          <div className="account-actions">
            <Link
              href="/dashboard"
              className="account-primary-action"
              onClick={() => setShowAccountModal(false)}
            >
              📊 Go to Dashboard
            </Link>

            <Link
              href="/explore"
              className="account-secondary-action"
              onClick={() => setShowAccountModal(false)}
            >
              🌐 Explore Leagues
            </Link>

            <Link
              href="/privacy"
              className="account-secondary-action"
              onClick={() => setShowAccountModal(false)}
            >
              🔒 Privacy Policy
            </Link>

            <Link
              href="/delete-account"
              className="account-secondary-action"
              onClick={() => setShowAccountModal(false)}
            >
              🗑️ Delete Account
            </Link>

            <button
              type="button"
              className="account-danger-action"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <UserHeartbeat />

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
            <button
              type="button"
              className="account-pill-btn"
              title="Account menu"
              onClick={() => setShowAccountModal(true)}
            >
              <span className="account-pill-avatar">👤</span>
              <span className="account-pill-name">
                {session.user?.name?.split(" ")[0] || "Account"}
              </span>
              <span className="account-pill-caret">▾</span>
            </button>
          ) : (
            <Link href="/login" className="login-btn">
              Sign In
            </Link>
          )}
        </div>
      </nav>

      {portalReady && accountModal
        ? createPortal(accountModal, document.body)
        : null}
    </>
  );
}
