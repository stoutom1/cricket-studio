import twilio from "twilio";

import {
  maskPhoneNumber,
  normalizeInternationalPhone,
} from "@/lib/notifications/phone";

function requiredEnvironmentValue(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value;
}

function normalizeWhatsAppAddress(phoneNumber) {
  const normalizedPhone =
    normalizeInternationalPhone(phoneNumber);

  if (!normalizedPhone) {
    return null;
  }

  return normalizedPhone.startsWith("whatsapp:")
    ? normalizedPhone
    : `whatsapp:${normalizedPhone}`;
}

function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : String(error);
}

/**
 * Sends a pre-approved WhatsApp Content Template
 * through Twilio Programmable Messaging.
 *
 * Twilio accepts the request immediately and initially
 * returns a status such as "queued". Final delivery status
 * must be obtained through the Twilio status callback.
 */
export async function sendKitReminderWhatsApp({
  phoneNumber,
  playerName,
  teamName,
  opponentName,
  leagueName,
  matchDateText,
  matchTimeText,
}) {
  const normalizedPhone =
    normalizeInternationalPhone(phoneNumber);

  if (!normalizedPhone) {
    throw new Error(
      "The assigned player does not have a valid international WhatsApp number."
    );
  }

  const to =
    normalizeWhatsAppAddress(normalizedPhone);

  if (!to) {
    throw new Error(
      "Unable to build the WhatsApp recipient address."
    );
  }

  const accountSid =
    requiredEnvironmentValue(
      "TWILIO_ACCOUNT_SID"
    );

  const authToken =
    requiredEnvironmentValue(
      "TWILIO_AUTH_TOKEN"
    );

  const messagingServiceSid =
    requiredEnvironmentValue(
      "TWILIO_WHATSAPP_MESSAGING_SERVICE_SID"
    );

  const whatsappFrom =
    requiredEnvironmentValue(
      "TWILIO_WHATSAPP_FROM"
    );

  const contentSid =
    requiredEnvironmentValue(
      "TWILIO_KIT_REMINDER_CONTENT_SID"
    );

  const from =
    whatsappFrom.startsWith("whatsapp:")
      ? whatsappFrom
      : `whatsapp:${whatsappFrom}`;

  const contentVariables = {
    "1": String(
      playerName || "Player"
    ),

    "2": String(
      teamName || "Your team"
    ),

    "3": String(
      opponentName || "the opponent"
    ),

    "4": String(
      matchDateText ||
        "the scheduled date"
    ),

    "5": String(
      matchTimeText ||
        "the scheduled time"
    ),

    "6": String(
      leagueName || "your league"
    ),
  };

  const appUrl =
    String(
      process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_URL ||
        ""
    )
      .trim()
      .replace(/\/+$/, "");

  /*
   * Add your real deployed callback endpoint here.
   * It is omitted during localhost testing because Twilio
   * cannot reach localhost directly.
   */
  const statusCallback = appUrl
    ? `${appUrl}/api/webhooks/kit-whatsapp-status`
    : undefined;

  console.log(
    "[KIT_WHATSAPP_TWILIO_REQUEST]",
    {
      from,

      maskedPhone:
        maskPhoneNumber(
          normalizedPhone
        ),

      messagingServiceSid,
      contentSid,

      parameterCount:
        Object.keys(
          contentVariables
        ).length,

      hasStatusCallback:
        Boolean(statusCallback),
    }
  );

  const client =
    twilio(
      accountSid,
      authToken
    );

  try {
    const message =
      await client.messages.create({
        from,
        to,

        /*
         * Explicitly route this template through the
         * Cric4AllWhatsApp Messaging Service.
         */
        messagingServiceSid,

        contentSid,

        contentVariables:
          JSON.stringify(
            contentVariables
          ),

        ...(statusCallback
          ? {
              statusCallback,
            }
          : {}),
      });

    console.log(
      "[KIT_WHATSAPP_TWILIO_QUEUED]",
      {
        messageSid:
          message.sid,

        status:
          message.status,

        errorCode:
          message.errorCode ||
          null,

        errorMessage:
          message.errorMessage ||
          null,

        maskedPhone:
          maskPhoneNumber(
            normalizedPhone
          ),

        messagingServiceSid,
        contentSid,
      }
    );

    return {
      success: true,

      /*
       * This means Twilio accepted/queued the request.
       * It does not prove final WhatsApp delivery.
       */
      queued: true,
      delivered: false,

      providerMessageId:
        message.sid,

      providerStatus:
        message.status,

      providerErrorCode:
        message.errorCode ||
        null,

      providerErrorMessage:
        message.errorMessage ||
        null,

      maskedPhone:
        maskPhoneNumber(
          normalizedPhone
        ),
    };
  } catch (error) {
    console.error(
      "[KIT_WHATSAPP_TWILIO_FAILED]",
      {
        code:
          error?.code ||
          null,

        status:
          error?.status ||
          null,

        message:
          getErrorMessage(error),

        moreInfo:
          error?.moreInfo ||
          null,

        details:
          error?.details ||
          null,

        maskedPhone:
          maskPhoneNumber(
            normalizedPhone
          ),

        messagingServiceSid,
        contentSid,
      }
    );

    const wrappedError =
      new Error(
        getErrorMessage(error) ||
          "Twilio rejected the WhatsApp kit reminder."
      );

    wrappedError.providerCode =
      error?.code ||
      null;

    wrappedError.httpStatus =
      error?.status ||
      null;

    wrappedError.moreInfo =
      error?.moreInfo ||
      null;

    wrappedError.maskedPhone =
      maskPhoneNumber(
        normalizedPhone
      );

    throw wrappedError;
  }
}