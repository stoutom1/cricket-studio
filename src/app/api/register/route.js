import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/email";
import {
  normalizeSmsPhoneNumber,
} from "@/lib/notifications/sms-phone";
import { recordGrowthEvent } from "@/lib/growth";
import {
  SMS_CONSENT_TEXT,
  SMS_CONSENT_VERSION,
} from "@/lib/compliance/sms-consent";
import { claimLeagueInviteForUser } from "@/lib/league-invite-claim";

export async function POST(req) {
  try {
    const body = await req.json();
const {
  name,
  email,
  password,
  smsPhoneNumber,
  smsOptIn,
  inviteToken,
  invite,
  token,
} = body;

const registrationInviteToken =
  String(inviteToken || invite || token || "").trim();


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
  req.headers.get(
    "x-forwarded-for"
  );

const consentIp =
  forwardedFor
    ?.split(",")[0]
    ?.trim() ||
  req.headers.get(
    "x-real-ip"
  ) ||
  null;

const consentUserAgent =
  req.headers.get(
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

    await recordGrowthEvent({ eventType: "SIGNUP_COMPLETED", userId: user.id, source: "REGISTER_API", path: "/register" });

    let inviteResult = null;
    let inviteWarning = "";

    if (registrationInviteToken) {
      try {
        inviteResult = await claimLeagueInviteForUser({
          token: registrationInviteToken,
          userId: user.id,
          userEmail: user.email,
        });
      } catch (inviteError) {
        console.error("Registration invite assignment failed:", inviteError);
        inviteWarning =
          inviteError?.message ||
          "Your account was created, but the league invitation could not be applied.";
      }
    }

    await sendWelcomeEmail(
      user.email,
      user.name || "User",
    );

    return NextResponse.json({
      success: true,
      userId: user.id,
      inviteApplied: Boolean(inviteResult?.success),
      leagueId: inviteResult?.leagueId || null,
      leagueName: inviteResult?.leagueName || null,
      role: inviteResult?.role || null,
      roleLabel: inviteResult?.roleLabel || null,
      inviteWarning: inviteWarning || null,
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