import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import {
  sendWhatsAppBirthdayMessage,
} from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanPhoneNumber(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function isValidPhoneNumber(value) {
  return value.length >= 10 && value.length <= 15;
}

function getDatePartsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  const parts = formatter.formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function formatDateKey({ year, month, day }) {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : "Unknown error.";
}

export async function GET(request) {
  try {
    /*
     * Protect the cron API.
     */
    const authorization =
      request.headers.get("authorization");

    const cronSecret =
      process.env.CRON_SECRET;

    if (
      !cronSecret ||
      authorization !== `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const timeZone =
      process.env.BIRTHDAY_TIME_ZONE ||
      "America/Los_Angeles";

    const today = getDatePartsInTimeZone(
      new Date(),
      timeZone
    );

    const sentDate = formatDateKey(today);

    console.log("Birthday scheduler started:", {
      timeZone,
      sentDate,
      month: today.month,
      day: today.day,
    });

    /*
     * Important:
     * Do not filter by WhatsApp consent or number here.
     *
     * First load every active birthday for today.
     * We validate WhatsApp details in the loop so that
     * skipped records and reasons are visible.
     */
    const birthdays =
      await prisma.leagueBirthday.findMany({
        where: {
          isActive: true,
          birthMonth: today.month,
          birthDay: today.day,
        },

        select: {
          id: true,
          name: true,
          birthMonth: true,
          birthDay: true,
          isActive: true,
          whatsappNumber: true,
          whatsappOptIn: true,

          league: {
            select: {
              id: true,
              name: true,
            },
          },

          player: {
            select: {
              id: true,
              name: true,
            },
          },
        },

        orderBy: {
          name: "asc",
        },
      });

    console.log(
      "Today's birthday records:",
      birthdays.map((birthday) => ({
        id: birthday.id,
        name:
          birthday.player?.name ||
          birthday.name,
        birthMonth: birthday.birthMonth,
        birthDay: birthday.birthDay,
        isActive: birthday.isActive,
        whatsappOptIn:
          birthday.whatsappOptIn,
        hasWhatsAppNumber: Boolean(
          String(
            birthday.whatsappNumber ?? ""
          ).trim()
        ),
      }))
    );

    const results = [];

 for (const birthday of birthdays) {
  const playerName =
    birthday.player?.name?.trim() ||
    birthday.name?.trim() ||
    "Player";

  const leagueName =
    birthday.league?.name?.trim() ||
    "Cric4All League";

  const recipientPhone =
    cleanPhoneNumber(
      birthday.whatsappNumber
    );

  if (birthday.whatsappOptIn !== true) {
    results.push({
      birthdayId: birthday.id,
      playerName,
      status: "SKIPPED",
      reason:
        "WhatsApp consent is not enabled.",
    });

    continue;
  }

  if (!isValidPhoneNumber(recipientPhone)) {
    results.push({
      birthdayId: birthday.id,
      playerName,
      status: "SKIPPED",
      reason:
        "WhatsApp number is missing or invalid. Include the country code.",
    });

    continue;
  }

  try {
    console.log(
      "Sending birthday WhatsApp message:",
      {
        birthdayId: birthday.id,
        playerName,
        leagueName,
        recipientPhone,
      }
    );

    const sendResult =
      await sendWhatsAppBirthdayMessage({
        recipientPhone,
        playerName,
        leagueName,
      });

    console.log(
      "Birthday WhatsApp message sent:",
      {
        birthdayId: birthday.id,
        playerName,
        recipientPhone,
        messageId:
          sendResult?.messageId || null,
      }
    );

    results.push({
      birthdayId: birthday.id,
      playerName,
      recipientPhone,
      status: "SENT",
      messageId:
        sendResult?.messageId || null,
    });
  } catch (sendError) {
    const errorMessage =
      getErrorMessage(sendError);

    console.error(
      "WhatsApp birthday sending failed:",
      {
        birthdayId: birthday.id,
        playerName,
        recipientPhone,
        error: errorMessage,
      }
    );

    results.push({
      birthdayId: birthday.id,
      playerName,
      recipientPhone,
      status: "FAILED",
      error: errorMessage,
    });
  }
}

    const sentCount = results.filter(
      (result) => result.status === "SENT"
    ).length;

    const skippedCount = results.filter(
      (result) => result.status === "SKIPPED"
    ).length;

    const failedCount = results.filter(
      (result) => result.status === "FAILED"
    ).length;

    return NextResponse.json({
      success: true,
      timeZone,
      date: sentDate,
      month: today.month,
      day: today.day,

      birthdaysFound: birthdays.length,
      sentCount,
      skippedCount,
      failedCount,

      message:
        birthdays.length === 0
          ? `No active birthdays were found for ${today.month}/${today.day}.`
          : "Birthday scheduler completed.",

      results,
    });
  } catch (error) {
    console.error(
      "Birthday scheduler error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      {
        status: 500,
      }
    );
  }
}