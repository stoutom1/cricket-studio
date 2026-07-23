"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

export default function BirthdayPushSettings({
  leagueId,
}) {
const [supported, setSupported] =
  useState(null);

const [notificationStateLoaded, setNotificationStateLoaded] =
  useState(false);

  const [isSubscribed, setIsSubscribed] =
    useState(false);

  const [isBusy, setIsBusy] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [showIosInstallHelp, setShowIosInstallHelp] =
    useState(false);

useEffect(() => {
  let isMounted = true;

  async function loadCurrentState() {
    const browserSupportsPush =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    if (!isMounted) {
      return;
    }

    setSupported(browserSupportsPush);

    if (!browserSupportsPush) {
      setIsSubscribed(false);
      setNotificationStateLoaded(true);
      return;
    }

    /*
     * On iPhone, browser push works only when
     * Cric4All is opened from the Home Screen app.
     *
     * Birthday Management must still remain visible.
     */
    if (
      isIosDevice() &&
      !isStandaloneMode()
    ) {
      setShowIosInstallHelp(true);
      setIsSubscribed(false);
      setNotificationStateLoaded(true);
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

      if (!isMounted) {
        return;
      }

      setIsSubscribed(Boolean(subscription));
    } catch (error) {
      console.error(
        "Service worker initialization failed:",
        error
      );

      if (!isMounted) {
        return;
      }

      setIsSubscribed(false);

      setMessage(
        "Cric4All could not initialize browser notifications."
      );
    } finally {
      if (isMounted) {
        setNotificationStateLoaded(true);
      }
    }
  }

  loadCurrentState();

  return () => {
    isMounted = false;
  };
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

async function sendTestNotification() {
  setIsBusy(true);
  setMessage("");

  try {
    const numericLeagueId = Number(leagueId);

    if (
      !Number.isInteger(numericLeagueId) ||
      numericLeagueId <= 0
    ) {
      throw new Error(
        "A valid league ID is required to send the test notification."
      );
    }

    const response = await fetch(
      "/api/push/test",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          leagueId: numericLeagueId,
        }),
      }
    );

    const responseText =
  await response.text();

let result = {};

if (responseText) {
  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(
      `The server returned an invalid response with status ${response.status}.`
    );
  }
}

if (!response.ok || !result.success) {
  throw new Error(
    result?.error ||
      `Test notification failed with status ${response.status}.`
  );
}

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
    console.error(
      "Test notification failed:",
      error
    );

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
    <section
  className="birthday-push-card"
  data-birthday-push-settings="true"
  style={{
    display: "block",
    visibility: "visible",
    opacity: 1,
  }}
>
  <div className="birthday-push-heading">
    <div className="birthday-push-title-row">
      <span
        className="birthday-push-title-icon"
        aria-hidden="true"
      >
        🔔
      </span>

      <div className="birthday-push-title-copy">
        <h2>Birthday Management and Notifications</h2>

<p>
  {supported === false
    ? "This browser does not support birthday push notifications. Birthday Management is still available."
    : showIosInstallHelp
      ? "Add Cric4All to your iPhone Home Screen to receive alerts. Birthday Management is still available."
      : "Receive a phone alert when a player in one of your leagues has a birthday."}
</p>
      </div>
    </div>

<span
  className={
    supported === true && isSubscribed
      ? "push-status push-status-on"
      : "push-status push-status-off"
  }
>
  <span
    className="push-status-dot"
    aria-hidden="true"
  />

  {!notificationStateLoaded
    ? "Checking..."
    : supported === false
      ? "Not supported"
      : showIosInstallHelp
        ? "Setup required"
        : isSubscribed
          ? "Enabled"
          : "Not enabled"}
</span>
  </div>

  <div className="birthday-push-actions">
  {!notificationStateLoaded ? (
    <button
      type="button"
      disabled
      className="birthday-push-action birthday-push-enable"
    >
      <span
        className="birthday-push-action-icon"
        aria-hidden="true"
      >
        🔔
      </span>

      <span className="birthday-push-action-copy">
        <strong>Checking Notifications...</strong>

        <small>
          Checking this device
        </small>
      </span>

      <span
        className="birthday-push-action-arrow"
        aria-hidden="true"
      >
        ›
      </span>
    </button>
  ) : supported === false ? (
    <div
      className="birthday-push-action birthday-push-unavailable"
      role="status"
    >
      <span
        className="birthday-push-action-icon"
        aria-hidden="true"
      >
        🔕
      </span>

      <span className="birthday-push-action-copy">
        <strong>
          Notifications Not Supported
        </strong>

        <small>
          This browser cannot receive push alerts
        </small>
      </span>
    </div>
  ) : showIosInstallHelp ? (
    <div
      className="birthday-push-action birthday-push-unavailable"
      role="status"
    >
      <span
        className="birthday-push-action-icon"
        aria-hidden="true"
      >
        📱
      </span>

      <span className="birthday-push-action-copy">
        <strong>
          Add Cric4All to Home Screen
        </strong>

        <small>
          Open the installed app to enable alerts
        </small>
      </span>
    </div>
  ) : isSubscribed ? (
    <button
      type="button"
      onClick={disableNotifications}
      disabled={isBusy}
      className="birthday-push-action birthday-push-disable"
    >
      <span
        className="birthday-push-action-icon"
        aria-hidden="true"
      >
        🔕
      </span>

      <span className="birthday-push-action-copy">
        <strong>
          {isBusy
            ? "Disabling..."
            : "Disable on This Device"}
        </strong>

        <small>
          Stop birthday alerts on this device
        </small>
      </span>

      <span
        className="birthday-push-action-arrow"
        aria-hidden="true"
      >
        ›
      </span>
    </button>
  ) : (
    <button
      type="button"
      onClick={enableNotifications}
      disabled={isBusy}
      className="birthday-push-action birthday-push-enable"
    >
      <span
        className="birthday-push-action-icon"
        aria-hidden="true"
      >
        🔔
      </span>

      <span className="birthday-push-action-copy">
        <strong>
          {isBusy
            ? "Enabling..."
            : "Enable Notifications"}
        </strong>

        <small>
          Receive birthday alerts on this device
        </small>
      </span>

      <span
        className="birthday-push-action-arrow"
        aria-hidden="true"
      >
        ›
      </span>
    </button>
  )}

  <Link
    href={`/leagues/${Number(leagueId)}/birthdays`}
    className="birthday-management-btn"
  >
    <span className="birthday-icon">
      🎂
    </span>

    <div className="birthday-text">
      <span className="birthday-title">
        Birthday Management
      </span>

      <span className="birthday-subtitle">
        Add • Edit • Import Birthdays
      </span>
    </div>

    <span className="birthday-arrow">
      ➜
    </span>
  </Link>
</div>

  {message && (
    <p className="birthday-push-message">
      {message}
    </p>
  )}
</section>
  );
}