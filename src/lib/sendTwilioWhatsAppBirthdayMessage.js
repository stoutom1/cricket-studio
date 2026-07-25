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

export function normalizeWhatsAppNumber(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/[^\d+]/g, "");

  if (
    !/^\+[1-9]\d{7,14}$/.test(normalized)
  ) {
    throw new Error(
      "WhatsApp number must include the country code, for example +16025551234."
    );
  }

  return normalized;
}

export async function sendTwilioWhatsAppBirthdayMessage({
  recipientPhone,
  playerName,
  leagueName,
}) {
  const messagingServiceSid =
    process.env
      .TWILIO_WHATSAPP_MESSAGING_SERVICE_SID;

  const contentSid =
    process.env
      .TWILIO_BIRTHDAY_CONTENT_SID;

  if (!messagingServiceSid) {
    throw new Error(
      "TWILIO_WHATSAPP_MESSAGING_SERVICE_SID is missing."
    );
  }

  if (!contentSid) {
    throw new Error(
      "TWILIO_BIRTHDAY_CONTENT_SID is missing."
    );
  }

  const normalizedRecipient =
    normalizeWhatsAppNumber(
      recipientPhone
    );

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

  const client = getTwilioClient();

  const message =
    await client.messages.create({
      messagingServiceSid,

      to: `whatsapp:${normalizedRecipient}`,

      contentSid,

      contentVariables:
        JSON.stringify({
          1: cleanPlayerName,
          2: cleanLeagueName,
        }),
    });

  return {
    success: true,
    messageSid: message.sid,
    status: message.status,
    recipient: message.to,
  };
}