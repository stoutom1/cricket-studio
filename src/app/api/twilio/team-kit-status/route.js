import {
  NextResponse,
} from "next/server";
import twilio from "twilio";

import prisma from "@/lib/prisma";

export const runtime =
  "nodejs";
export const dynamic =
  "force-dynamic";
export const revalidate = 0;

function cleanPhone(value) {
  const input =
    String(
      value || ""
    ).trim();

  if (!input) {
    return "";
  }

  const normalized =
    input.replace(
      /[^\\d+]/g,
      ""
    );

  if (
    normalized.startsWith(
      "+"
    )
  ) {
    return normalized;
  }

  if (
    normalized.length === 10
  ) {
    return `+1${normalized}`;
  }

  return normalized
    ? `+${normalized}`
    : "";
}

function positiveInteger(value) {
  const parsed =
    Number(value);

  return (
    Number.isInteger(parsed) &&
    parsed > 0
      ? parsed
      : null
  );
}

function normalize(value) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function fallbackEnabled() {
  return (
    String(
      process.env
        .TEAM_KIT_SMS_FALLBACK_ENABLED ||
        "false"
    ).toLowerCase() ===
    "true"
  );
}

function appUrl(path = "") {
  const root =
    String(
      process.env
          .NEXT_PUBLIC_APP_URL ||
        process.env.APP_URL ||
        "https://cric4all.app"
    ).replace(/\/+$/, "");

  return `${root}${path}`;
}

async function sendSms({
  to,
  body,
}) {
  const accountSid =
    process.env
      .TWILIO_ACCOUNT_SID;
  const authToken =
    process.env
      .TWILIO_AUTH_TOKEN;
  const from =
    process.env
      .TWILIO_SMS_FROM ||
    process.env
      .TWILIO_FROM_NUMBER;

  if (
    !accountSid ||
    !authToken ||
    !from ||
    !to
  ) {
    throw new Error(
      "Twilio SMS configuration is incomplete."
    );
  }

  const credentials =
    Buffer.from(
      `${accountSid}:${authToken}`
    ).toString("base64");

  const form =
    new URLSearchParams();

  form.set("From", from);
  form.set("To", to);
  form.set("Body", body);

  const response =
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Basic ${credentials}`,
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body:
          form.toString(),
      }
    );

  const payload =
    await response.json();

  if (!response.ok) {
    throw new Error(
      payload?.message ||
      "Twilio rejected the SMS fallback."
    );
  }

  return payload;
}

async function latestEvent({
  leagueId,
  scopeKey,
  matchId,
  action,
  holderPlayerId,
}) {
  const rows =
    await prisma.$queryRaw`
      SELECT *
      FROM "TeamKitCustodyEvent"
      WHERE "leagueId" =
            ${leagueId}
        AND "scopeKey" =
            ${scopeKey}
        AND "matchId" =
            ${matchId}
        AND "action" =
            ${action}
        AND "holderPlayerId" =
            ${holderPlayerId}
      ORDER BY
        "createdAt" DESC,
        "id" DESC
      LIMIT 1
    `;

  return rows[0] || null;
}

async function appendNote(
  eventId,
  text
) {
  if (!eventId) {
    return;
  }

  await prisma.$executeRaw`
    UPDATE "TeamKitCustodyEvent"
    SET "note" =
      CONCAT(
        COALESCE(
          "note",
          ''
        ),
        ${` ${text}`}
      )
    WHERE "id" =
          ${eventId}
  `;
}

export async function POST(
  request
) {
  try {
    const formData =
      await request.formData();

    const values =
      Object.fromEntries(
        formData.entries()
      );

    const authToken =
      process.env
        .TWILIO_AUTH_TOKEN;

    if (!authToken) {
      return NextResponse.json(
        {
          error:
            "Twilio configuration is incomplete.",
        },
        {
          status: 500,
        }
      );
    }

    const signature =
      request.headers.get(
        "x-twilio-signature"
      ) || "";

    if (
      !twilio.validateRequest(
        authToken,
        signature,
        request.url,
        values
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid Twilio signature.",
        },
        {
          status: 403,
        }
      );
    }

    const url =
      new URL(request.url);

    const leagueId =
      positiveInteger(
        url.searchParams.get(
          "leagueId"
        )
      );
    const scopeKey =
      String(
        url.searchParams.get(
          "scopeKey"
        ) || ""
      );
    const matchId =
      positiveInteger(
        url.searchParams.get(
          "matchId"
        )
      );
    const action =
      String(
        url.searchParams.get(
          "action"
        ) || ""
      );
    const holderPlayerId =
      positiveInteger(
        url.searchParams.get(
          "holderPlayerId"
        )
      );

    const status =
      normalize(
        values.MessageStatus ||
        values.SmsStatus
      );
    const messageSid =
      String(
        values.MessageSid ||
        values.SmsSid ||
        ""
      );
    const errorCode =
      String(
        values.ErrorCode ||
        ""
      );

    const event =
      leagueId &&
      scopeKey &&
      matchId &&
      action &&
      holderPlayerId
        ? await latestEvent({
            leagueId,
            scopeKey,
            matchId,
            action,
            holderPlayerId,
          })
        : null;

    if (
      ![
        "failed",
        "undelivered",
      ].includes(status)
    ) {
      await appendNote(
        event?.id,
        `WhatsApp callback ${messageSid || ""}: ${status || "unknown"}.`
      );

      return NextResponse.json({
        received: true,
        status:
          status || "unknown",
      });
    }

    await appendNote(
      event?.id,
      `WhatsApp callback ${messageSid || ""}: ${status}; error ${errorCode || "none"}.`
    );

    if (!fallbackEnabled()) {
      return NextResponse.json({
        received: true,
        fallbackSent: false,
        reason:
          "SMS fallback disabled.",
      });
    }

    if (
      String(
        event?.note || ""
      ).includes(
        "Channel SMS_FALLBACK"
      )
    ) {
      return NextResponse.json({
        received: true,
        duplicate: true,
        fallbackSent: true,
      });
    }

    const player =
      await prisma.player
        .findUnique({
          where: {
            id:
              holderPlayerId,
          },
          select: {
            name: true,
            whatsappNumber:
              true,
            smsOptIn: true,
            smsOptOutAt:
              true,
          },
        });

    const smsTo =
      cleanPhone(
        player
          ?.whatsappNumber
      );

    if (
      !player ||
      player.smsOptIn !==
        true ||
      player.smsOptOutAt !=
        null ||
      !smsTo
    ) {
      await appendNote(
        event?.id,
        "SMS fallback unavailable because SMS consent or phone number is missing."
      );

      return NextResponse.json({
        received: true,
        fallbackSent: false,
        reason:
          "SMS_NOT_ALLOWED",
      });
    }

    const rows =
      await prisma.$queryRaw`
        SELECT
          state.*,
          team."name"
            AS "teamName",
          team_a."name"
            AS "teamAName",
          team_b."name"
            AS "teamBName"
        FROM "TeamKitState"
          state
        LEFT JOIN "Team"
          team
          ON team."id" =
             state."teamId"
        LEFT JOIN "Match"
          match
          ON match."id" =
             ${matchId}
        LEFT JOIN "Team"
          team_a
          ON team_a."id" =
             match."teamAId"
        LEFT JOIN "Team"
          team_b
          ON team_b."id" =
             match."teamBId"
        WHERE state."leagueId" =
              ${leagueId}
          AND state."scopeKey" =
              ${scopeKey}
        LIMIT 1
      `;

    const state =
      rows[0] || null;

    const scopeName =
      state?.teamId
        ? `${
            state.teamName ||
            "Team"
          } kit`
        : "the shared league kit";

    const matchName =
      `${state?.teamAName || "Team A"} vs ${state?.teamBName || "Team B"}`;

    const kitUrl =
      appUrl(
        `/dashboard?tab=kit&leagueId=${leagueId}`
      );

    const body = [
      "Cric4All team kit update:",
      `${player.name || "Current holder"} is the recorded holder of ${scopeName} for ${matchName}.`,
      `View or correct the kit record: ${kitUrl}`,
      "No action is needed if the record is already correct.",
      "Reply STOP to opt out.",
    ].join(" ");

    const sms =
      await sendSms({
        to:
          smsTo,
        body,
      });

    await appendNote(
      event?.id,
      `Channel SMS_FALLBACK; Twilio SMS ${sms.sid || "submitted"}; status ${sms.status || "queued"}.`
    );

    return NextResponse.json({
      received: true,
      fallbackSent: true,
      smsMessageSid:
        sms.sid || null,
      smsStatus:
        sms.status || null,
    });
  } catch (error) {
    console.error(
      "[TEAM_KIT_TWILIO_STATUS_FAILED]",
      error
    );

    return NextResponse.json(
      {
        received: false,
        error:
          error?.message ||
          "Unable to process Team Kit Twilio status.",
      },
      {
        status: 500,
      }
    );
  }
}
