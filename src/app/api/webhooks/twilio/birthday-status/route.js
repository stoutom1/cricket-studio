import { NextResponse } from "next/server";
import twilio from "twilio";

import prisma from "@/lib/prisma";
import {
  sendTwilioBirthdaySmsFallback,
} from "@/lib/sendTwilioBirthdaySmsFallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formDataToObject(formData) {
  const values = {};

  for (const [key, value] of formData.entries()) {
    values[key] = String(value);
  }

  return values;
}

function getPublicCallbackUrl(request) {
  const requestUrl = new URL(request.url);

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();

  if (forwardedProto && forwardedHost) {
    return (
      `${forwardedProto}://${forwardedHost}` +
      requestUrl.pathname +
      requestUrl.search
    );
  }

  return request.url;
}

function parsePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function getErrorMessage(error) {
  return String(error instanceof Error ? error.message : error).slice(0, 1000);
}

function buildProviderResponse({
  messageSid,
  messageStatus,
  errorCode,
  channelStatusMessage,
  parameters,
}) {
  return {
    messageSid,
    messageStatus,
    errorCode: errorCode || null,
    channelStatusMessage: channelStatusMessage || null,
    callbackReceivedAt: new Date().toISOString(),
    callbackPayload: parameters,
  };
}

async function findReminderLog({ messageSid, birthdayId, leagueId }) {
  if (messageSid) {
    const bySid = await prisma.birthdayReminderLog.findFirst({
      where: {
        reminderType: "PLAYER_WHATSAPP",
        providerMessageId: messageSid,
      },
      orderBy: { id: "desc" },
    });

    if (bySid) {
      return bySid;
    }
  }

  if (birthdayId && leagueId) {
    return prisma.birthdayReminderLog.findFirst({
      where: {
        birthdayId,
        leagueId,
        reminderType: "PLAYER_WHATSAPP",
      },
      orderBy: { id: "desc" },
    });
  }

  return null;
}

async function updateReminderLog(logId, data) {
  if (!logId) {
    return null;
  }

  return prisma.birthdayReminderLog.update({
    where: { id: logId },
    data,
  });
}

async function attempt63049SmsFallback({
  reminderLog,
  birthdayId,
  leagueId,
}) {
  if (!reminderLog?.id) {
    return {
      attempted: false,
      reason: "MISSING_REMINDER_LOG",
    };
  }

  if (!reminderLog.recipientPhone) {
    console.warn(
      "[BIRTHDAY_SMS_FALLBACK_SKIPPED]",
      {
        reminderLogId: reminderLog.id,
        birthdayId,
        leagueId,
        reason: "MISSING_RECIPIENT_PHONE",
      }
    );

    return {
      attempted: false,
      reason: "MISSING_RECIPIENT_PHONE",
    };
  }

  if (reminderLog.fallbackSmsAllowed !== true) {
    console.log(
      "[BIRTHDAY_SMS_FALLBACK_SKIPPED]",
      {
        reminderLogId: reminderLog.id,
        birthdayId,
        leagueId,
        reason: "COMMUNICATION_CONSENT_NOT_GRANTED",
      }
    );

    return {
      attempted: false,
      reason: "COMMUNICATION_CONSENT_NOT_GRANTED",
    };
  }

  if (!reminderLog.fallbackSmsBody) {
    console.warn(
      "[BIRTHDAY_SMS_FALLBACK_SKIPPED]",
      {
        reminderLogId: reminderLog.id,
        birthdayId,
        leagueId,
        reason: "MISSING_FALLBACK_SMS_BODY",
      }
    );

    return {
      attempted: false,
      reason: "MISSING_FALLBACK_SMS_BODY",
    };
  }

  /*
   * Atomic claim:
   *
   * Only one webhook request can change the fallback
   * status from NULL to PROCESSING.
   *
   * If Twilio sends the same callback multiple times,
   * every later request receives count = 0 and skips.
   */
  const claimedAt = new Date();

  const claimResult =
    await prisma.birthdayReminderLog.updateMany({
      where: {
        id: reminderLog.id,

        reminderType:
          "PLAYER_WHATSAPP",

        lastErrorCode:
          "63049",
        
        fallbackSmsAllowed: true,  

        fallbackSmsStatus:
          null,
      },

      data: {
        fallbackSmsStatus:
          "PROCESSING",

        fallbackSmsAttemptedAt:
          claimedAt,

        fallbackSmsError:
          null,
      },
    });

  if (claimResult.count !== 1) {
    const latestLog =
      await prisma.birthdayReminderLog.findUnique({
        where: {
          id: reminderLog.id,
        },

        select: {
          fallbackSmsStatus:
            true,

          fallbackSmsMessageId:
            true,

          fallbackSmsAttemptedAt: true,
          sentAt: true,
        },
      });

    console.log(
      "[BIRTHDAY_SMS_FALLBACK_DUPLICATE_SKIPPED]",
      {
        reminderLogId:
          reminderLog.id,
        birthdayId,
        leagueId,
        fallbackSmsStatus:
          latestLog?.fallbackSmsStatus ??
          null,
        fallbackSmsMessageId:
          latestLog?.fallbackSmsMessageId ??
          null,
      }
    );

    const existingFallbackStatus = String(
      latestLog?.fallbackSmsStatus || ""
    ).toUpperCase();

    const fallbackWasAccepted = [
      "ACCEPTED",
      "QUEUED",
      "SENDING",
      "SENT",
      "DELIVERED",
    ].includes(existingFallbackStatus);

    if (fallbackWasAccepted) {
      await prisma.birthdayReminderLog.update({
        where: {
          id: reminderLog.id,
        },
        data: {
          status: "SENT",
          sentAt: latestLog?.sentAt || new Date(),
          errorMessage:
            "WhatsApp delivery was blocked with Twilio error 63049. SMS fallback was accepted by Twilio.",
        },
      });
    }

    return {
      attempted: false,
      duplicate: true,
      recovered: fallbackWasAccepted,
      reason: "FALLBACK_ALREADY_CLAIMED",
      status: existingFallbackStatus || null,
      messageSid:
        latestLog?.fallbackSmsMessageId || null,
    };
  }

  try {
    const smsResult =
      await sendTwilioBirthdaySmsFallback({
        recipientPhone:
          reminderLog.recipientPhone,

        messageBody:
          reminderLog.fallbackSmsBody,

        reminderLogId:
          reminderLog.id,

        birthdayId,
        leagueId,
      });

    const queuedAt = new Date();

    await prisma.birthdayReminderLog.update({
      where: {
        id: reminderLog.id,
      },

      data: {
        status: "SENT",
        sentAt: reminderLog.sentAt || queuedAt,

        fallbackSmsStatus: String(
          smsResult.status || "QUEUED"
        ).toUpperCase(),

        fallbackSmsMessageId:
          smsResult.messageSid,

        fallbackSmsQueuedAt:
          queuedAt,

        fallbackSmsError: null,

        errorMessage:
          "WhatsApp delivery was blocked with Twilio error 63049. SMS fallback was accepted by Twilio.",
      },
    });

    console.log(
      "[BIRTHDAY_SMS_FALLBACK_QUEUED]",
      {
        reminderLogId:
          reminderLog.id,
        birthdayId,
        leagueId,
        recipientPhone:
          reminderLog.recipientPhone,
        messageSid:
          smsResult.messageSid,
        providerStatus:
          smsResult.status,
        queuedAt:
          queuedAt.toISOString(),
      }
    );

    return {
      attempted: true,
      queued: true,
      deliveredBy: "SMS_FALLBACK",
      messageSid: smsResult.messageSid,
      status: smsResult.status,
    };
  } catch (error) {
    const fallbackError =
      String(
        error instanceof Error
          ? error.message
          : error
      ).slice(0, 1000);

    await prisma.birthdayReminderLog.update({
      where: {
        id: reminderLog.id,
      },

      data: {
        fallbackSmsStatus:
          "FAILED",

        fallbackSmsError:
          fallbackError,
      },
    });

    console.error(
      "[BIRTHDAY_SMS_FALLBACK_FAILED]",
      {
        reminderLogId:
          reminderLog.id,
        birthdayId,
        leagueId,
        recipientPhone:
          reminderLog.recipientPhone,
        error:
          fallbackError,
      }
    );

    return {
      attempted: true,
      queued: false,
      failed: true,
      error:
        fallbackError,
    };
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const parameters = formDataToObject(formData);
    const requestUrl = new URL(request.url);

const birthdayId = parsePositiveInteger(
  requestUrl.searchParams.get("birthdayId")
);

const leagueId = parsePositiveInteger(
  requestUrl.searchParams.get("leagueId")
);

const messageSid = String(
  parameters.MessageSid ||
  parameters.SmsSid ||
  ""
).trim();

const messageStatus = normalizeStatus(
  parameters.MessageStatus ||
  parameters.SmsStatus
);

const errorCode = String(
  parameters.ErrorCode || ""
).trim();

const channelStatusMessage = String(
  parameters.ChannelStatusMessage || ""
).trim();

// All referenced variables have now been initialized.
console.log(
  "[BIRTHDAY_WHATSAPP_CALLBACK_PARAMETERS]",
  parameters
);

console.log(
  "[BIRTHDAY_WHATSAPP_CALLBACK_SID]",
  {
    messageSid,
    smsSid:
      parameters.SmsSid || null,
    originalMessageSid:
      parameters.OriginalMessageSid || null,
    messageStatus,
  }
);

console.log(
  "[BIRTHDAY_WHATSAPP_CALLBACK_RECEIVED]",
  {
    birthdayId,
    leagueId,
    messageSid,
    messageStatus,
    errorCode,
    channelStatusMessage,
  }
);

    const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();

    if (!authToken) {
      console.error(
        "[BIRTHDAY_WHATSAPP_CALLBACK_CONFIGURATION_ERROR] Missing TWILIO_AUTH_TOKEN"
      );

      return NextResponse.json({
        success: true,
        received: true,
        configurationError: true,
      });
    }

    const twilioSignature =
      request.headers.get("x-twilio-signature") || "";
    const callbackUrl = getPublicCallbackUrl(request);

    const validSignature = twilio.validateRequest(
      authToken,
      twilioSignature,
      callbackUrl,
      parameters
    );

    console.log("[BIRTHDAY_WHATSAPP_CALLBACK_VALIDATION]", {
      validSignature,
      callbackUrl,
      hasTwilioSignature: Boolean(twilioSignature),
      birthdayId,
      leagueId,
      messageSid,
    });

    if (!validSignature) {
      console.error("[BIRTHDAY_WHATSAPP_CALLBACK_INVALID_SIGNATURE]", {
        callbackUrl,
        birthdayId,
        leagueId,
        messageSid,
      });

      return NextResponse.json({
        success: true,
        received: true,
        signatureValid: false,
      });
    }

    if (!messageSid) {
      console.warn("[BIRTHDAY_WHATSAPP_CALLBACK_MISSING_SID]", {
        birthdayId,
        leagueId,
        messageStatus,
      });

      return NextResponse.json({
        success: true,
        received: true,
        matched: false,
      });
    }

    const reminderLog = await findReminderLog({
      messageSid,
      birthdayId,
      leagueId,
    });
console.log(
  "[LOOKUP_RESULT]",
  {
    searchedMessageSid: messageSid,
    reminderLogId: reminderLog?.id,
    storedProviderMessageId:
      reminderLog?.providerMessageId,
  }
);
    console.log("[BIRTHDAY_WHATSAPP_CALLBACK_MATCH]", {
      reminderLogId: reminderLog?.id ?? null,
      providerMessageId: reminderLog?.providerMessageId ?? null,
      birthdayId,
      leagueId,
      messageSid,
    });

    if (!reminderLog) {
      console.warn("[BIRTHDAY_WHATSAPP_CALLBACK_NO_MATCH]", {
        birthdayId,
        leagueId,
        messageSid,
        messageStatus,
      });

      return NextResponse.json({
        success: true,
        received: true,
        matched: false,
        messageSid,
        messageStatus,
      });
    }

    const now = new Date();
    const providerResponse = buildProviderResponse({
      messageSid,
      messageStatus,
      errorCode,
      channelStatusMessage,
      parameters,
    });

    if (["ACCEPTED", "SCHEDULED", "QUEUED", "SENDING"].includes(messageStatus)) {
      await updateReminderLog(reminderLog.id, {
        providerMessageId: messageSid,
        providerStatus: messageStatus,
        providerResponse,
        lastCallbackAt: now,
        callbackReceivedAt:
  reminderLog.callbackReceivedAt || now,
        lastErrorCode: null,
        errorMessage: null,
      });

      return NextResponse.json({
        success: true,
        received: true,
        matched: true,
        messageSid,
        messageStatus,
      });
    }

    if (["SENT", "DELIVERED", "READ"].includes(messageStatus)) {
      await updateReminderLog(reminderLog.id, {
        status: "SENT",
        providerMessageId: messageSid,
        providerStatus: messageStatus,
        providerResponse,
        lastCallbackAt: now,
        callbackReceivedAt:
  reminderLog.callbackReceivedAt || now,
        lastErrorCode: null,
        errorMessage: null,
        sentAt: reminderLog.sentAt || now,
      });

      return NextResponse.json({
        success: true,
        received: true,
        matched: true,
        delivered: messageStatus === "DELIVERED" || messageStatus === "READ",
        messageSid,
        messageStatus,
      });
    }

if (
  ["FAILED", "UNDELIVERED"].includes(
    messageStatus
  )
) {
  const failureMessage = [
    `WhatsApp delivery ${messageStatus.toLowerCase()}.`,

    errorCode
      ? `Twilio error ${errorCode}.`
      : "",

    channelStatusMessage,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1000);

  await updateReminderLog(
    reminderLog.id,
    {
      status:
        "FAILED",

      providerMessageId:
        messageSid,

      providerStatus:
        messageStatus,

      providerResponse,

      callbackReceivedAt:
        reminderLog.callbackReceivedAt ||
        now,

      lastCallbackAt:
        now,

      lastErrorCode:
        errorCode || null,

      errorMessage:
        failureMessage ||
        "WhatsApp delivery failed.",
    }
  );

  console.error(
    "[BIRTHDAY_WHATSAPP_CALLBACK_DELIVERY_FAILED]",
    {
      reminderLogId:
        reminderLog.id,
      birthdayId,
      leagueId,
      messageSid,
      messageStatus,
      errorCode,
      channelStatusMessage,
    }
  );

  let smsFallback = {
    attempted: false,
    reason:
      "ERROR_NOT_ELIGIBLE",
  };

  /*
   * 63049:
   * Meta rejected the WhatsApp Marketing template.
   *
   * Do not retry the same WhatsApp template.
   * Attempt the duplicate-protected SMS fallback.
   */
  if (
    errorCode === "63049" &&
    reminderLog.reminderType ===
      "PLAYER_WHATSAPP"
  ) {
    smsFallback =
      await attempt63049SmsFallback({
        reminderLog: {
          ...reminderLog,

          /*
           * The database row has just been updated above.
           * Pass the confirmed error code into the
           * atomic claim condition.
           */
          lastErrorCode:
            "63049",
        },

        birthdayId,
        leagueId,
      });
  }

  return NextResponse.json({
    success: true,
    received: true,
    matched: true,
    failed: smsFallback.queued !== true &&
      smsFallback.recovered !== true,

    deliveredBy:
      smsFallback.queued === true ||
      smsFallback.recovered === true
        ? "SMS_FALLBACK"
        : null,

    metaBlocked:
      errorCode === "63049",

    smsFallback,

    messageSid,
    messageStatus,

    errorCode:
      errorCode || null,
  });
}

    await updateReminderLog(reminderLog.id, {
      providerMessageId: messageSid,
      providerStatus: messageStatus || "UNKNOWN",
      providerResponse,
      lastCallbackAt: now,
      callbackReceivedAt:
  reminderLog.callbackReceivedAt || now,
      lastErrorCode: errorCode || null,
      errorMessage:
        errorCode || channelStatusMessage
          ? [
              errorCode ? `Twilio error ${errorCode}.` : "",
              channelStatusMessage,
            ]
              .filter(Boolean)
              .join(" ")
              .slice(0, 1000)
          : reminderLog.errorMessage,
    });

    return NextResponse.json({
      success: true,
      received: true,
      matched: true,
      ignored: true,
      messageSid,
      messageStatus: messageStatus || "UNKNOWN",
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    console.error("[BIRTHDAY_WHATSAPP_CALLBACK_FAILED]", {
      error: errorMessage,
    });

    return NextResponse.json(
      {
        success: false,
        received: true,
        processingError: true,
        details: errorMessage,
      },
      {
        status: 500,
      }
    );
  }
}
