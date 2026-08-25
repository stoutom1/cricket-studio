import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import {
  getEmailVerificationState,
  getResendEligibility,
  issueEmailVerificationToken,
  maskEmailAddress,
  normalizeEmailAddress,
} from "@/lib/email-verification";
import {
  sendEmailVerificationEmail,
} from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appBaseUrl(request) {
  return (
    String(
      process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXTAUTH_URL ||
        ""
    )
      .trim()
      .replace(/\/$/, "") ||
    new URL(request.url).origin
  );
}

export async function POST(request) {
  try {
    const body = await request
      .json()
      .catch(() => ({}));

    const email = normalizeEmailAddress(
      body?.email
    );

    /*
     * Generic success for unknown accounts prevents this endpoint from being
     * used as a public email-account enumeration API.
     */
    if (!email) {
      return NextResponse.json({
        success: true,
        message:
          "If that address has an unverified Cric4All account, a verification email will be sent.",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return NextResponse.json({
        success: true,
        message:
          "If that address has an unverified Cric4All account, a verification email will be sent.",
      });
    }

    const state = await getEmailVerificationState({
      userId: user.id,
      email: user.email,
    });

    if (
      !state.required ||
      state.verified
    ) {
      return NextResponse.json({
        success: true,
        alreadyVerified: true,
        message:
          "This email address is already verified. You can sign in.",
      });
    }

    const resend = await getResendEligibility(
      user.id,
      user.email
    );

    if (!resend.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: "RESEND_COOLDOWN",
          retryAfterSeconds:
            resend.retryAfterSeconds,
          message: `Please wait ${resend.retryAfterSeconds} seconds before requesting another verification email.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              resend.retryAfterSeconds
            ),
          },
        }
      );
    }

    const verification =
      await issueEmailVerificationToken({
        userId: user.id,
        email: user.email,
        request,
      });

    const verificationLink = `${appBaseUrl(
      request
    )}/api/email-verification/verify?token=${encodeURIComponent(
      verification.token
    )}`;

    await sendEmailVerificationEmail(
      user.email,
      user.name || "there",
      verificationLink
    );

    return NextResponse.json({
      success: true,
      maskedEmail: maskEmailAddress(
        user.email
      ),
      expiresAt:
        verification.expiresAt.toISOString(),
      message:
        "A new verification email has been sent. Please check your inbox and spam folder.",
    });
  } catch (error) {
    console.error(
      "Resend verification email failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to send a verification email right now. Please try again shortly.",
      },
      {
        status: 500,
      }
    );
  }
}
