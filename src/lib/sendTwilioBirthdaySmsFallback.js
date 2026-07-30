import twilio from "twilio";

let cachedClient = null;

function getTwilioClient() {
  const accountSid = String(
    process.env.TWILIO_ACCOUNT_SID || ""
  ).trim();

  const authToken = String(
    process.env.TWILIO_AUTH_TOKEN || ""
  ).trim();

  if (!accountSid) {
    throw new Error(
      "TWILIO_ACCOUNT_SID is missing."
    );
  }

  if (!authToken) {
    throw new Error(
      "TWILIO_AUTH_TOKEN is missing."
    );
  }

  if (!cachedClient) {
    cachedClient = twilio(
      accountSid,
      authToken
    );
  }

  return cachedClient;
}

function normalizeSmsNumber(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, "");

  if (
    !/^\+[1-9]\d{7,14}$/.test(normalized)
  ) {
    throw new Error(
      "SMS recipient must use E.164 format, for example +16025551234."
    );
  }

  return normalized;
}

export async function sendTwilioBirthdaySmsFallback({
  recipientPhone,
  messageBody,
  reminderLogId,
  birthdayId,
  leagueId,
}) {
  const messagingServiceSid = String(
    process.env
      .TWILIO_SMS_MESSAGING_SERVICE_SID ||
      ""
  ).trim();

  if (!messagingServiceSid) {
    throw new Error(
      "TWILIO_SMS_MESSAGING_SERVICE_SID is missing."
    );
  }

  const normalizedRecipient =
    normalizeSmsNumber(recipientPhone);

  const cleanMessageBody = String(
    messageBody || ""
  ).trim();

  if (!cleanMessageBody) {
    throw new Error(
      "SMS fallback message body is required."
    );
  }

  const client = getTwilioClient();
  const startedAt = Date.now();

  try {
    const message =
      await client.messages.create({
        messagingServiceSid,

        // Important: SMS uses the regular E.164 number.
        // Do not prefix it with "whatsapp:".
        to: normalizedRecipient,

        body: cleanMessageBody,
      });

    if (!message?.sid) {
      throw new Error(
        "Twilio accepted the SMS fallback but did not return a Message SID."
      );
    }

    const providerStatus = String(
      message.status || "accepted"
    ).toUpperCase();

    console.log(
      "[BIRTHDAY_SMS_FALLBACK_ACCEPTED]",
      {
        reminderLogId,
        birthdayId,
        leagueId,
        recipientPhone:
          normalizedRecipient,
        messageSid:
          message.sid,
        providerStatus,
        elapsedMs:
          Date.now() - startedAt,
      }
    );

    return {
      success: true,
      messageSid: message.sid,
      status: providerStatus,
      recipient:
        message.to ||
        normalizedRecipient,
    };
  } catch (error) {
    console.error(
      "[BIRTHDAY_SMS_FALLBACK_SEND_FAILED]",
      {
        reminderLogId,
        birthdayId,
        leagueId,
        recipientPhone:
          normalizedRecipient,
        code:
          error?.code ?? null,
        status:
          error?.status ?? null,
        error:
          error instanceof Error
            ? error.message
            : String(error),
        elapsedMs:
          Date.now() - startedAt,
      }
    );

    throw error;
  }
}