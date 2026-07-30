import {
  NextResponse,
} from "next/server";

import {
  getServerSession,
} from "next-auth";

import prisma from "@/lib/prisma";
import {
  authOptions,
} from "@/lib/auth";

import {
  normalizeSmsPhoneNumber,
} from "@/lib/notifications/sms-phone";

import {
  SMS_CONSENT_TEXT,
  SMS_CONSENT_VERSION,
} from "@/lib/compliance/sms-consent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request) {
  const session =
    await getServerSession(
      authOptions
    );

  if (!session?.user?.email) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const body =
      await request.json();

    const smsOptIn =
      body?.smsOptIn === true;

    const normalizedPhone =
      normalizeSmsPhoneNumber(
        body?.smsPhoneNumber
      );

    if (
      smsOptIn &&
      !normalizedPhone
    ) {
      return NextResponse.json(
        {
          error:
            "Enter a valid mobile phone number before enabling SMS notifications.",
        },
        {
          status: 400,
        }
      );
    }

    const now =
      new Date();

    const forwardedFor =
      request.headers.get(
        "x-forwarded-for"
      );

    const consentIp =
      forwardedFor
        ?.split(",")[0]
        ?.trim() ||
      request.headers.get(
        "x-real-ip"
      ) ||
      null;

    const consentUserAgent =
      request.headers.get(
        "user-agent"
      ) ||
      null;

    const user =
      await prisma.user.update({
        where: {
          email:
            session.user.email
              .trim()
              .toLowerCase(),
        },
        data: {
          smsPhoneNumber:
            normalizedPhone,

          smsOptIn,

          smsOptInAt:
            smsOptIn
              ? now
              : undefined,

          smsOptOutAt:
            smsOptIn
              ? null
              : now,

          smsConsentSource:
            smsOptIn
              ? "ACCOUNT_SETTINGS"
              : "ACCOUNT_SETTINGS_OPTOUT",

          smsConsentIp:
            smsOptIn
              ? consentIp
              : null,

          smsConsentUserAgent:
            smsOptIn
              ? consentUserAgent
              : null,

          smsConsentText:
            smsOptIn
              ? SMS_CONSENT_TEXT
              : null,

          smsConsentVersion:
            smsOptIn
              ? SMS_CONSENT_VERSION
              : null,
        },
        select: {
          id: true,
          smsPhoneNumber: true,
          smsOptIn: true,
          smsOptInAt: true,
          smsOptOutAt: true,
        },
      });

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(
      "Unable to update SMS preferences:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to update SMS preferences.",
      },
      {
        status: 500,
      }
    );
  }
}