"use client";

import Link from "next/link";
import {
  getSession,
  signOut,
  useSession,
} from "next-auth/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import UserHeartbeat from "@/components/user-heartbeat";
import OfflineScoringResumeBanner from "@/components/offline-scoring-resume-banner";
import NativeNotificationControl from "@/components/native-notification-control";

const AUTH_HINT_KEY =
  "cric4all.authHint.v2";

function readAuthHint() {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  try {
    const raw =
      window.sessionStorage.getItem(
        AUTH_HINT_KEY
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== "object"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeAuthHint(
  user
) {
  if (
    typeof window === "undefined" ||
    !user
  ) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      AUTH_HINT_KEY,
      JSON.stringify({
        name:
          user?.name ||
          "",
        email:
          user?.email ||
          "",
      })
    );
  } catch {
    // UI continuity must never be required for authentication.
  }
}

function clearAuthHint() {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  try {
    window.sessionStorage.removeItem(
      AUTH_HINT_KEY
    );
  } catch {
    // Ignore storage failures.
  }
}

export default function AuthNav() {
  const {
    data: providerSession,
    status,
    update: updateSession,
  } = useSession();

  const [
    recoveredSession,
    setRecoveredSession,
  ] =
    useState(
      null
    );

  const [
    cachedUser,
    setCachedUser,
  ] =
    useState(
      null
    );

  const [
    showAccountModal,
    setShowAccountModal,
  ] =
    useState(
      false
    );

  const [
    isOffline,
    setIsOffline,
  ] =
    useState(
      false
    );

  const [
    reconnecting,
    setReconnecting,
  ] =
    useState(
      false
    );

  const reconnectRef =
    useRef(
      false
    );

  const mountedRef =
    useRef(
      true
    );

  /*
   * providerSession is normally authoritative.
   *
   * recoveredSession exists so the header can immediately recover from a
   * stale NextAuth client state after offline -> online without waiting for a
   * second provider render.
   */
  const liveSession =
    providerSession ||
    recoveredSession;

  const liveUser =
    liveSession
      ?.user ||
    null;

  useEffect(() => {
    const remembered =
      readAuthHint();

    if (remembered) {
      setCachedUser(
        remembered
      );
    }

    setIsOffline(
      typeof navigator !==
        "undefined" &&
      navigator.onLine ===
        false
    );
  }, []);

  /*
   * Keep a display-only identity hint whenever NextAuth has positively
   * confirmed authentication.
   */
  useEffect(() => {
    if (
      status ===
        "authenticated" &&
      providerSession
        ?.user
    ) {
      setRecoveredSession(
        null
      );

      setCachedUser(
        providerSession.user
      );

      writeAuthHint(
        providerSession.user
      );
    }
  }, [
    status,
    providerSession,
  ]);

  const verifySessionOnline =
    useCallback(
      async () => {
        if (
          reconnectRef.current
        ) {
          return;
        }

        reconnectRef.current =
          true;

        if (
          mountedRef.current
        ) {
          setReconnecting(
            true
          );
        }

        try {
          /*
           * Give the browser a short moment after the online event. Then make
           * an explicit NextAuth session request.
           *
           * getSession({ broadcast: true }) also informs other NextAuth
           * listeners/tabs. We additionally keep the returned session locally
           * so the header updates immediately even if useSession() is stale.
           */
          await new Promise(
            (
              resolve
            ) => {
              window.setTimeout(
                resolve,
                300
              );
            }
          );

          const freshSession =
            await getSession({
              broadcast:
                true,
            });

          if (
            !mountedRef.current
          ) {
            return;
          }

          if (
            freshSession
              ?.user
          ) {
            setRecoveredSession(
              freshSession
            );

            setCachedUser(
              freshSession.user
            );

            writeAuthHint(
              freshSession.user
            );

            /*
             * Ask the mounted provider to catch up too. The header does not
             * depend on this call succeeding because recoveredSession already
             * contains the verified result.
             */
            try {
              await updateSession();
            } catch {
              // Keep the freshly verified session displayed.
            }

            return;
          }

          /*
           * Only a SUCCESSFUL online verification returning no user may clear
           * the remembered identity and show Sign In.
           */
          setRecoveredSession(
            null
          );

          setCachedUser(
            null
          );

          clearAuthHint();

          setShowAccountModal(
            false
          );
        } catch (
          error
        ) {
          /*
           * A reconnect request failing is NOT a logout.
           * Preserve the cached account identity and retry on a later online /
           * focus / visibility event.
           */
          console.warn(
            "[AUTH_RECONNECT_VERIFY_FAILED]",
            error
          );
        } finally {
          reconnectRef.current =
            false;

          if (
            mountedRef.current
          ) {
            setReconnecting(
              false
            );
          }
        }
      },
      [
        updateSession,
      ]
    );

  useEffect(() => {
    mountedRef.current =
      true;

    const handleOffline =
      () => {
        if (
          !mountedRef.current
        ) {
          return;
        }

        setIsOffline(
          true
        );

        setReconnecting(
          false
        );
      };

    const handleOnline =
      () => {
        if (
          !mountedRef.current
        ) {
          return;
        }

        setIsOffline(
          false
        );

        void verifySessionOnline();
      };

    window.addEventListener(
      "offline",
      handleOffline
    );

    window.addEventListener(
      "online",
      handleOnline
    );

    return () => {
      mountedRef.current =
        false;

      window.removeEventListener(
        "offline",
        handleOffline
      );

      window.removeEventListener(
        "online",
        handleOnline
      );
    };
  }, [
    verifySessionOnline,
  ]);

  /*
   * Mobile browsers can resume a page without delivering a clean online event.
   * Focus/visibility therefore gets one guarded retry when the header has a
   * remembered authenticated identity but the provider is not authenticated.
   */
  useEffect(() => {
    const maybeVerify =
      () => {
        if (
          navigator.onLine ===
            false
        ) {
          return;
        }

        setIsOffline(
          false
        );

        if (
          (
            cachedUser ||
            recoveredSession
              ?.user
          ) &&
          status !==
            "authenticated"
        ) {
          void verifySessionOnline();
        }
      };

    const handleVisibility =
      () => {
        if (
          document.visibilityState ===
            "visible"
        ) {
          maybeVerify();
        }
      };

    window.addEventListener(
      "focus",
      maybeVerify
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      window.removeEventListener(
        "focus",
        maybeVerify
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [
    cachedUser,
    recoveredSession,
    status,
    verifySessionOnline,
  ]);

  const displayUser =
    liveUser ||
    cachedUser;

  const firstName =
    displayUser
      ?.name
      ?.trim()
      ?.split(
        /\s+/
      )
      ?.[0] ||
    "Account";

  const confirmedAuthenticated =
    Boolean(
      liveSession
        ?.user
    );

  /*
   * If we have a remembered authenticated identity, never flash a false
   * "Sign In" merely because the NextAuth hook is stale after an outage.
   */
  const hasRememberedIdentity =
    Boolean(
      displayUser
    );

  const openAccountMenu =
    () => {
      if (
        confirmedAuthenticated
      ) {
        setShowAccountModal(
          true
        );

        return;
      }

      if (
        !isOffline &&
        hasRememberedIdentity
      ) {
        void verifySessionOnline();
      }
    };

  const handleSignOut =
    async () => {
      clearAuthHint();

      setCachedUser(
        null
      );

      setRecoveredSession(
        null
      );

      setShowAccountModal(
        false
      );

      await signOut({
        callbackUrl:
          "/",
      });
    };

  return (
    <>
      <UserHeartbeat />

      <nav className="auth-nav auth-nav-compact">
        <Link
          href="/"
          className="nav-link nav-home"
        >
          ← Home
        </Link>

        <div className="auth-nav-center">
          <Link
            href="/explore"
            className="nav-link"
          >
            Explore
          </Link>

          <Link
            href="/contact"
            className="nav-link"
          >
            Contact
          </Link>
        </div>

        <div className="auth-nav-resume-slot">
          <OfflineScoringResumeBanner />
        </div>

        <div className="auth-nav-right">
          {reconnecting &&
          hasRememberedIdentity ? (
            <span
              className="loading-text"
              title="Restoring your Cric4All session..."
            >
              🔄 Reconnecting…
            </span>
          ) : confirmedAuthenticated ? (
            <button
              type="button"
              className="account-pill-btn"
              title="Account menu"
              onClick={
                openAccountMenu
              }
            >
              <span className="account-pill-avatar">
                👤
              </span>

              <span className="account-pill-name">
                {firstName}
              </span>

              <span className="account-pill-caret">
                ▾
              </span>
            </button>
          ) : isOffline &&
            hasRememberedIdentity ? (
            <button
              type="button"
              className="account-pill-btn"
              title="You are offline. Your account will be verified when Cric4All reconnects."
              aria-disabled="true"
            >
              <span className="account-pill-avatar">
                👤
              </span>

              <span className="account-pill-name">
                {firstName}
              </span>

              <span className="account-pill-caret">
                📴
              </span>
            </button>
          ) : hasRememberedIdentity ? (
            <button
              type="button"
              className="account-pill-btn"
              title="Verify account session"
              onClick={
                openAccountMenu
              }
            >
              <span className="account-pill-avatar">
                👤
              </span>

              <span className="account-pill-name">
                {firstName}
              </span>

              <span className="account-pill-caret">
                ↻
              </span>
            </button>
          ) : status ===
            "loading" ? (
            <span className="loading-text">
              Loading...
            </span>
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

      {showAccountModal &&
      confirmedAuthenticated &&
      typeof document !== "undefined" &&
      createPortal(
        <div className="account-modal-backdrop account-modal-portal-backdrop">
          <div className="account-modal account-modal-portal-card">
            <button
              type="button"
              className="account-close-btn"
              onClick={() =>
                setShowAccountModal(
                  false
                )
              }
            >
              ✕
            </button>

            <div className="account-hero">
              <div className="account-avatar-big">
                👤
              </div>

              <div>
                <span className="account-kicker">
                  Cric4All Account
                </span>

                <h2>
                  {liveSession
                    ?.user
                    ?.name ||
                    "Cricket User"}
                </h2>

                <p>
                  {liveSession
                    ?.user
                    ?.email}
                </p>
              </div>
            </div>

            <div className="account-wow-grid">
              <div>
                <strong>
                  🏏 Manage Cricket
                </strong>

                <span>
                  Create leagues, teams, players, matches, and scoring workflows.
                </span>
              </div>

              <div>
                <strong>
                  🎯 Score Faster
                </strong>

                <span>
                  Use Scorer Mode for quick match-day scoring.
                </span>
              </div>

              <div>
                <strong>
                  📤 Share Live
                </strong>

                <span>
                  Share spectator links with players, fans, and families.
                </span>
              </div>

              <div>
                <strong>
                  🤖 Review with AI
                </strong>

                <span>
                  Generate AI insights after completed matches.
                </span>
              </div>
            </div>

            <div className="account-actions">
              <Link
                href="/dashboard"
                className="account-primary-action"
                onClick={() =>
                  setShowAccountModal(
                    false
                  )
                }
              >
                📊 Go to Dashboard
              </Link>

              <Link
                href="/explore"
                className="account-secondary-action"
                onClick={() =>
                  setShowAccountModal(
                    false
                  )
                }
              >
                🌐 Explore Leagues
              </Link>

              <Link
                href="/privacy"
                className="account-secondary-action"
                onClick={() =>
                  setShowAccountModal(
                    false
                  )
                }
              >
                🔒 Privacy Policy
              </Link>

              <Link
                href="/delete-account"
                className="account-secondary-action"
                onClick={() =>
                  setShowAccountModal(
                    false
                  )
                }
              >
                🗑️ Delete Account
              </Link>

              <NativeNotificationControl />

              <button
                type="button"
                className="account-danger-action"
                onClick={
                  handleSignOut
                }
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
