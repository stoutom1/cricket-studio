import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import {
  sendWhatsAppBirthdayMessage,
} from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanPhoneNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidPhoneNumber(value) {
  return value.length >= 10 && value.length <= 15;
}

function getDatePartsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }
  );

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

export async function GET(request) {
  try {
    const authorization =
      request.headers.get("authorization");

    const cronSecret =
      process.env.CRON_SECRET;

    if (
      !cronSecret ||
      authorization !== `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
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

    console.log("Running birthday scheduler:", {
      timeZone,
      sentDate,
      month: today.month,
      day: today.day,
    });

    const birthdays =
      await prisma.leagueBirthday.findMany({
        where: {
  isActive: true,
  birthMonth: today.month,
  birthDay: today.day,
  whatsappOptIn: true,
  whatsappNumber: {
    not: null,
  },
},

 select: {
  id: true,
  name: true,
  birthMonth: true,
  birthDay: true,
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
      });
console.log("birthdays in cron api:",birthdays);
    const results = [];

    for (const birthday of birthdays) {
const playerName =
  birthday.player?.name ||
  birthday.name;

const recipientPhone =
  cleanPhoneNumber(
    birthday.whatsappNumber
  );

      if (!isValidPhoneNumber(recipientPhone)) {
        results.push({
          birthdayId: birthday.id,
          playerName,
          status: "SKIPPED",
          reason:
            "Missing or invalid WhatsApp number.",
        });

        continue;
      }

      const existingLog =
        await prisma.birthdayReminderLog.findUnique({
          where: {
            birthdayId_recipientPhone_sentDate: {
              birthdayId: birthday.id,
              recipientPhone,
              sentDate,
            },
          },
        });

      if (existingLog) {
        results.push({
          birthdayId: birthday.id,
          playerName,
          status: "SKIPPED",
          reason:
            "Birthday message already processed today.",
        });

        continue;
      }

      try {
        const sendResult =
          await sendWhatsAppBirthdayMessage({
            recipientPhone,
            playerName,
            leagueName:
              birthday.league.name,
          });

        await prisma.birthdayReminderLog.create({
          data: {
            birthday: {
              connect: {
                id: birthday.id,
              },
            },

            recipientPhone,
            sentDate,
            messageId:
              sendResult.messageId,
            status: "SENT",
          },
        });

        results.push({
          birthdayId: birthday.id,
          playerName,
          status: "SENT",
          messageId:
            sendResult.messageId,
        });
      } catch (sendError) {
        const errorMessage =
          sendError instanceof Error
            ? sendError.message
            : "Unknown WhatsApp error.";

        /*
         * Save the failure, but do not allow a logging
         * failure to terminate the whole scheduler.
         */
        try {
          await prisma.birthdayReminderLog.create({
            data: {
              birthday: {
                connect: {
                  id: birthday.id,
                },
              },

              recipientPhone,
              sentDate,
              status: "FAILED",
              errorMessage,
            },
          });
        } catch (logError) {
          console.error(
            "Unable to save birthday failure log:",
            logError
          );
        }

        results.push({
          birthdayId: birthday.id,
          playerName,
          status: "FAILED",
          error: errorMessage,
        });
      }
    }

    return NextResponse.json({
      success: true,
      timeZone,
      date: sentDate,
      birthdaysFound: birthdays.length,
      sentCount: results.filter(
        (result) => result.status === "SENT"
      ).length,
      skippedCount: results.filter(
        (result) => result.status === "SKIPPED"
      ).length,
      failedCount: results.filter(
        (result) => result.status === "FAILED"
      ).length,
      results,
    });
  } catch (error) {
    console.error(
      "Birthday scheduler error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Birthday scheduler failed.",
      },
      { status: 500 }
    );
  }
}