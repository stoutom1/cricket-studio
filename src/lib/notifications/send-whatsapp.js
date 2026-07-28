import {
  maskPhoneNumber,
  normalizeInternationalPhone,
} from "@/lib/notifications/phone";

function requiredEnvironmentValue(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value;
}

/**
 * Sends a pre-approved WhatsApp template through
 * Meta WhatsApp Cloud API.
 *
 * Business-initiated reminders generally need an approved
 * message template. The template name is configured through
 * WHATSAPP_KIT_REMINDER_TEMPLATE.
 */
export async function sendKitReminderWhatsApp({
  phoneNumber,
  playerName,
  teamName,
  opponentName,
  leagueName,
  matchDateText,
  matchTimeText,
}) {
  const normalizedPhone =
    normalizeInternationalPhone(phoneNumber);

  if (!normalizedPhone) {
    throw new Error(
      "The assigned player does not have a valid international WhatsApp number."
    );
  }

  const accessToken = requiredEnvironmentValue(
    "WHATSAPP_ACCESS_TOKEN"
  );

  const phoneNumberId = requiredEnvironmentValue(
    "WHATSAPP_PHONE_NUMBER_ID"
  );

  const apiVersion =
    String(
      process.env.WHATSAPP_API_VERSION || "v23.0"
    ).trim();

  const templateName = requiredEnvironmentValue(
    "WHATSAPP_KIT_REMINDER_TEMPLATE"
  );

  const templateLanguage =
    String(
      process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US"
    ).trim();

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: templateLanguage,
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: playerName || "Player",
                },
                {
                  type: "text",
                  text: teamName || "Your team",
                },
                {
                  type: "text",
                  text: opponentName || "the opponent",
                },
                {
                  type: "text",
                  text: matchDateText || "the scheduled date",
                },
                {
                  type: "text",
                  text: matchTimeText || "the scheduled time",
                },
                {
                  type: "text",
                  text: leagueName || "your league",
                },
              ],
            },
          ],
        },
      }),
      cache: "no-store",
    }
  );

  const responseData = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const providerMessage =
      responseData?.error?.message ||
      "WhatsApp provider rejected the message.";

    const error = new Error(providerMessage);

    error.providerResponse = responseData;
    error.httpStatus = response.status;
    error.maskedPhone = maskPhoneNumber(
      normalizedPhone
    );

    throw error;
  }

  return {
    success: true,
    providerMessageId:
      responseData?.messages?.[0]?.id || null,
    providerResponse: responseData,
    maskedPhone: maskPhoneNumber(
      normalizedPhone
    ),
  };
}