"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import {
  PUSH_STATUS_EVENT,
} from "@/components/native-push-runtime";

function getPlatformLabel() {
  const platform =
    Capacitor.getPlatform();

  if (
    platform === "ios"
  ) {
    return "iPhone";
  }

  if (
    platform === "android"
  ) {
    return "Android";
  }

  return "device";
}

export default function NativeNotificationControl() {
  const [
    native,
    setNative,
  ] =
    useState(
      false
    );

  const [
    permission,
    setPermission,
  ] =
    useState(
      "unknown"
    );

  const [
    busy,
    setBusy,
  ] =
    useState(
      false
    );

  const [
    message,
    setMessage,
  ] =
    useState(
      ""
    );

  const refresh =
    useCallback(
      async () => {
        if (
          !Capacitor.isNativePlatform()
        ) {
          setNative(
            false
          );

          return;
        }

        setNative(
          true
        );

        try {
          const result =
            await PushNotifications
              .checkPermissions();

          setPermission(
            result.receive ||
            "unknown"
          );
        } catch (
          error
        ) {
          console.warn(
            "[NATIVE_PUSH_STATUS_FAILED]",
            error
          );

          setPermission(
            "unknown"
          );
        }
      },
      []
    );

  useEffect(() => {
    void refresh();

    const handleStatus =
      (
        event
      ) => {
        const state =
          event
            ?.detail
            ?.state;

        if (state) {
          setPermission(
            state ===
              "registered"
              ? "granted"
              : state
          );
        }

        if (
          event
            ?.detail
            ?.message
        ) {
          setMessage(
            event.detail
              .message
          );
        }
      };

    window.addEventListener(
      PUSH_STATUS_EVENT,
      handleStatus
    );

    return () => {
      window.removeEventListener(
        PUSH_STATUS_EVENT,
        handleStatus
      );
    };
  }, [
    refresh,
  ]);

  if (!native) {
    return null;
  }

  const enabled =
    permission ===
      "granted";

  const denied =
    permission ===
      "denied";

  async function enable() {
    if (
      busy ||
      denied
    ) {
      return;
    }

    setBusy(
      true
    );

    setMessage(
      ""
    );

    try {
      let result =
        await PushNotifications
          .checkPermissions();

      if (
        result.receive ===
          "prompt"
      ) {
        result =
          await PushNotifications
            .requestPermissions();
      }

      setPermission(
        result.receive
      );

      if (
        result.receive !==
          "granted"
      ) {
        setMessage(
          result.receive ===
            "denied"
            ? `Notifications are blocked for Cric4All on this ${getPlatformLabel()}. You can enable them later in system Settings.`
            : "Notification permission was not granted."
        );

        return;
      }

      await PushNotifications
        .register();

      setMessage(
        "App notifications are enabled. Cric4All will register this device for supported alerts."
      );
    } catch (
      error
    ) {
      console.error(
        "[NATIVE_PUSH_ENABLE_FAILED]",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to enable app notifications."
      );
    } finally {
      setBusy(
        false
      );
    }
  }

  return (
    <div
      style={{
        display:
          "grid",
        gap:
          7,
        width:
          "100%",
      }}
    >
      <button
        type="button"
        className="account-secondary-action"
        onClick={
          enable
        }
        disabled={
          busy ||
          enabled ||
          denied
        }
        title={
          denied
            ? "Notifications are blocked in system Settings."
            : undefined
        }
      >
        {enabled
          ? "✅ App Notifications Enabled"
          : denied
            ? "🔕 App Notifications Blocked"
            : busy
              ? "🔔 Enabling Notifications…"
              : "🔔 Enable App Notifications"}
      </button>

      {message ? (
        <span
          style={{
            color:
              "#94a3b8",
            fontSize:
              "0.78rem",
            lineHeight:
              1.4,
            textAlign:
              "left",
          }}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
