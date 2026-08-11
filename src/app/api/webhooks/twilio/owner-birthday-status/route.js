import { NextResponse } from "next/server";
import twilio from "twilio";

import prisma from "@/lib/prisma";

import {
  sendTwilioBirthdayTemplateSms,
} from "@/lib/sendTwilioWhatsAppBirthdayMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getPublicCallbackUrl(
  request
) {
  const baseUrl =
    String(
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://cric4all.app"
    ).replace(/\/+$/, "");

  const requestUrl =
    new URL(
      request.url
    );

  return (
    baseUrl +
    requestUrl.pathname +
    requestUrl.search
  );
}

async function readTwilioForm(
  request
) {
  const formData =
    await request.formData();

  const params = {};

  for (
    const [key, value]
    of formData.entries()
  ) {
    params[key] =
      String(value);
  }

  return params;
}

function isValidTwilioSignature({
  request,
  params,
}) {
  const authToken =
    String(
      process.env
        .TWILIO_AUTH_TOKEN ||
      ""
    ).trim();

  const signature =
    String(
      request.headers.get(
        "x-twilio-signature"
      ) ||
      ""
    ).trim();

  if (
    !authToken ||
    !signature
  ) {
    return false;
  }

  return twilio.validateRequest(
    authToken,
    signature,
    getPublicCallbackUrl(
      request
    ),
    params
  );
}

function getBirthdayName(
  reminderLog
) {
  return (
    reminderLog
      ?.birthday
      ?.player
      ?.name
      ?.trim() ||
    reminderLog
      ?.birthday
      ?.name
      ?.trim() ||
    "Player"
  );
}

export async function POST(
  request
) {
  const requestUrl =
    new URL(
      request.url
    );

  const reminderLogId =
    Number(
      requestUrl.searchParams.get(
        "reminderLogId"
      )
    );

  if (
    !Number.isInteger(
      reminderLogId
    ) ||
    reminderLogId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid reminderLogId",
      },
      {
        status: 400,
      }
    );
  }

  const params =
    await readTwilioForm(
      request
    );

  if (
    !isValidTwilioSignature({
      request,
      params,
    })
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid Twilio signature",
      },
      {
        status: 403,
      }
    );
  }

  const messageSid =
    String(
      params.MessageSid ||
      params.SmsSid ||
      ""
    ).trim();

  const providerStatus =
    String(
      params.MessageStatus ||
      params.SmsStatus ||
      ""
    )
      .trim()
      .toUpperCase();

  const errorCode =
    String(
      params.ErrorCode ||
      ""
    ).trim() ||
    null;

  const reminderLog =
    await prisma
      .birthdayReminderLog
      .findUnique({
        where: {
          id:
            reminderLogId,
        },

        include: {
          birthday: {
            include: {
              player: {
                select: {
                  name: true,
                },
              },

              league: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

  if (!reminderLog) {
    return NextResponse.json(
      {
        error:
          "Reminder log not found",
      },
      {
        status: 404,
      }
    );
  }

  /*
   * Reject a callback that clearly belongs to another
   * provider message once we already know the expected SID.
   */
  if (
    reminderLog.providerMessageId &&
    messageSid &&
    reminderLog.providerMessageId !==
      messageSid
  ) {
    return NextResponse.json(
      {
        error:
          "Message SID mismatch",
      },
      {
        status: 409,
      }
    );
  }

  const now =
    new Date();

  /*
   * Always persist callback telemetry first.
   */
  await prisma
    .birthdayReminderLog
    .update({
      where: {
        id:
          reminderLog.id,
      },

      data: {
        providerMessageId:
          reminderLog.providerMessageId ||
          messageSid ||
          null,

        providerStatus:
          providerStatus ||
          reminderLog.providerStatus,

        callbackReceivedAt:
          now,

        lastCallbackAt:
          now,

        lastErrorCode:
          errorCode,
      },
    });

  /*
   * Successful WhatsApp delivery.
   */
  if (
    providerStatus ===
      "DELIVERED" ||
    providerStatus ===
      "READ"
  ) {
    await prisma
      .birthdayReminderLog
      .update({
        where: {
          id:
            reminderLog.id,
        },

        data: {
          status:
            "SENT",

          sentAt:
            reminderLog.sentAt ||
            now,

          errorMessage:
            null,
        },
      });

    return NextResponse.json({
      success: true,
      action:
        "WHATSAPP_DELIVERED",
    });
  }

  /*
   * Twilio/WhatsApp accepted the request earlier, but delivery
   * ultimately failed. Send the SAME ContentSid and SAME
   * {{1}}/{{2}} variables by SMS.
   */
  if (
    providerStatus ===
      "FAILED" ||
    providerStatus ===
      "UNDELIVERED"
  ) {
    /*
     * Idempotency: Twilio can deliver more than one callback
     * for the same terminal status. Never send the SMS twice.
     */
    if (
      reminderLog
        .fallbackSmsMessageId ||
      reminderLog
        .fallbackSmsAttemptedAt
    ) {
      return NextResponse.json({
        success: true,
        action:
          "SMS_FALLBACK_ALREADY_HANDLED",
      });
    }

    await prisma
      .birthdayReminderLog
      .update({
        where: {
          id:
            reminderLog.id,
        },

        data: {
          fallbackSmsAttemptedAt:
            now,

          fallbackSmsStatus:
            "ATTEMPTING",

          fallbackSmsError:
            null,

          errorMessage:
            errorCode
              ? `WhatsApp ${providerStatus} (${errorCode})`
              : `WhatsApp ${providerStatus}`,
        },
      });

    const playerName =
      getBirthdayName(
        reminderLog
      );

    const leagueName =
      reminderLog
        ?.birthday
        ?.league
        ?.name
        ?.trim() ||
      "Cric4All League";

    try {
      const sms =
        await sendTwilioBirthdayTemplateSms({
          recipientPhone:
            reminderLog
              .recipientPhone,

          playerName,

          leagueName,
        });

      await prisma
        .birthdayReminderLog
        .update({
          where: {
            id:
              reminderLog.id,
          },

          data: {
            status:
              "SENT",

            sentAt:
              now,

            fallbackSmsStatus:
              sms.status ||
              "ACCEPTED",

            fallbackSmsMessageId:
              sms.messageSid,

            fallbackSmsQueuedAt:
              now,

            fallbackSmsError:
              null,
          },
        });

      console.log(
        "[OWNER_BIRTHDAY_SMS_FALLBACK_ACCEPTED]",
        {
          reminderLogId:
            reminderLog.id,

          birthdayId:
            reminderLog.birthdayId,

          leagueId:
            reminderLog.leagueId,

          whatsappMessageSid:
            messageSid,

          whatsappStatus:
            providerStatus,

          smsMessageSid:
            sms.messageSid,
        }
      );

      return NextResponse.json({
        success: true,
        action:
          "SMS_FALLBACK_SENT",
        smsMessageSid:
          sms.messageSid,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      await prisma
        .birthdayReminderLog
        .update({
          where: {
            id:
              reminderLog.id,
          },

          data: {
            status:
              "FAILED",

            fallbackSmsStatus:
              "FAILED",

            fallbackSmsError:
              errorMessage,
          },
        });

      console.error(
        "[OWNER_BIRTHDAY_SMS_FALLBACK_FAILED]",
        {
          reminderLogId:
            reminderLog.id,

          birthdayId:
            reminderLog.birthdayId,

          leagueId:
            reminderLog.leagueId,

          error:
            errorMessage,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "SMS fallback failed",
        },
        {
          status: 500,
        }
      );
    }
  }

  /*
   * ACCEPTED / QUEUED / SENDING / SENT are non-terminal.
   * Keep the reminder PENDING and wait for the final callback.
   */
  return NextResponse.json({
    success: true,
    action:
      "STATUS_RECORDED",
    status:
      providerStatus,
  });
}
