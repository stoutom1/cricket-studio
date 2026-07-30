import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/email";
import {
  normalizeSmsPhoneNumber,
} from "@/lib/notifications/sms-phone";
import {
  SMS_CONSENT_TEXT,
  SMS_CONSENT_VERSION,
} from "@/lib/compliance/sms-consent";

export async function POST(req) {
  try {
    const body = await req.json();
const {
  name,
  email,
  password,
  smsPhoneNumber,
  smsOptIn,
} = body;


    if (!name || !email || !password) {
      return NextResponse.json(
        {
          error: "All fields are required"
        },
        { status: 400 }
      );
    }

    const wantsSms =
  smsOptIn === true;

const normalizedSmsPhone =
  normalizeSmsPhoneNumber(
    smsPhoneNumber
  );

if (
  wantsSms &&
  !normalizedSmsPhone
) {
  return NextResponse.json(
    {
      error:
        "Enter a valid mobile phone number with its country code before enabling SMS notifications.",
    },
    {
      status: 400,
    }
  );
}

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

    const existingUser =
      await prisma.user.findUnique({
        where: { email }
      });

    if (existingUser) {
      return NextResponse.json(
        {
          error: "Email already registered"
        },
        { status: 400 }
      );
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

const consentTimestamp =
  wantsSms
    ? new Date()
    : null;

const user =
  await prisma.user.create({
    data: {
      name:
        String(name).trim(),

      email:
        String(email)
          .trim()
          .toLowerCase(),

      password:
        hashedPassword,

smsPhoneNumber:
  normalizedSmsPhone,

      smsOptIn:
        wantsSms,

      smsOptInAt:
        consentTimestamp,

      smsOptOutAt:
        null,

      smsConsentSource:
        wantsSms
          ? "ACCOUNT_REGISTRATION"
          : null,

      smsConsentIp:
        wantsSms
          ? consentIp
          : null,

      smsConsentUserAgent:
        wantsSms
          ? consentUserAgent
          : null,

smsConsentText:
  wantsSms
    ? SMS_CONSENT_TEXT
    : null,

smsConsentVersion:
  wantsSms
    ? SMS_CONSENT_VERSION
    : null,
    },
  });

    await sendWelcomeEmail(
      user.email,
      user.name || "User",
    );
    return NextResponse.json({
      success: true,
      userId: user.id
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Something went wrong"
      },
      { status: 500 }
    );
  }
}