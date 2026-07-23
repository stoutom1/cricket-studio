import webpush from "web-push";

let isConfigured = false;

function configureWebPush() {
  if (isConfigured) {
    return;
  }

  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const privateKey =
    process.env.VAPID_PRIVATE_KEY;

  const subject =
    process.env.VAPID_SUBJECT ||
    "mailto:support@cric4all.app";

  if (!publicKey) {
    throw new Error(
      "NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing."
    );
  }

  if (!privateKey) {
    throw new Error(
      "VAPID_PRIVATE_KEY is missing."
    );
  }

  webpush.setVapidDetails(
    subject,
    publicKey,
    privateKey
  );

  isConfigured = true;
}

function getWebPushErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown web push error.";
}

export async function sendWebPushNotification({
  subscription,
  payload,
}) {
  configureWebPush();

  if (!subscription?.endpoint) {
    throw new Error(
      "Push subscription endpoint is missing."
    );
  }

  if (
    !subscription?.p256dh ||
    !subscription?.auth
  ) {
    throw new Error(
      "Push subscription encryption keys are missing."
    );
  }

  const webPushSubscription = {
    endpoint: subscription.endpoint,

    expirationTime:
      subscription.expirationTime
        ? Number(subscription.expirationTime)
        : null,

    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  try {
    const response =
      await webpush.sendNotification(
        webPushSubscription,
        JSON.stringify(payload),
        {
          TTL: 60 * 60 * 12,
          urgency: "high",
        }
      );

    return {
      success: true,
      statusCode:
        response.statusCode || null,
    };
  } catch (error) {
    return {
      success: false,

      statusCode:
        typeof error?.statusCode === "number"
          ? error.statusCode
          : null,

      error:
        getWebPushErrorMessage(error),

      body:
        typeof error?.body === "string"
          ? error.body
          : null,
    };
  }
}