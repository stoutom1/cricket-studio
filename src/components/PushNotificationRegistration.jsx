"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export default function PushNotificationRegistration() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let removeRegistrationListener;
    let removeRegistrationErrorListener;
    let removeActionListener;

    async function initializePushNotifications() {
      try {
        let permission =
          await PushNotifications.checkPermissions();

        if (permission.receive === "prompt") {
          permission =
            await PushNotifications.requestPermissions();
        }

        if (permission.receive !== "granted") {
          console.info("Push notification permission not granted.");
          return;
        }

        removeRegistrationListener =
          await PushNotifications.addListener(
            "registration",
            async (token) => {
              const response = await fetch("/api/push-devices", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  token: token.value,
                  platform: Capacitor.getPlatform(),
                }),
              });

              if (!response.ok) {
                const data = await response.json();
                console.error(
                  "Push device registration failed:",
                  data.error
                );
              }
            }
          );

        removeRegistrationErrorListener =
          await PushNotifications.addListener(
            "registrationError",
            (error) => {
              console.error(
                "Native push registration error:",
                error
              );
            }
          );

        removeActionListener =
          await PushNotifications.addListener(
            "pushNotificationActionPerformed",
            (action) => {
              const targetUrl =
                action.notification?.data?.url;

              if (typeof targetUrl === "string") {
                window.location.href = targetUrl;
              }
            }
          );
await PushNotifications.createChannel({
  id: "birthday-reminders",
  name: "Birthday Reminders",
  description: "League birthday reminders for owners and administrators",
  importance: 5,
  visibility: 1,
  sound: "default",
});
        await PushNotifications.register();
      } catch (error) {
        console.error(
          "Push notification initialization failed:",
          error
        );
      }
    }

    initializePushNotifications();

    return () => {
      removeRegistrationListener?.remove();
      removeRegistrationErrorListener?.remove();
      removeActionListener?.remove();
    };
  }, []);

  return null;
}