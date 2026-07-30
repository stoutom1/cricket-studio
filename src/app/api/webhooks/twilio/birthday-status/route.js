import { NextResponse } from "next/server";
import twilio from "twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formDataToObject(formData) {
  const values = {};

  for (const [key, value] of formData.entries()) {
    values[key] = String(value);
  }

  return values;
}

function getPublicCallbackUrl(request) {
  const requestUrl = new URL(request.url);

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();

  if (forwardedProto && forwardedHost) {
    return (
      `${forwardedProto}://${forwardedHost}` +
      requestUrl.pathname +
      requestUrl.search
    );
  }

  return request.url;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const parameters = formDataToObject(formData);

    const requestUrl = new URL(request.url);

    const birthdayId =
      requestUrl.searchParams.get("birthdayId");

    const leagueId =
      requestUrl.searchParams.get("leagueId");

    const messageSid =
      parameters.MessageSid ||
      parameters.SmsSid ||
      null;

    const messageStatus = String(
      parameters.MessageStatus ||
        parameters.SmsStatus ||
        ""
    )
      .trim()
      .toUpperCase();

    const errorCode =
      parameters.ErrorCode || null;

    const channelStatusMessage =
      parameters.ChannelStatusMessage || null;

    console.log(
      "[BIRTHDAY_WHATSAPP_CALLBACK_RECEIVED]",
      {
        birthdayId,
        leagueId,
        messageSid,
        messageStatus,
        errorCode,
        channelStatusMessage,
      }
    );

    const authToken = String(
      process.env.TWILIO_AUTH_TOKEN || ""
    ).trim();

    if (!authToken) {
      console.error(
        "[BIRTHDAY_WHATSAPP_CALLBACK] Missing TWILIO_AUTH_TOKEN"
      );

      /*
       * Return 200 so Twilio does not repeatedly retry
       * while configuration is being corrected.
       */
      return NextResponse.json({
        success: true,
        received: true,
        configurationError: true,
      });
    }

    const twilioSignature =
      request.headers.get("x-twilio-signature") ||
      "";

    const callbackUrl =
      getPublicCallbackUrl(request);

    const validSignature =
      twilio.validateRequest(
        authToken,
        twilioSignature,
        callbackUrl,
        parameters
      );

    console.log(
      "[BIRTHDAY_WHATSAPP_CALLBACK_VALIDATION]",
      {
        validSignature,
        callbackUrl,
        hasTwilioSignature:
          Boolean(twilioSignature),
        birthdayId,
        leagueId,
        messageSid,
      }
    );

    if (!validSignature) {
      console.error(
        "[BIRTHDAY_WHATSAPP_CALLBACK_INVALID_SIGNATURE]",
        {
          callbackUrl,
          birthdayId,
          leagueId,
          messageSid,
        }
      );

      /*
       * During initial setup, acknowledge the callback so
       * Twilio does not register another 11200. No database
       * changes are made when the signature is invalid.
       */
      return NextResponse.json({
        success: true,
        received: true,
        signatureValid: false,
      });
    }

    if (!messageSid) {
      console.warn(
        "[BIRTHDAY_WHATSAPP_CALLBACK_MISSING_SID]",
        {
          birthdayId,
          leagueId,
          messageStatus,
        }
      );

      return NextResponse.json({
        success: true,
        received: true,
        matched: false,
      });
    }

    /*
     * Initial safe version:
     * receive, validate and log the callback.
     *
     * We will add the Prisma update only after matching this
     * route to your actual birthday reminder model and fields.
     */

    return NextResponse.json({
      success: true,
      received: true,
      signatureValid: true,
      birthdayId,
      leagueId,
      messageSid,
      messageStatus,
    });
  } catch (error) {
    console.error(
      "[BIRTHDAY_WHATSAPP_CALLBACK_FAILED]",
      error
    );

    /*
     * Return 200 during webhook processing failures to avoid
     * Twilio repeatedly reporting HTTP retrieval failures.
     * The failure is still recorded in Vercel logs.
     */
    return NextResponse.json({
      success: true,
      received: true,
      processingError: true,
    });
  }
}