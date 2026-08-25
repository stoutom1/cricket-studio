import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import prisma from "@/lib/prisma";
import {
  sendEmailVerificationEmail,
} from "@/lib/email";
import {
  normalizeSmsPhoneNumber,
} from "@/lib/notifications/sms-phone";
import { recordGrowthEvent } from "@/lib/growth";
import {
  SMS_CONSENT_TEXT,
  SMS_CONSENT_VERSION,
} from "@/lib/compliance/sms-consent";
import {
  getEmailVerificationState,
  isReasonableEmailAddress,
  issueEmailVerificationToken,
  markEmailVerificationRequired,
  maskEmailAddress,
  normalizeEmailAddress,
  preservePendingInviteForUser,
} from "@/lib/email-verification";

export const runtime = "nodejs";

function appBaseUrl(request) {
  const configured =
    String(
      process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXTAUTH_URL ||
        ""
    )
      .trim()
      .replace(/\/$/, "");

  if (configured) {
    return configured;
  }

  return new URL(request.url).origin;
}

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

    const cleanName = String(name || "").trim();
    const cleanEmail = normalizeEmailAddress(email);
    const cleanPassword = String(password || "");
    const registrationInviteToken = String(
      inviteToken || invite || token || ""
    ).trim();

    if (!cleanName || !cleanEmail || !cleanPassword) {
      return NextResponse.json(
        {
          error: "Name, email, and password are required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!isReasonableEmailAddress(cleanEmail)) {
      return NextResponse.json(
        {
          error:
            "Enter a valid email address, such as name@example.com.",
          code: "INVALID_EMAIL",
        },
        {
          status: 400,
        }
      );
    }

    if (
      cleanPassword.length < 8 ||
      cleanPassword.length > 128
    ) {
      return NextResponse.json(
        {
          error:
            "Password must be between 8 and 128 characters.",
          code: "INVALID_PASSWORD_LENGTH",
        },
        {
          status: 400,
        }
      );
    }

    const wantsSms = smsOptIn === true;
    const normalizedSmsPhone =
      normalizeSmsPhoneNumber(smsPhoneNumber);

    if (wantsSms && !normalizedSmsPhone) {
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

    const existingUser = await prisma.user.findUnique({
      where: {
        email: cleanEmail,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      const verificationState =
        await getEmailVerificationState({
          userId: existingUser.id,
        });

      return NextResponse.json(
        {
          error: verificationState.verified
            ? "Email already registered. Please sign in."
            : "Email already registered but not yet verified. Please verify your email or request a new verification link.",
          code: "EMAIL_ALREADY_REGISTERED",
          verificationRequired:
            verificationState.required &&
            !verificationState.verified,
        },
        {
          status: 409,
        }
      );
    }

    const hashedPassword = await bcrypt.hash(
      cleanPassword,
      10
    );

    const forwardedFor = req.headers.get(
      "x-forwarded-for"
    );

    const consentIp =
      forwardedFor?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    const consentUserAgent =
      req.headers.get("user-agent") || null;

    const consentTimestamp = wantsSms
      ? new Date()
      : null;

    /*
     * User creation + verification-required state + first token are atomic.
     * This guarantees a newly created account can never accidentally fall
     * through the grandfathered-existing-user login rule.
     */
    const created = await prisma.$transaction(
      async (tx) => {
        const user = await tx.user.create({
          data: {
            name: cleanName,
            email: cleanEmail,
            password: hashedPassword,
            smsPhoneNumber: normalizedSmsPhone,
            smsOptIn: wantsSms,
            smsOptInAt: consentTimestamp,
            smsOptOutAt: null,
            smsConsentSource: wantsSms
              ? "ACCOUNT_REGISTRATION"
              : null,
            smsConsentIp: wantsSms
              ? consentIp
              : null,
            smsConsentUserAgent: wantsSms
              ? consentUserAgent
              : null,
            smsConsentText: wantsSms
              ? SMS_CONSENT_TEXT
              : null,
            smsConsentVersion: wantsSms
              ? SMS_CONSENT_VERSION
              : null,
          },
        });

        await markEmailVerificationRequired({
          client: tx,
          userId: user.id,
          email: user.email,
          request: req,
        });

        const verification =
          await issueEmailVerificationToken({
            client: tx,
            userId: user.id,
            email: user.email,
            request: req,
          });

        return {
          user,
          verification,
        };
      }
    );

    await recordGrowthEvent({
      eventType: "SIGNUP_COMPLETED",
      userId: created.user.id,
      source: "REGISTER_API",
      path: "/register",
    });

    let pendingInvite = null;
    let inviteWarning = null;

    if (registrationInviteToken) {
      try {
        pendingInvite =
          await preservePendingInviteForUser({
            userId: created.user.id,
            email: created.user.email,
            token: registrationInviteToken,
            request: req,
          });
      } catch (inviteError) {
        console.error(
          "Registration invite preservation failed:",
          inviteError
        );

        inviteWarning =
          inviteError?.message ||
          "Your account was created, but the league invitation could not be preserved.";
      }
    }

    const verificationLink = `${appBaseUrl(
      req
    )}/api/email-verification/verify?token=${encodeURIComponent(
      created.verification.token
    )}`;

    let verificationEmailSent = false;
    let emailWarning = null;

    try {
      await sendEmailVerificationEmail(
        created.user.email,
        created.user.name || "there",
        verificationLink,
        {
          leagueName: pendingInvite?.leagueName || null,
          roleLabel: pendingInvite?.roleLabel || null,
        }
      );

      verificationEmailSent = true;
    } catch (emailError) {
      console.error(
        "Verification email send failed:",
        emailError
      );

      emailWarning =
        "Your account was created, but the verification email could not be sent right now. Use Resend verification email on the next screen.";
    }

    return NextResponse.json({
      success: true,
      userId: created.user.id,
      email: created.user.email,
      maskedEmail: maskEmailAddress(
        created.user.email
      ),
      verificationRequired: true,
      verificationEmailSent,
      expiresAt:
        created.verification.expiresAt.toISOString(),
      pendingInvite: Boolean(pendingInvite),
      leagueId: pendingInvite?.leagueId || null,
      leagueName: pendingInvite?.leagueName || null,
      role: pendingInvite?.role || null,
      roleLabel: pendingInvite?.roleLabel || null,
      inviteWarning,
      emailWarning,
    });
  } catch (error) {
    console.error("Registration failed:", error);

    if (error?.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Please sign in.",
          code: "EMAIL_ALREADY_REGISTERED",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "Unable to create your account right now. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}
