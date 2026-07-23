"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(
  base64String
) {
  const padding =
    "=".repeat(
      (4 - (base64String.length % 4)) % 4
    );

  const base64 = (
    base64String + padding
  )
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData =
    window.atob(base64);

  return Uint8Array.from(
    [...rawData].map(
      (character) =>
        character.charCodeAt(0)
    )
  );
}

function isIosDevice() {
  const userAgent =
    window.navigator.userAgent;

  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1
    )
  );
}

function isStandaloneMode() {
  return (
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    window.navigator.standalone === true
  );
}

export default function BirthdayPushSettings() {
  const [supported, setSupported] =
    useState(true);

  const [isSubscribed, setIsSubscribed] =
    useState(false);

  const [isBusy, setIsBusy] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [showIosInstallHelp, setShowIosInstallHelp] =
    useState(false);

  useEffect(() => {
    async function loadCurrentState() {
      const browserSupportsPush =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      setSupported(browserSupportsPush);

      if (!browserSupportsPush) {
        return;
      }

      /*
       * On iPhone, push must be enabled from the
       * Home Screen-installed Cric4All web app.
       */
      if (
        isIosDevice() &&
        !isStandaloneMode()
      ) {
        setShowIosInstallHelp(true);
        return;
      }

      try {
        const registration =
          await navigator.serviceWorker.register(
            "/sw.js",
            {
              scope: "/",
            }
          );

        await navigator.serviceWorker.ready;

        const subscription =
          await registration.pushManager
            .getSubscription();

        setIsSubscribed(
          Boolean(subscription)
        );
      } catch (error) {
        console.error(
          "Service worker initialization failed:",
          error
        );

        setMessage(
          "Cric4All could not initialize browser notifications."
        );
      }
    }

    loadCurrentState();
  }, []);

  async function enableNotifications() {
    setIsBusy(true);
    setMessage("");

    try {
      if (
        isIosDevice() &&
        !isStandaloneMode()
      ) {
        setShowIosInstallHelp(true);

        throw new Error(
          "On iPhone, first add Cric4All to the Home Screen and open it from the new icon."
        );
      }

      const publicKey =
        process.env
          .NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        throw new Error(
          "The Cric4All push public key is missing."
        );
      }

      /*
       * Register the service worker.
       */
      const registration =
        await navigator.serviceWorker.register(
          "/sw.js",
          {
            scope: "/",
          }
        );

      await navigator.serviceWorker.ready;

      /*
       * This permission request occurs directly inside
       * a user button click, as required on iPhone.
       */
      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error(
          permission === "denied"
            ? "Notifications are blocked in your browser settings."
            : "Notification permission was not granted."
        );
      }

      let subscription =
        await registration.pushManager
          .getSubscription();

      if (!subscription) {
        subscription =
          await registration.pushManager
            .subscribe({
              userVisibleOnly: true,

              applicationServerKey:
                urlBase64ToUint8Array(
                  publicKey
                ),
            });
      }

      const subscriptionJson =
        subscription.toJSON();

      const response = await fetch(
        "/api/push/subscribe",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            subscription:
              subscriptionJson,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to save notification subscription."
        );
      }

      setIsSubscribed(true);

      setMessage(
        "Birthday notifications are enabled on this device."
      );
    } catch (error) {
      console.error(
        "Enabling notifications failed:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to enable notifications."
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function disableNotifications() {
    setIsBusy(true);
    setMessage("");

    try {
      const registration =
        await navigator.serviceWorker.ready;

      const subscription =
        await registration.pushManager
          .getSubscription();

      if (!subscription) {
        setIsSubscribed(false);

        setMessage(
          "Notifications are already disabled on this device."
        );

        return;
      }

      const endpoint =
        subscription.endpoint;

      const response = await fetch(
        "/api/push/unsubscribe",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            endpoint,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to update notification settings."
        );
      }

      await subscription.unsubscribe();

      setIsSubscribed(false);

      setMessage(
        "Birthday notifications are disabled on this device."
      );
    } catch (error) {
      console.error(
        "Disabling notifications failed:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to disable notifications."
      );
    } finally {
      setIsBusy(false);
    }
  }

  if (!supported) {
    return (
      <section className="birthday-push-card">
        <h2>Birthday Notifications</h2>

        <p>
          This browser does not support Web Push
          notifications.
        </p>
      </section>
    );
  }
async function sendTestNotification() {
  setIsBusy(true);
  setMessage("");

  try {
    const response = await fetch(
      "/api/push/test",
      {
        method: "POST",
      }
    );

    const result =
      await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result?.error ||
          "Test notification failed."
      );
    }

    setMessage(
      "Test notification sent. Check this device."
    );
  } catch (error) {
    setMessage(
      error instanceof Error
        ? error.message
        : "Test notification failed."
    );
  } finally {
    setIsBusy(false);
  }
}
  return (
    <section className="birthday-push-card">
      <div className="birthday-push-heading">
        <div>
          <h2>
            🔔 Birthday Notifications
          </h2>

          <p>
            Receive a phone alert when a player
            in one of your leagues has a
            birthday.
          </p>
        </div>

        <span
          className={
            isSubscribed
              ? "push-status push-status-on"
              : "push-status push-status-off"
          }
        >
          {isSubscribed
            ? "Enabled"
            : "Not enabled"}
        </span>
        {isSubscribed && (
  <button
    type="button"
    onClick={sendTestNotification}
    disabled={isBusy}
    className="birthday-push-test"
  >
    Send Test Notification
  </button>
)}
      </div>

      {showIosInstallHelp && (
        <div className="ios-install-help">
          <strong>
            iPhone setup required
          </strong>

          <ol>
            <li>
              Open Cric4All in Safari.
            </li>

            <li>
              Tap the Safari Share button.
            </li>

            <li>
              Tap Add to Home Screen.
            </li>

            <li>
              Open Cric4All using the new
              Home Screen icon.
            </li>

            <li>
              Return to this screen and tap
              Enable Birthday Notifications.
            </li>
          </ol>
        </div>
      )}

      <div className="birthday-push-actions">
        {!isSubscribed ? (
          <button
            type="button"
            onClick={
              enableNotifications
            }
            disabled={isBusy}
            className="birthday-push-enable"
          >
            {isBusy
              ? "Enabling..."
              : "Enable Birthday Notifications"}
          </button>
        ) : (
          <button
            type="button"
            onClick={
              disableNotifications
            }
            disabled={isBusy}
            className="birthday-push-disable"
          >
            {isBusy
              ? "Disabling..."
              : "Disable on This Device"}
          </button>
        )}
      </div>

      {message && (
        <p className="birthday-push-message">
          {message}
        </p>
      )}
    </section>
  );
}