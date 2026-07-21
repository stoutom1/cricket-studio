import prisma from "@/lib/prisma";
import { getFirebaseMessaging } from "@/lib/firebaseAdmin";

function isInvalidTokenError(error) {
  const code = String(error?.code ?? "");

  return (
    code.includes("registration-token-not-registered") ||
    code.includes("invalid-registration-token")
  );
}

export async function sendBirthdayPush({
  recipientUserId,
  title,
  body,
  url,
}) {
  const devices = await prisma.pushDevice.findMany({
    where: {
      userId: recipientUserId,
      enabled: true,
    },
    select: {
      id: true,
      token: true,
    },
  });

  if (devices.length === 0) {
    return {
      sentCount: 0,
      failedCount: 0,
      noDevices: true,
    };
  }

  const messaging = getFirebaseMessaging();

  let sentCount = 0;
  let failedCount = 0;

  for (const device of devices) {
    try {
      await messaging.send({
        token: device.token,

        notification: {
          title,
          body,
        },

        data: {
          type: "LEAGUE_BIRTHDAY",
          url,
        },

        android: {
          priority: "high",
          notification: {
            channelId: "birthday-reminders",
            sound: "default",
          },
        },
      });

      sentCount += 1;
    } catch (error) {
      failedCount += 1;

      console.error(
        `Birthday push failed for device ${device.id}:`,
        error
      );

      if (isInvalidTokenError(error)) {
        await prisma.pushDevice.update({
          where: {
            id: device.id,
          },
          data: {
            enabled: false,
          },
        });
      }
    }
  }

  return {
    sentCount,
    failedCount,
    noDevices: false,
  };
}