import { NextResponse } from "next/server";
import twilio from "twilio";

import prisma from "@/lib/prisma";

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

export async function POST(request) {
  try {
    const formData = await request.formData();
    const parameters = formDataToObject(formData);
console.log(
  "[BIRTHDAY_WHATSAPP_CALLBACK_PARAMETERS]",
  parameters
);
    const requestUrl = new URL(request.url);
    const birthdayId = parsePositiveInteger(
      requestUrl.searchParams.get("birthdayId")
    );
    const leagueId = parsePositiveInteger(
      requestUrl.searchParams.get("leagueId")
    );

    const messageSid = String(
      parameters.MessageSid || parameters.SmsSid || ""
    ).trim();
console.log(
  "[BIRTHDAY_WHATSAPP_CALLBACK_SID]",
  {
    messageSid,
    smsSid: parameters.SmsSid,
    originalMessageSid: parameters.OriginalMessageSid,
    messageStatus,
  }
);
    const messageStatus = normalizeStatus(
      parameters.MessageStatus || parameters.SmsStatus
    );

    const errorCode = String(parameters.ErrorCode || "").trim();
    const channelStatusMessage = String(
      parameters.ChannelStatusMessage || ""
    ).trim();

    console.log("[BIRTHDAY_WHATSAPP_CALLBACK_RECEIVED]", {
      birthdayId,
      leagueId,
      messageSid,
      messageStatus,
      errorCode,
      channelStatusMessage,
    });

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

    if (["FAILED", "UNDELIVERED"].includes(messageStatus)) {
      const failureMessage = [
        `WhatsApp delivery ${messageStatus.toLowerCase()}.`,
        errorCode ? `Twilio error ${errorCode}.` : "",
        channelStatusMessage,
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 1000);

      await updateReminderLog(reminderLog.id, {
        status: "FAILED",
        providerMessageId: messageSid,
        providerStatus: messageStatus,
        providerResponse,
        lastCallbackAt: now,
        lastErrorCode: errorCode || null,
        errorMessage: failureMessage || "WhatsApp delivery failed.",
      });

      console.error("[BIRTHDAY_WHATSAPP_CALLBACK_DELIVERY_FAILED]", {
        reminderLogId: reminderLog.id,
        birthdayId,
        leagueId,
        messageSid,
        messageStatus,
        errorCode,
        channelStatusMessage,
      });

      return NextResponse.json({
        success: true,
        received: true,
        matched: true,
        failed: true,
        metaBlocked: errorCode === "63049",
        messageSid,
        messageStatus,
        errorCode: errorCode || null,
      });
    }

    await updateReminderLog(reminderLog.id, {
      providerMessageId: messageSid,
      providerStatus: messageStatus || "UNKNOWN",
      providerResponse,
      lastCallbackAt: now,
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

    return NextResponse.json({
      success: true,
      received: true,
      processingError: true,
      details: errorMessage,
    });
  }
}
