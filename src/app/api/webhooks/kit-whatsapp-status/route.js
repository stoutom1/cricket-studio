import { NextResponse } from "next/server";
import twilio from "twilio";

import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getPublicCallbackUrl(request) {
  const appUrl = String(
    process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      ""
  )
    .trim()
    .replace(/\/+$/, "");

  if (appUrl) {
    return `${appUrl}/api/webhooks/kit-whatsapp-status`;
  }

  return request.url;
}

function formDataToObject(formData) {
  const values = {};

  for (const [key, value] of formData.entries()) {
    values[key] = String(value);
  }

  return values;
}

function normalizeProviderStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export async function POST(request) {
  try {
    const authToken = String(
      process.env.TWILIO_AUTH_TOKEN || ""
    ).trim();

    if (!authToken) {
      console.error(
        "[KIT_WHATSAPP_CALLBACK] Missing TWILIO_AUTH_TOKEN"
      );

      return NextResponse.json(
        {
          success: false,
          error: "Webhook configuration is incomplete.",
        },
        {
          status: 500,
        }
      );
    }

    const formData = await request.formData();
    const parameters =
      formDataToObject(formData);

    const twilioSignature =
      request.headers.get(
        "x-twilio-signature"
      ) || "";

    const callbackUrl =
      getPublicCallbackUrl(request);

console.log(
  "[KIT_WHATSAPP_CALLBACK_VALIDATION]",
  {
    requestUrl: request.url,
    callbackUrl,
    forwardedHost:
      request.headers.get("x-forwarded-host"),
    forwardedProto:
      request.headers.get("x-forwarded-proto"),
    hasSignature:
      Boolean(twilioSignature),
    messageSid:
      parameters.MessageSid ||
      parameters.SmsSid ||
      null,
    messageStatus:
      parameters.MessageStatus ||
      parameters.SmsStatus ||
      null,
    errorCode:
      parameters.ErrorCode ||
      null,
  }
);
      
    const validSignature =
      twilio.validateRequest(
        authToken,
        twilioSignature,
        callbackUrl,
        parameters
      );

    if (!validSignature) {
      console.error(
        "[KIT_WHATSAPP_CALLBACK_INVALID_SIGNATURE]",
        {
          callbackUrl,
          messageSid:
            parameters.MessageSid ||
            parameters.SmsSid ||
            null,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error: "Invalid Twilio signature.",
        },
        {
          status: 403,
        }
      );
    }

    const messageSid =
      parameters.MessageSid ||
      parameters.SmsSid ||
      null;

    const messageStatus =
      normalizeProviderStatus(
        parameters.MessageStatus ||
          parameters.SmsStatus
      );

    const errorCode =
      parameters.ErrorCode || null;

    const channelStatusMessage =
      parameters.ChannelStatusMessage ||
      null;

    console.log(
      "[KIT_WHATSAPP_STATUS_CALLBACK]",
      {
        messageSid,
        messageStatus,
        errorCode,
        channelStatusMessage,
      }
    );

    if (!messageSid) {
      return NextResponse.json(
        {
          success: false,
          error: "MessageSid is missing.",
        },
        {
          status: 400,
        }
      );
    }

async function findReminderWithRetry(messageSid) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const reminder =
      await prisma.kitReminderLog.findFirst({
        where: {
          providerMessageId: messageSid,
        },
      });

    if (reminder) {
      return reminder;
    }

    if (attempt < 4) {
      await new Promise((resolve) =>
        setTimeout(resolve, 500)
      );
    }
  }

  return null;
}

const reminder =
  await findReminderWithRetry(
    messageSid
  );

    /*
     * A callback can arrive before the providerMessageId
     * transaction has completed. Return 200 so Twilio does
     * not treat that as a webhook retrieval failure.
     */
    if (!reminder) {
      console.warn(
        "[KIT_WHATSAPP_CALLBACK_REMINDER_NOT_FOUND]",
        {
          messageSid,
          messageStatus,
        }
      );

      return NextResponse.json({
        success: true,
        matched: false,
      });
    }

    const providerResponse = {
      messageSid,
      messageStatus,
      errorCode,
      channelStatusMessage,
      messagingServiceSid:
        parameters.MessagingServiceSid ||
        null,
      channelPrefix:
        parameters.ChannelPrefix ||
        null,
      eventType:
        parameters.EventType ||
        null,
      callbackReceivedAt:
        new Date().toISOString(),
    };

    if (
      messageStatus === "DELIVERED" ||
      messageStatus === "READ"
    ) {
      await prisma.kitReminderLog.update({
        where: {
          id: reminder.id,
        },
        data: {
          status: "SENT",
          providerStatus:
            messageStatus,
          sentAt:
            new Date(),
          failedAt:
            null,
          errorMessage:
            null,
          providerResponse,
        },
      });
    } else if (
      messageStatus === "FAILED" ||
      messageStatus === "UNDELIVERED"
    ) {
      const errorMessage = [
        errorCode
          ? `Twilio error ${errorCode}`
          : null,

        channelStatusMessage ||
          "WhatsApp delivery failed.",
      ]
        .filter(Boolean)
        .join(": ");

      await prisma.kitReminderLog.update({
        where: {
          id: reminder.id,
        },
        data: {
          status: "FAILED",
          providerStatus:
            messageStatus,
          failedAt:
            new Date(),
          sentAt:
            null,
          errorMessage,
          providerResponse,
        },
      });
    } else {
      /*
       * ACCEPTED, QUEUED, SENDING and SENT are
       * intermediate provider states.
       */
      await prisma.kitReminderLog.update({
        where: {
          id: reminder.id,
        },
        data: {
          status: "PROCESSING",
          providerStatus:
            messageStatus ||
            "PROCESSING",
          processingStartedAt:
            new Date(),
          failedAt:
            null,
          errorMessage:
            null,
          providerResponse,
        },
      });
    }

    return NextResponse.json({
      success: true,
      matched: true,
      messageSid,
      messageStatus,
    });
  } catch (error) {
    console.error(
      "[KIT_WHATSAPP_STATUS_CALLBACK_FAILED]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to process Twilio status callback.",
      },
      {
        status: 500,
      }
    );
  }
}