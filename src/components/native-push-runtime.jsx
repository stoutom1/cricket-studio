"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { openCric4AllLink } from "@/lib/native-links";

const PUSH_STATUS_EVENT =
  "cric4all:native-push-status";

function emitStatus(detail) {
  if (
    typeof window ===
      "undefined"
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      PUSH_STATUS_EVENT,
      {
        detail: {
          ...detail,
          at:
            new Date()
              .toISOString(),
        },
      }
    )
  );
}

async function postNativeToken(
  tokenValue
) {
  const token =
    String(
      tokenValue ||
      ""
    ).trim();

  if (!token) {
    return;
  }

  const response =
    await fetch(
      "/api/push-devices",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            token,
            platform:
              Capacitor.getPlatform(),
          }),
      }
    );

  if (!response.ok) {
    const payload =
      await response
        .json()
        .catch(
          () => ({})
        );

    throw new Error(
      payload?.error ||
      "Unable to register this device for Cric4All notifications."
    );
  }
}

export default function NativePushRuntime() {
  useEffect(() => {
    if (
      !Capacitor.isNativePlatform()
    ) {
      return undefined;
    }

    let disposed =
      false;

    const handles =
      [];

    async function addHandle(
      promise
    ) {
      try {
        const handle =
          await promise;

        if (disposed) {
          await handle
            ?.remove
            ?.();

          return;
        }

        handles.push(
          handle
        );
      } catch (
        error
      ) {
        console.warn(
          "[NATIVE_PUSH_LISTENER_FAILED]",
          error
        );
      }
    }

    async function initialize() {
      await addHandle(
        PushNotifications.addListener(
          "registration",
          async (
            token
          ) => {
            try {
              await postNativeToken(
                token?.value
              );

              emitStatus({
                state:
                  "registered",
              });
            } catch (
              error
            ) {
              console.error(
                "[NATIVE_PUSH_DEVICE_SAVE_FAILED]",
                error
              );

              emitStatus({
                state:
                  "error",
                message:
                  error instanceof Error
                    ? error.message
                    : "Unable to save notification device.",
              });
            }
          }
        )
      );

      await addHandle(
        PushNotifications.addListener(
          "registrationError",
          (
            error
          ) => {
            console.error(
              "[NATIVE_PUSH_REGISTRATION_ERROR]",
              error
            );

            emitStatus({
              state:
                "error",
              message:
                "Cric4All could not register this device for notifications.",
            });
          }
        )
      );

      await addHandle(
        PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (
            action
          ) => {
            const targetUrl =
              action
                ?.notification
                ?.data
                ?.url;

            if (
              typeof targetUrl ===
                "string" &&
              targetUrl.trim()
            ) {
              void openCric4AllLink(
                targetUrl,
                {
                  webTarget:
                    "_self",
                }
              );
            }
          }
        )
      );

      /*
       * IMPORTANT:
       * We DO NOT request notification permission here.
       *
       * If the user has already granted permission on this installation,
       * re-registering is safe and keeps the backend token current.
       *
       * If permission is still "prompt" or denied, nothing happens until the
       * user explicitly chooses Enable App Notifications from the account UI.
       */
      try {
        const permission =
          await PushNotifications
            .checkPermissions();

        emitStatus({
          state:
            permission.receive,
        });

        if (
          permission.receive ===
            "granted"
        ) {
          await PushNotifications
            .register();
        }
      } catch (
        error
      ) {
        console.warn(
          "[NATIVE_PUSH_PERMISSION_CHECK_FAILED]",
          error
        );
      }
    }

    initialize();

    return () => {
      disposed =
        true;

      for (
        const handle
        of handles
      ) {
        try {
          handle
            ?.remove
            ?.();
        } catch {
          // Listener cleanup must never affect Cric4All navigation.
        }
      }
    };
  }, []);

  return null;
}

export {
  PUSH_STATUS_EVENT,
};
