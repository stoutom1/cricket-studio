import { NextResponse } from "next/server";

import {
  verifyEmailToken,
} from "@/lib/email-verification";
import {
  sendWelcomeEmail,
} from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function baseUrl(request) {
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

function verificationPageUrl(request, params) {
  const url = new URL(
    "/verify-email",
    baseUrl(request)
  );

  for (const [key, value] of Object.entries(params || {})) {
    if (
      value !== null &&
      value !== undefined &&
      String(value) !== ""
    ) {
      url.searchParams.set(
        key,
        String(value)
      );
    }
  }

  return url;
}

export async function GET(request) {
  const token =
    new URL(request.url).searchParams.get(
      "token"
    );

  try {
    const result = await verifyEmailToken(
      token,
      request
    );

    if (!result.success) {
      return NextResponse.redirect(
        verificationPageUrl(request, {
          status: "error",
          code: result.code,
          message: result.message,
          email: result.email || "",
        })
      );
    }

    /*
     * Welcome email moves here from registration. We only say "welcome" after
     * ownership of the email address has actually been proven.
     */
    if (!result.alreadyVerified) {
      try {
        await sendWelcomeEmail(
          result.user.email,
          result.user.name || "User"
        );
      } catch (welcomeError) {
        console.error(
          "Welcome email after verification failed:",
          welcomeError
        );
      }
    }

    const invite = result.primaryInvite;

    const callbackUrl = invite?.leagueId
      ? `/dashboard?leagueId=${encodeURIComponent(
          invite.leagueId
        )}`
      : "/dashboard";

    return NextResponse.redirect(
      verificationPageUrl(request, {
        status: "success",
        email: result.user.email,
        callbackUrl,
        leagueId: invite?.leagueId || "",
        leagueName: invite?.leagueName || "",
        role: invite?.role || "",
        roleLabel: invite?.roleLabel || "",
        inviteApplied: invite ? "1" : "0",
        inviteFailures: result.inviteResults.filter(
          (item) => !item.success
        ).length,
      })
    );
  } catch (error) {
    console.error(
      "Email verification route failed:",
      error
    );

    return NextResponse.redirect(
      verificationPageUrl(request, {
        status: "error",
        code: "VERIFY_FAILED",
        message:
          "Unable to verify your email right now. Please try again or request a new link.",
      })
    );
  }
}
