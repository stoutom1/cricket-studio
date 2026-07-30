import { NextResponse } from "next/server";
import twilio from "twilio";

import prisma from "@/lib/prisma";
import { sendBirthdayOwnerSms } from "@/lib/sendBirthdayOwnerSms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getErrorMessage(error) {
  return String(error instanceof Error ? error.message : error).slice(0, 1000);
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
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

    if (bySid) return bySid;
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

async function updateReminderLog(
  logId,
  data
) {
  if (!logId) {
    return null;
  }

  return prisma.birthdayReminderLog.update({
    where: {
      id: logId,
    },
    data,
  });
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const callbackValues = Object.fromEntries(formData.entries());

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      return NextResponse.json(
        { error: "Twilio configuration is incomplete." },
        { status: 500 }
      );
    }

    const signature = request.headers.get("x-twilio-signature") || "";
    const isValidSignature = twilio.validateRequest(
      authToken,
      signature,
      request.url,
      callbackValues
    );

    if (!isValidSignature) {
      return NextResponse.json(
        { error: "Invalid Twilio signature." },
        { status: 403 }
      );
    }

    const requestUrl = new URL(request.url);
    const birthdayId = parsePositiveInteger(
      requestUrl.searchParams.get("birthdayId")
    );
    const leagueId = parsePositiveInteger(
      requestUrl.searchParams.get("leagueId")
    );

    const messageSid = String(
      callbackValues.MessageSid || callbackValues.SmsSid || ""
    ).trim();
    const messageStatus = normalize(
      callbackValues.MessageStatus || callbackValues.SmsStatus
    );
    const errorCode = String(callbackValues.ErrorCode || "").trim();
    const channelStatusMessage = String(
      callbackValues.ChannelStatusMessage || ""
    ).trim();

    const reminderLog = await findReminderLog({
      messageSid,
      birthdayId,
      leagueId,
    });

    if (["accepted", "scheduled", "queued", "sending"].includes(messageStatus)) {
      await updateReminderLog(reminderLog?.id, {
  providerStatus: messageStatus,
  providerMessageId: messageSid,
  providerResponse: {
    messageSid,
    messageStatus,
    errorCode,
    channelStatusMessage,
    callbackReceivedAt: new Date().toISOString(),
    callbackPayload: parameters,
  },
});

      return NextResponse.json({ received: true, messageStatus });
    }

    if (["sent", "delivered", "read"].includes(messageStatus)) {
      await updateReminderLog(reminderLog?.id, {
  providerStatus: messageStatus,
  providerMessageId: messageSid,
  providerResponse: {
    messageSid,
    messageStatus,
    errorCode,
    channelStatusMessage,
    callbackReceivedAt: new Date().toISOString(),
    callbackPayload: parameters,
  },
});

      return NextResponse.json({
        received: true,
        delivered: messageStatus === "delivered" || messageStatus === "read",
        messageStatus,
      });
    }

    if (!["failed", "undelivered"].includes(messageStatus)) {
      await updateReminderLog(reminderLog?.id, {
  providerStatus: messageStatus,
  providerMessageId: messageSid,
  providerResponse: {
    messageSid,
    messageStatus,
    errorCode,
    channelStatusMessage,
    callbackReceivedAt: new Date().toISOString(),
    callbackPayload: parameters,
  },
});

      return NextResponse.json({
        received: true,
        ignored: true,
        messageStatus: messageStatus || "unknown",
      });
    }

    if (errorCode !== "63049") {
      const failureMessage = [
        `WhatsApp delivery ${messageStatus}.`,
        errorCode ? `Twilio error ${errorCode}.` : "",
        channelStatusMessage,
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 1000);

      await updateReminderLog(reminderLog?.id, {
  providerStatus: messageStatus,
  providerMessageId: messageSid,
  providerResponse: {
    messageSid,
    messageStatus,
    errorCode,
    channelStatusMessage,
    callbackReceivedAt: new Date().toISOString(),
    callbackPayload: parameters,
  },
});

      return NextResponse.json({
        received: true,
        fallbackSent: false,
        errorCode: errorCode || null,
      });
    }

    if (!birthdayId || !leagueId) {
      await updateReminderLog(reminderLog?.id, {
  providerStatus: messageStatus,
  providerMessageId: messageSid,
  providerResponse: {
    messageSid,
    messageStatus,
    errorCode,
    channelStatusMessage,
    callbackReceivedAt: new Date().toISOString(),
    callbackPayload: parameters,
  },
});

      return NextResponse.json({
        received: true,
        fallbackSent: false,
      });
    }

    if (
      reminderLog?.providerStatus === "sms-fallback-pending" ||
      reminderLog?.providerStatus === "sms-fallback-sent"
    ) {
      return NextResponse.json({
        received: true,
        duplicate: true,
        fallbackSent: reminderLog.providerStatus === "sms-fallback-sent",
      });
    }

    if (reminderLog?.id) {
      const reservation = await prisma.birthdayReminderLog.updateMany({
        where: {
          id: reminderLog.id,
          NOT: {
            providerStatus: {
              in: ["sms-fallback-pending", "sms-fallback-sent"],
            },
          },
        },
        data: {
          status: "PENDING",
          providerStatus: "sms-fallback-pending",
          errorMessage:
            "WhatsApp delivery was blocked by Meta with error 63049. Preparing SMS fallback.",
        },
      });

      if (reservation.count === 0) {
        return NextResponse.json({
          received: true,
          duplicate: true,
          fallbackSent: false,
        });
      }
    }

    const birthday = await prisma.leagueBirthday.findFirst({
      where: {
        id: birthdayId,
        leagueId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        whatsappNumber: true,
        whatsappOptIn: true,
        player: {
          select: {
            id: true,
            name: true,
            whatsappNumber: true,
            whatsappOptIn: true,
          },
        },
        league: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!birthday) {
      await updateReminderLog(reminderLog?.id, {
  providerStatus: messageStatus,
  providerMessageId: messageSid,
  providerResponse: {
    messageSid,
    messageStatus,
    errorCode,
    channelStatusMessage,
    callbackReceivedAt: new Date().toISOString(),
    callbackPayload: parameters,
  },
});

      return NextResponse.json({
        received: true,
        fallbackSent: false,
      });
    }

    const playerPhone = String(
      birthday.whatsappNumber || birthday.player?.whatsappNumber || ""
    ).trim();
    const playerOptIn =
      birthday.whatsappOptIn === true || birthday.player?.whatsappOptIn === true;
    const playerName =
      birthday.player?.name?.trim() || birthday.name?.trim() || "Player";

    if (!playerPhone || !playerOptIn) {
      const reason = !playerPhone
        ? "SMS fallback skipped because the player phone number is missing."
        : "SMS fallback skipped because the player has not opted in.";

      await updateReminderLog(reminderLog?.id, {
  providerStatus: messageStatus,
  providerMessageId: messageSid,
  providerResponse: {
    messageSid,
    messageStatus,
    errorCode,
    channelStatusMessage,
    callbackReceivedAt: new Date().toISOString(),
    callbackPayload: parameters,
  },
});

      return NextResponse.json({
        received: true,
        fallbackSent: false,
        skipped: true,
        reason,
      });
    }

    try {
      const smsResult = await sendBirthdayOwnerSms({
        playerPhone,
        playerName,
        leagueName: birthday.league?.name || "Cric4All League",
      });

      await updateReminderLog(reminderLog?.id, {
  providerStatus: messageStatus,
  providerMessageId: messageSid,
  providerResponse: {
    messageSid,
    messageStatus,
    errorCode,
    channelStatusMessage,
    callbackReceivedAt: new Date().toISOString(),
    callbackPayload: parameters,
  },
});

      return NextResponse.json({
        received: true,
        fallbackSent: true,
        smsMessageId: smsResult.messageId,
        smsStatus: smsResult.status,
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      await updateReminderLog(reminderLog?.id, {
  providerStatus: messageStatus,
  providerMessageId: messageSid,
  providerResponse: {
    messageSid,
    messageStatus,
    errorCode,
    channelStatusMessage,
    callbackReceivedAt: new Date().toISOString(),
    callbackPayload: parameters,
  },
});

      return NextResponse.json(
        {
          received: true,
          fallbackSent: false,
          error: errorMessage,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    console.error("[BIRTHDAY_TWILIO_WEBHOOK_FAILED]", {
      error: errorMessage,
    });

    return NextResponse.json(
      {
        received: false,
        error: "Unable to process the Twilio birthday status callback.",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
