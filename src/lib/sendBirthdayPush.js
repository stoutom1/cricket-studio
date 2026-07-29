import prisma from "@/lib/prisma";
import { getFirebaseMessaging } from "@/lib/firebaseAdmin";
import { sendWebPushNotification } from "@/lib/web-push";

function isInvalidTokenError(error) {
  const code = String(error?.code ?? "");

  return (
    code.includes(
      "registration-token-not-registered"
    ) ||
    code.includes(
      "invalid-registration-token"
    )
  );
}

export async function sendBirthdayPush({
  recipientUserId,
  title,
  body,
  url,
}) {
  const devices =
    await prisma.pushDevice.findMany({
      where: {
        userId: recipientUserId,
        enabled: true,
      },

      select: {
        id: true,
        token: true,
      },
    });

  const webSubscriptions =
    await prisma.webPushSubscription.findMany({
      where: {
        userId: recipientUserId,
        isActive: true,
      },

      select: {
        id: true,
        endpoint: true,
        expirationTime: true,
        p256dh: true,
        auth: true,
      },
    });

  const totalDevices =
    devices.length +
    webSubscriptions.length;

  if (totalDevices === 0) {
    return {
      sentCount: 0,
      failedCount: 0,
      noDevices: true,
    };
  }

  let sentCount = 0;
  let failedCount = 0;
  let messaging = null;

  /*
   * Send Firebase Cloud Messaging notifications
   * to native/mobile push devices.
   */
if (devices.length > 0) {
  try {
    messaging = getFirebaseMessaging();
  } catch (error) {
    console.error(
      "[BIRTHDAY_FIREBASE_INIT_FAILED]",
      error instanceof Error ? error.message : String(error)
    );

    // Treat all FCM devices as failed, but continue with Web Push.
    failedCount += devices.length;
  }
}

if (messaging) {

    for (const device of devices) {
      try {
        await messaging.send({
          token: device.token,

          notification: {
            title,
            body,
          },

          data: {
            type:
              "LEAGUE_BIRTHDAY",

            url:
              String(url || ""),
          },

          android: {
            priority: "high",

            notification: {
              channelId:
                "birthday-reminders",

              sound:
                "default",
            },
          },
        });

        sentCount += 1;
      } catch (error) {
        failedCount += 1;

        console.error(
          "[BIRTHDAY_FCM_PUSH_FAILED]",
          {
            deviceId:
              device.id,

            recipientUserId,

            error:
              error instanceof Error
                ? error.message
                : String(error),
          }
        );

        if (
          isInvalidTokenError(error)
        ) {
          try {
            await prisma.pushDevice.update({
              where: {
                id: device.id,
              },

              data: {
                enabled: false,
              },
            });
          } catch (
            disableError
          ) {
            console.error(
              "[BIRTHDAY_FCM_DEVICE_DISABLE_FAILED]",
              {
                deviceId:
                  device.id,

                error:
                  disableError instanceof Error
                    ? disableError.message
                    : String(
                        disableError
                      ),
              }
            );
          }
        }
      }
    }
  }

  /*
   * Send VAPID Web Push notifications
   * to browser subscriptions.
   */
  for (
    const subscription
    of webSubscriptions
  ) {
    try {
      const result =
        await sendWebPushNotification({
          subscription,

          payload: {
            title,
            body,

            type:
              "LEAGUE_BIRTHDAY",

            url:
              String(url || ""),
          },
        });

      if (result.success) {
        sentCount += 1;

        console.log(
          "[BIRTHDAY_WEB_PUSH_SENT]",
          {
            subscriptionId:
              subscription.id,

            recipientUserId,

            statusCode:
              result.statusCode,
          }
        );

        continue;
      }

      failedCount += 1;

      console.error(
        "[BIRTHDAY_WEB_PUSH_FAILED]",
        {
          subscriptionId:
            subscription.id,

          recipientUserId,

          statusCode:
            result.statusCode,

          error:
            result.error,

          body:
            result.body,
        }
      );

      /*
       * HTTP 404 and 410 indicate that the browser
       * subscription no longer exists.
       */
      if (
        result.statusCode === 404 ||
        result.statusCode === 410
      ) {
        try {
          await prisma
            .webPushSubscription
            .update({
              where: {
                id:
                  subscription.id,
              },

              data: {
                isActive:
                  false,
              },
            });
        } catch (
          disableError
        ) {
          console.error(
            "[BIRTHDAY_WEB_PUSH_DISABLE_FAILED]",
            {
              subscriptionId:
                subscription.id,

              error:
                disableError instanceof Error
                  ? disableError.message
                  : String(
                      disableError
                    ),
            }
          );
        }
      }
    } catch (error) {
      failedCount += 1;

      console.error(
        "[BIRTHDAY_WEB_PUSH_UNEXPECTED_FAILURE]",
        {
          subscriptionId:
            subscription.id,

          recipientUserId,

          error:
            error instanceof Error
              ? error.message
              : String(error),
        }
      );
    }
  }

  return {
    sentCount,
    failedCount,
    noDevices: false,
  };
}