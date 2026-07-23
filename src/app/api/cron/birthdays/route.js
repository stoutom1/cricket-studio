import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { sendBirthdayOwnerSms } from "@/lib/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanPhoneNumber(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function formatPhoneNumberForSms(value) {
  const digits = cleanPhoneNumber(value);

  if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  return `+${digits}`;
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
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
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

    /*
     * Birthday timezone.
     */
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
     * Get every active birthday for today.
     *
     * We no longer need:
     * - whatsappNumber
     * - whatsappOptIn
     *
     * This cron is notifying the Cric4All owner,
     * not sending directly to the birthday player.
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

        orderBy: [
          {
            league: {
              name: "asc",
            },
          },
          {
            name: "asc",
          },
        ],
      });

    console.log(
      "Today's birthday records:",
      birthdays.map((birthday) => ({
        birthdayId: birthday.id,

        playerName:
          birthday.player?.name?.trim() ||
          birthday.name?.trim() ||
          "Player",

        leagueId:
          birthday.league?.id || null,

        leagueName:
          birthday.league?.name?.trim() ||
          "Cric4All League",

        birthMonth: birthday.birthMonth,
        birthDay: birthday.birthDay,
      }))
    );

    /*
     * Nothing to send when there are no birthdays.
     */
    if (birthdays.length === 0) {
      return NextResponse.json({
        success: true,
        timeZone,
        date: sentDate,
        month: today.month,
        day: today.day,
        birthdaysFound: 0,
        smsSent: false,
        message:
          `No active birthdays were found for ` +
          `${today.month}/${today.day}.`,
        birthdays: [],
      });
    }

    /*
     * This is your phone number, or the phone number
     * that should receive the daily birthday alert.
     *
     * Example:
     * BIRTHDAY_OWNER_PHONE=+16105551234
     */
    const ownerPhone =
      formatPhoneNumberForSms(
        process.env.BIRTHDAY_OWNER_PHONE
      );

    if (!ownerPhone) {
      console.error(
        "Birthday owner SMS skipped because " +
          "BIRTHDAY_OWNER_PHONE is missing or invalid."
      );

      return NextResponse.json(
        {
          success: false,
          timeZone,
          date: sentDate,
          month: today.month,
          day: today.day,
          birthdaysFound: birthdays.length,
          smsSent: false,
          error:
            "BIRTHDAY_OWNER_PHONE is missing or invalid. " +
            "Include the country code.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Convert database records into the smaller structure
     * needed by the SMS function.
     */
    const birthdaySummary = birthdays.map(
      (birthday) => ({
        birthdayId: birthday.id,

        playerId:
          birthday.player?.id || null,

        playerName:
          birthday.player?.name?.trim() ||
          birthday.name?.trim() ||
          "Player",

        leagueId:
          birthday.league?.id || null,

        leagueName:
          birthday.league?.name?.trim() ||
          "Cric4All League",
      })
    );

    try {
      console.log(
        "Sending birthday owner SMS:",
        {
          ownerPhone,
          birthdayCount:
            birthdaySummary.length,
          date: sentDate,
        }
      );

      /*
       * Send one SMS containing all birthdays.
       */
      const smsResult =
        await sendBirthdayOwnerSms({
          ownerPhone,
          birthdays: birthdaySummary,
          date: sentDate,
        });

      console.log(
        "Birthday owner SMS sent:",
        {
          ownerPhone,
          birthdayCount:
            birthdaySummary.length,
          messageId:
            smsResult?.messageId || null,
        }
      );

      return NextResponse.json({
        success: true,
        timeZone,
        date: sentDate,
        month: today.month,
        day: today.day,

        birthdaysFound:
          birthdaySummary.length,

        smsSent: true,

        ownerPhone,

        messageId:
          smsResult?.messageId || null,

        message:
          "Birthday owner notification sent successfully.",

        birthdays: birthdaySummary,
      });
    } catch (smsError) {
      const errorMessage =
        getErrorMessage(smsError);

      console.error(
        "Birthday owner SMS failed:",
        {
          ownerPhone,
          birthdayCount:
            birthdaySummary.length,
          error: errorMessage,
        }
      );

      return NextResponse.json(
        {
          success: false,
          timeZone,
          date: sentDate,
          month: today.month,
          day: today.day,

          birthdaysFound:
            birthdaySummary.length,

          smsSent: false,

          error: errorMessage,

          birthdays: birthdaySummary,
        },
        {
          status: 500,
        }
      );
    }
  } catch (error) {
    const errorMessage =
      getErrorMessage(error);

    console.error(
      "Birthday scheduler error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      {
        status: 500,
      }
    );
  }
}