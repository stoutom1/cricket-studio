import twilio from "twilio";

let cachedClient = null;

function getTwilioClient() {
  const accountSid =
    process.env.TWILIO_ACCOUNT_SID;

  const authToken =
    process.env.TWILIO_AUTH_TOKEN;

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

function getBirthdayWhatsAppStatusCallbackUrl({
  birthdayId,
  leagueId,
}) {
  const baseUrl =
    String(
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://cric4all.app"
    ).replace(/\/+$/, "");

  const searchParams =
    new URLSearchParams();

  if (birthdayId) {
    searchParams.set(
      "birthdayId",
      String(birthdayId)
    );
  }

  if (leagueId) {
    searchParams.set(
      "leagueId",
      String(leagueId)
    );
  }

  return (
    `${baseUrl}/api/webhooks/twilio/birthday-status?` +
    searchParams.toString()
  );
}

export function normalizeWhatsAppNumber(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, "");

  if (!normalized.startsWith("+")) {
    throw new Error(
      "Phone number must begin with '+'."
    );
  }

  if (
    !/^\+[1-9]\d{7,14}$/.test(normalized)
  ) {
    throw new Error(
      "WhatsApp number must include the country code, for example +16025551234."
    );
  }

  return normalized;
}

function getBirthdayTemplateConfig({
  playerName,
  leagueName,
}) {
  const contentSid =
    String(
      process.env
        .TWILIO_BIRTHDAY_CONTENT_SID ||
      ""
    ).trim();

  if (!contentSid) {
    throw new Error(
      "TWILIO_BIRTHDAY_CONTENT_SID is missing."
    );
  }

  const cleanPlayerName =
    String(playerName || "").trim();

  const cleanLeagueName =
    String(leagueName || "").trim();

  if (!cleanPlayerName) {
    throw new Error(
      "Player name is required."
    );
  }

  if (!cleanLeagueName) {
    throw new Error(
      "League name is required."
    );
  }

  return {
    contentSid,
    contentVariables:
      JSON.stringify({
        1: cleanPlayerName,
        2: cleanLeagueName,
      }),
    cleanPlayerName,
    cleanLeagueName,
  };
}

/*
 * Existing player WhatsApp sender.
 *
 * Optional statusCallbackUrl was added so owner messages can use a
 * dedicated callback that performs automatic SMS fallback.
 * Existing callers do not need to change.
 */
export async function sendTwilioWhatsAppBirthdayMessage({
  recipientPhone,
  playerName,
  leagueName,
  birthdayId,
  leagueId,
  statusCallbackUrl = null,
}) {
  const messagingServiceSid =
    process.env
      .TWILIO_WHATSAPP_MESSAGING_SERVICE_SID;

  if (!messagingServiceSid) {
    throw new Error(
      "TWILIO_WHATSAPP_MESSAGING_SERVICE_SID is missing."
    );
  }

  const normalizedRecipient =
    normalizeWhatsAppNumber(
      recipientPhone
    );

  const {
    contentSid,
    contentVariables,
  } =
    getBirthdayTemplateConfig({
      playerName,
      leagueName,
    });

  const client = getTwilioClient();

  const statusCallback =
    statusCallbackUrl ||
    getBirthdayWhatsAppStatusCallbackUrl({
      birthdayId,
      leagueId,
    });

  let message;

  try {
    message =
      await client.messages.create({
        messagingServiceSid,

        to:
          `whatsapp:${normalizedRecipient}`,

        contentSid,

        contentVariables,

        statusCallback,
      });
  } catch (error) {
    console.error(
      "[TWILIO_WHATSAPP_SEND_FAILED]",
      {
        birthdayId,
        leagueId,
        recipient:
          normalizedRecipient,

        code:
          error.code,

        status:
          error.status,

        message:
          error.message,
      }
    );

    throw error;
  }

  if (!message.sid) {
    throw new Error(
      "Twilio accepted the request but did not return a Message SID."
    );
  }

  return {
    success: true,

    messageSid:
      message.sid,

    status:
      (
        message.status ||
        "queued"
      ).toUpperCase(),

    recipient:
      message.to,

    dateCreated:
      message.dateCreated ??
      null,

    dateUpdated:
      message.dateUpdated ??
      null,
  };
}

/*
 * SMS fallback using THE SAME Twilio ContentSid and THE SAME
 * ContentVariables as WhatsApp.
 *
 * This is intentionally NOT a separately-built SMS body. Twilio renders
 * the same birthday content template for the SMS channel, which keeps the
 * wording/variable format consistent with the WhatsApp message.
 */
export async function sendTwilioBirthdayTemplateSms({
  recipientPhone,
  playerName,
  leagueName,
}) {
  const messagingServiceSid =
    String(
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
    normalizeWhatsAppNumber(
      recipientPhone
    );

  const {
    contentSid,
    contentVariables,
  } =
    getBirthdayTemplateConfig({
      playerName,
      leagueName,
    });

  const client =
    getTwilioClient();

  const message =
    await client.messages.create({
      messagingServiceSid,

      // SMS uses a normal E.164 destination.
      // Do NOT prefix with "whatsapp:".
      to:
        normalizedRecipient,

      // SAME approved birthday Content template.
      contentSid,

      // SAME {{1}} player and {{2}} league variables.
      contentVariables,
    });

  if (!message?.sid) {
    throw new Error(
      "Twilio accepted the birthday SMS fallback but did not return a Message SID."
    );
  }

  return {
    success: true,

    messageSid:
      message.sid,

    status:
      (
        message.status ||
        "accepted"
      ).toUpperCase(),

    recipient:
      message.to ||
      normalizedRecipient,
  };
}
